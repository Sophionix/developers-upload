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
    DATABASE_URL: "https://example.up.railway.app",
    MYSQL_URL: mysqlUrl.toString(),
  });

  assert.equal(config.source, "MYSQL_URL");
  assert.equal(config.host, "shortline.proxy.rlwy.net");
  assert.equal(config.port, 44760);
  assert.equal(config.user, "railway");
  assert.equal(config.password, "pass");
  assert.equal(config.database, "railway");
  assert.equal(config.sourceDescription, "MYSQL_URL; ignored invalid sources: DATABASE_URL");
});

test("reports each invalid source when no valid database config exists", () => {
  assert.throws(
    () =>
      resolveDatabaseStartupConfig({
        DATABASE_URL: "https://example.up.railway.app",
        MYSQL_URL: "https://mysql.railway.internal",
      }),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.message.includes('DATABASE_URL must use a mysql:// or mariadb:// URL, received "https:"') &&
      error.message.includes('MYSQL_URL must use a mysql:// or mariadb:// URL, received "https:"') &&
      error.message.includes("Provide DATABASE_URL or MYSQL_URL"),
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
