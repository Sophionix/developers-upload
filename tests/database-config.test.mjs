import test from "node:test";
import assert from "node:assert/strict";

import {
  DatabaseConfigError,
  buildDatabaseConnectionUrl,
  resolveDatabaseConnectionConfig,
  resolveDatabaseStartupConfig,
} from "../scripts/database-config.mjs";

test("rejects placeholder literals before startup wait begins", () => {
  assert.throws(
    () =>
      resolveDatabaseStartupConfig({
        DB_HOST: "MYSQLHOST",
        DB_PORT: "MYSQLPORT",
      }),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.message.includes("DB_HOST") &&
      error.message.includes("DB_PORT"),
  );
});

test("prefers a valid DATABASE_URL when present", () => {
  const databaseUrl = new URL("mysql://db.internal:3307/app_db?connection_limit=12");
  databaseUrl.username = "user";
  databaseUrl.password = "pass";

  const config = resolveDatabaseConnectionConfig({
    DATABASE_URL: databaseUrl.toString(),
    DB_HOST: "ignored-host",
    DB_PORT: "3306",
    DB_USER: "ignored-user",
    DB_PASSWORD: "ignored-password",
    DB_NAME: "ignored-db",
  });

  assert.equal(config.source, "DATABASE_URL");
  assert.equal(config.host, "db.internal");
  assert.equal(config.port, 3307);
  assert.equal(config.user, "user");
  assert.equal(config.password, "pass");
  assert.equal(config.database, "app_db");
  assert.equal(
    buildDatabaseConnectionUrl(config),
    databaseUrl.toString(),
  );
});

test("falls back to DB_HOST and DB_PORT when DATABASE_URL is absent", () => {
  const config = resolveDatabaseConnectionConfig({
    DB_HOST: "db.example",
    DB_PORT: "3308",
    DB_USER: "app",
    DB_PASSWORD: "secret",
    DB_NAME: "developers_upload",
  });

  assert.equal(config.source, "DB_*");
  assert.equal(config.host, "db.example");
  assert.equal(config.port, 3308);
  assert.equal(config.user, "app");
  assert.equal(config.database, "developers_upload");
});

test("falls back to MYSQLHOST and MYSQLPORT when app-specific vars are absent", () => {
  const config = resolveDatabaseConnectionConfig({
    MYSQLHOST: "railway.internal",
    MYSQLPORT: "3310",
    MYSQLUSER: "railway",
    MYSQLPASSWORD: "password",
    MYSQLDATABASE: "railway_db",
  });

  assert.equal(config.source, "MYSQL*");
  assert.equal(config.host, "railway.internal");
  assert.equal(config.port, 3310);
  assert.equal(config.user, "railway");
  assert.equal(config.database, "railway_db");
});

test("uses MYSQL_URL when DATABASE_URL is absent", () => {
  const mysqlUrl = new URL("mysql://mysql-url.internal:3311/mysql_url_db");
  mysqlUrl.username = "mysql_user";
  mysqlUrl.password = "mysql_pass";

  const config = resolveDatabaseConnectionConfig({
    MYSQL_URL: mysqlUrl.toString(),
    DB_HOST: "ignored-db-host",
    DB_PORT: "3306",
    DB_USER: "ignored-db-user",
    DB_PASSWORD: "ignored-db-password",
    DB_NAME: "ignored-db-name",
    MYSQLHOST: "ignored-mysql-host",
    MYSQLPORT: "3307",
    MYSQLUSER: "ignored-mysql-user",
    MYSQLPASSWORD: "ignored-mysql-password",
    MYSQLDATABASE: "ignored-mysql-db",
  });

  assert.equal(config.source, "MYSQL_URL");
  assert.equal(config.host, "mysql-url.internal");
  assert.equal(config.port, 3311);
  assert.equal(config.user, "mysql_user");
  assert.equal(config.password, "mysql_pass");
  assert.equal(config.database, "mysql_url_db");
});

test("falls back to MYSQL_URL when DATABASE_URL is set to a non-MySQL URL", () => {
  const mysqlUrl = new URL("mysql://shortline.proxy.rlwy.net:44760/railway");
  mysqlUrl.username = "railway";
  mysqlUrl.password = "pass";

  const config = resolveDatabaseConnectionConfig({
    DATABASE_URL: "https:",
    MYSQL_URL: mysqlUrl.toString(),
  });

  assert.equal(config.source, "MYSQL_URL");
  assert.equal(config.host, "shortline.proxy.rlwy.net");
  assert.equal(config.port, 44760);
  assert.equal(config.user, "railway");
  assert.equal(config.password, "pass");
  assert.equal(config.database, "railway");
  assert.equal(config.sourceDescription, "MYSQL_URL");
});

test("uses MYSQL_PRIVATE_URL when DATABASE_URL is malformed", () => {
  const privateUrl = new URL("mysql://private.proxy.rlwy.net:3306/railway");
  privateUrl.username = "railway";
  privateUrl.password = "pass";

  const config = resolveDatabaseStartupConfig({
    DATABASE_URL: "https:",
    MYSQL_PRIVATE_URL: privateUrl.toString(),
  });

  assert.equal(config.source, "MYSQL_PRIVATE_URL");
  assert.equal(config.host, "private.proxy.rlwy.net");
  assert.equal(config.port, 3306);
  assert.equal(config.sourceDescription, "MYSQL_PRIVATE_URL");
});

test("uses DATABASE_PRIVATE_URL before MYSQL_PRIVATE_URL when DATABASE_URL is malformed", () => {
  const databasePrivateUrl = new URL("mysql://database.private.rlwy.net:3307/app");
  databasePrivateUrl.username = "railway";
  databasePrivateUrl.password = "pass";

  const mysqlPrivateUrl = new URL("mysql://mysql.private.rlwy.net:3308/app");
  mysqlPrivateUrl.username = "railway";
  mysqlPrivateUrl.password = "pass";

  const config = resolveDatabaseStartupConfig({
    DATABASE_URL: "https:",
    DATABASE_PRIVATE_URL: databasePrivateUrl.toString(),
    MYSQL_PRIVATE_URL: mysqlPrivateUrl.toString(),
  });

  assert.equal(config.source, "DATABASE_PRIVATE_URL");
  assert.equal(config.host, "database.private.rlwy.net");
  assert.equal(config.port, 3307);
});

test("uses DATABASE_PUBLIC_URL before MYSQL_PUBLIC_URL when higher-priority URLs are invalid", () => {
  const databasePublicUrl = new URL("mysql://database.public.rlwy.net:3309/app");
  databasePublicUrl.username = "railway";
  databasePublicUrl.password = "pass";

  const mysqlPublicUrl = new URL("mysql://mysql.public.rlwy.net:3310/app");
  mysqlPublicUrl.username = "railway";
  mysqlPublicUrl.password = "pass";

  const config = resolveDatabaseStartupConfig({
    DATABASE_URL: "https:",
    MYSQL_URL: "https://mysql.invalid",
    DATABASE_PUBLIC_URL: databasePublicUrl.toString(),
    MYSQL_PUBLIC_URL: mysqlPublicUrl.toString(),
  });

  assert.equal(config.source, "DATABASE_PUBLIC_URL");
  assert.equal(config.host, "database.public.rlwy.net");
  assert.equal(config.port, 3309);
});

test("reports each invalid source when no valid database config exists", () => {
  assert.throws(
    () =>
      resolveDatabaseStartupConfig({
        DATABASE_URL: "https:",
        MYSQL_URL: "https://mysql.railway.internal",
      }),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.message.includes('DATABASE_URL must use a mysql:// or mariadb:// URL, received "https:"') &&
      error.message.includes('MYSQL_URL must use a mysql:// or mariadb:// URL, received "https:"') &&
      error.message.includes("Provide DATABASE_URL or MYSQL_URL"),
  );
});

test("requires credentials for connection config even when startup host/port are valid", () => {
  assert.throws(
    () =>
      resolveDatabaseConnectionConfig({
        DB_HOST: "db.example",
        DB_PORT: "3306",
      }),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.message.includes("DB_USER is required") &&
      error.message.includes("DB_PASSWORD is required") &&
      error.message.includes("DB_NAME is required"),
  );
});

test("decodes percent-encoded URL credentials and database names", () => {
  const databaseUrl = new URL("mysql://encoded.internal:3312/");
  databaseUrl.username = "user name";
  databaseUrl.password = "p@ss word";
  databaseUrl.pathname = "/app db";

  const config = resolveDatabaseConnectionConfig({
    DATABASE_URL: databaseUrl.toString(),
  });

  assert.equal(config.source, "DATABASE_URL");
  assert.equal(config.host, "encoded.internal");
  assert.equal(config.port, 3312);
  assert.equal(config.user, "user name");
  assert.equal(config.password, "p@ss word");
  assert.equal(config.database, "app db");
});
