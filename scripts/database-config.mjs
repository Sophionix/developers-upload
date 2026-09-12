import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_MYSQL_PORT = 3306;
const PLACEHOLDER_LITERALS = new Set([
  "DATABASE_URL",
  "MYSQL_URL",
  "MYSQLHOST",
  "MYSQLPORT",
  "MYSQLUSER",
  "MYSQLPASSWORD",
  "MYSQLDATABASE",
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "MYSQL",
  "MYSQLSERVICE",
  "MYSQLSERVICE_NAME",
  "MYSQLSERVICEHOST",
  "MYSQLSERVICEPORT",
]);

const EXPLICIT_GROUPS = [
  {
    name: "DB_*",
    hostVar: "DB_HOST",
    portVar: "DB_PORT",
    userVar: "DB_USER",
    passwordVar: "DB_PASSWORD",
    databaseVar: "DB_NAME",
  },
  {
    name: "MYSQL*",
    hostVar: "MYSQLHOST",
    portVar: "MYSQLPORT",
    userVar: "MYSQLUSER",
    passwordVar: "MYSQLPASSWORD",
    databaseVar: "MYSQLDATABASE",
  },
];

export class DatabaseConfigError extends Error {
  /**
   * @param {string[]} issues
   */
  constructor(issues) {
    super(`Invalid database configuration:\n- ${issues.join("\n- ")}`);
    this.name = "DatabaseConfigError";
    this.issues = issues;
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} key
 */
function readEnv(env, key) {
  const value = env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * @param {string | undefined} value
 */
function isPlaceholderLiteral(value) {
  if (!value) return false;
  return PLACEHOLDER_LITERALS.has(value.trim().toUpperCase());
}

/**
 * @param {string | undefined} value
 */
function quoteValue(value) {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

/**
 * @param {string | undefined} value
 * @param {string} varName
 * @param {string[]} issues
 */
function validateRequiredValue(value, varName, issues) {
  if (!value) {
    issues.push(`${varName} is required`);
    return undefined;
  }
  if (isPlaceholderLiteral(value)) {
    issues.push(`${varName} must not be the placeholder literal ${quoteValue(value)}`);
    return undefined;
  }
  return value;
}

/**
 * @param {string | undefined} value
 * @param {string} varName
 * @param {string[]} issues
 */
function parsePortValue(value, varName, issues) {
  if (!value) return DEFAULT_MYSQL_PORT;
  if (isPlaceholderLiteral(value)) {
    issues.push(`${varName} must not be the placeholder literal ${quoteValue(value)}`);
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    issues.push(`${varName} must be a numeric port, received ${quoteValue(value)}`);
    return undefined;
  }
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push(`${varName} must be between 1 and 65535, received ${quoteValue(value)}`);
    return undefined;
  }
  return port;
}

/**
 * @param {URL} url
 * @param {string} sourceVar
 * @param {"startup" | "connection"} target
 */
function validateUrlConfig(url, sourceVar, target) {
  const issues = [];

  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    issues.push(`${sourceVar} must use a mysql:// or mariadb:// URL, received ${quoteValue(url.protocol)}`);
  }

  const host = validateRequiredValue(url.hostname || undefined, `${sourceVar} host`, issues);
  const port = parsePortValue(url.port || undefined, `${sourceVar} port`, issues);

  if (issues.length > 0) throw new DatabaseConfigError(issues);

  const config = {
    source: sourceVar,
    url: url.toString(),
    host,
    port,
    sourceDescription: sourceVar,
  };

  if (target === "startup") {
    return config;
  }

  const user = validateRequiredValue(
    url.username ? decodeURIComponent(url.username) : undefined,
    `${sourceVar} username`,
    issues,
  );
  const password = validateRequiredValue(
    url.password ? decodeURIComponent(url.password) : undefined,
    `${sourceVar} password`,
    issues,
  );
  const database = validateRequiredValue(
    url.pathname ? decodeURIComponent(url.pathname.replace(/^\//, "")) : undefined,
    `${sourceVar} database`,
    issues,
  );

  if (issues.length > 0) throw new DatabaseConfigError(issues);

  return {
    ...config,
    user,
    password,
    database,
  };
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} sourceVar
 * @param {"startup" | "connection"} target
 */
function resolveUrlConfig(env, sourceVar, target) {
  const raw = readEnv(env, sourceVar);
  if (!raw) return undefined;
  if (isPlaceholderLiteral(raw)) {
    throw new DatabaseConfigError([
      `${sourceVar} must not be the placeholder literal ${quoteValue(raw)}`,
    ]);
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new DatabaseConfigError([`${sourceVar} must be a valid database URL, received ${quoteValue(raw)}`]);
  }

  return validateUrlConfig(url, sourceVar, target);
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {(typeof EXPLICIT_GROUPS)[number]} group
 * @param {"startup" | "connection"} target
 */
function resolveExplicitGroup(env, group, target) {
  const values = {
    host: readEnv(env, group.hostVar),
    port: readEnv(env, group.portVar),
    user: readEnv(env, group.userVar),
    password: readEnv(env, group.passwordVar),
    database: readEnv(env, group.databaseVar),
  };

  if (Object.values(values).every((value) => value === undefined)) {
    return undefined;
  }

  const issues = [];
  const host = validateRequiredValue(values.host, group.hostVar, issues);
  const port = parsePortValue(values.port, group.portVar, issues);

  if (target === "startup") {
    if (issues.length > 0) throw new DatabaseConfigError(issues);
    return {
      source: group.name,
      sourceDescription: values.port ? `${group.hostVar}/${group.portVar}` : `${group.hostVar} + default ${DEFAULT_MYSQL_PORT}`,
      host,
      port,
    };
  }

  const user = validateRequiredValue(values.user, group.userVar, issues);
  const password = validateRequiredValue(values.password, group.passwordVar, issues);
  const database = validateRequiredValue(values.database, group.databaseVar, issues);

  if (issues.length > 0) throw new DatabaseConfigError(issues);

  return {
    source: group.name,
    sourceDescription: values.port ? `${group.hostVar}/${group.portVar}` : `${group.hostVar} + default ${DEFAULT_MYSQL_PORT}`,
    host,
    port,
    user,
    password,
    database,
  };
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {"startup" | "connection"} target
 */
function resolveDatabaseConfig(env, target) {
  for (const urlVar of ["DATABASE_URL", "MYSQL_URL"]) {
    const config = resolveUrlConfig(env, urlVar, target);
    if (config) return config;
  }

  for (const group of EXPLICIT_GROUPS) {
    const config = resolveExplicitGroup(env, group, target);
    if (config) return config;
  }

  throw new DatabaseConfigError(
    target === "startup"
      ? [
          "Provide DATABASE_URL or MYSQL_URL, or set DB_HOST/DB_PORT, or set MYSQLHOST/MYSQLPORT",
        ]
      : [
          "Provide DATABASE_URL or MYSQL_URL, or set DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME, or set MYSQLHOST/MYSQLPORT/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE",
        ],
  );
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function resolveDatabaseStartupConfig(env) {
  return resolveDatabaseConfig(env, "startup");
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function resolveDatabaseConnectionConfig(env) {
  return resolveDatabaseConfig(env, "connection");
}

/**
 * @param {ReturnType<typeof resolveDatabaseConnectionConfig>} config
 */
export function buildDatabaseConnectionUrl(config) {
  if (config.url) return config.url;

  const url = new URL("mysql://localhost");
  url.hostname = config.host;
  url.port = String(config.port);
  url.username = config.user;
  url.password = config.password;
  url.pathname = `/${config.database}`;
  return url.toString();
}

const isMainModule =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  const mode = process.argv[2] ?? "startup";

  try {
    if (mode === "startup") {
      const config = resolveDatabaseStartupConfig(process.env);
      process.stdout.write(`${config.host}\t${config.port}\t${config.sourceDescription}\n`);
    } else if (mode === "connection-url") {
      const config = resolveDatabaseConnectionConfig(process.env);
      process.stdout.write(`${buildDatabaseConnectionUrl(config)}\n`);
    } else {
      throw new DatabaseConfigError([`Unknown mode ${quoteValue(mode)} for database-config helper`]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
