import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveDatabaseConnectionConfig } from "../../scripts/database-config.mjs";
import { logger } from "./logger";

const SLOW_QUERY_MS = 100;

function createClient(): PrismaClient {
  const config = resolveDatabaseConnectionConfig(process.env);
  const url = new URL(config.url ?? `mysql://${config.host}:${config.port}/${config.database}`);

  // Forward query params from the connection string (e.g. allowPublicKeyRetrieval, ssl)
  const queryAllowPublicKey = url.searchParams.get("allowPublicKeyRetrieval");
  const sslParam = url.searchParams.get("ssl");

  const adapter = new PrismaMariaDb({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: Number.parseInt(url.searchParams.get("connection_limit") ?? "10", 10),
    allowPublicKeyRetrieval:
      queryAllowPublicKey === "true" || queryAllowPublicKey === "1" || true,
    ...(sslParam && { ssl: sslParam === "true" || sslParam === "1" }),
  });

  const client = new PrismaClient({ adapter, log: [{ emit: "event", level: "query" }] });
  const withOn = client as unknown as {
    $on?: (event: "query", cb: (e: { duration: number; query: string }) => void) => void;
  };
  withOn.$on?.("query", (e) => {
    if (e.duration >= SLOW_QUERY_MS) logger.warn({ durationMs: e.duration, query: e.query }, "slow_query");
  });
  return client;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
