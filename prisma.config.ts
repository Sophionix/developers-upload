import "dotenv/config";
import { defineConfig } from "prisma/config";
import { buildDatabaseConnectionUrl, resolveDatabaseConnectionConfig } from "./scripts/database-config.mjs";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: buildDatabaseConnectionUrl(resolveDatabaseConnectionConfig(process.env)),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
