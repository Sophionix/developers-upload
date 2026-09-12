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
