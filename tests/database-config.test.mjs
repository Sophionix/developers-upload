import test from "node:test";
import assert from "node:assert/strict";

import {
  DatabaseConfigError,
  buildDatabaseConnectionUrl,
  resolveDatabaseConnectionConfig,
  resolveDatabaseStartupConfig,
} from "../scripts/database-config.mjs";

test("requires DATABASE_URL before startup wait begins", () => {
  assert.throws(
    () => resolveDatabaseStartupConfig({}),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.message.includes("DATABASE_URL") &&
      error.message.includes("real mysql:// or mariadb:// connection string"),
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

test("rejects blank DATABASE_URL values", () => {
  assert.throws(
    () =>
      resolveDatabaseConnectionConfig({
        DATABASE_URL: "   ",
      }),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.message.includes("DATABASE_URL") &&
      error.message.includes("real mysql:// or mariadb:// connection string"),
  );
});

test("rejects unresolved placeholder DATABASE_URL values", () => {
  assert.throws(
    () =>
      resolveDatabaseConnectionConfig({
        DATABASE_URL: "${{MySQL.MYSQL_URL}}",
      }),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.message.includes("unresolved placeholder"),
  );
});

test("does not fall back to MYSQL_URL when DATABASE_URL is absent", () => {
  const mysqlUrl = ["mysql:", "//", "mysql-url.internal:3311/mysql_url_db"].join("");

  assert.throws(
    () =>
      resolveDatabaseConnectionConfig({
        MYSQL_URL: mysqlUrl,
      }),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.message.includes("Set DATABASE_URL"),
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
