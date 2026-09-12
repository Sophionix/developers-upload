import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dockerfile = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const entrypoint = fs.readFileSync(
  new URL("../scripts/docker-entrypoint.sh", import.meta.url),
  "utf8",
);

test("runner stage installs Prisma with node-modules linker", () => {
  const toolsRunBlock = dockerfile.match(/RUN mkdir -p \/app\/tools[\s\S]*?chown -R nextjs:nodejs \/app\/tools/);

  assert.ok(toolsRunBlock, "expected isolated /app/tools install block in Dockerfile");

  assert.match(
    toolsRunBlock[0],
    /yarn config set nodeLinker node-modules/,
  );
  assert.match(
    toolsRunBlock[0],
    /yarn add [^\n]*\bprisma\b/,
  );
  assert.match(
    toolsRunBlock[0],
    /test -x \/app\/tools\/node_modules\/\.bin\/prisma/,
  );
});

test("entrypoint invokes Prisma from the runtime tools directory", () => {
  assert.match(entrypoint, /PRISMA_BIN="\$\{PRISMA_BIN:-\/app\/tools\/node_modules\/\.bin\/prisma\}"/);
  assert.match(entrypoint, /"\$PRISMA_BIN" migrate deploy/);
  assert.match(entrypoint, /"\$PRISMA_BIN" db seed/);
});
