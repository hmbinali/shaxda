import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = new URL("..", import.meta.url);
const workerSrc = new URL("worker/src/", repoRoot);
const ledgerSrc = new URL("packages/db/src/match/", repoRoot);
const ledgerOnly = (file) => file.startsWith(fileURLToPath(ledgerSrc));
const workerOnly = (file) => file.startsWith(fileURLToPath(workerSrc));

const checks = [
  {
    name: "bare @shaxda/db import",
    pattern: /["']@shaxda\/db["']/g,
    appliesTo: () => true,
  },
  {
    name: "auth-table SQL",
    pattern:
      /\b(?:FROM|JOIN|INTO|UPDATE|TABLE|REFERENCES)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(?:["'`[])?(?:user|account|session|verification|username_claim)\b/gi,
    appliesTo: () => true,
  },
  {
    name: "Drizzle or Better Auth import in ledger writer",
    pattern: /["'](?:drizzle-orm|better-auth)(?:\/[^"']*)?["']/g,
    appliesTo: ledgerOnly,
  },
  {
    name: "normal WebSocket accept",
    pattern: /\.accept\s*\(/g,
    appliesTo: workerOnly,
  },
  {
    name: "setInterval",
    pattern: /\bsetInterval\s*\(/g,
    appliesTo: workerOnly,
  },
  {
    name: "setTimeout in Durable Object lifecycle source",
    pattern: /\bsetTimeout\s*\(/g,
    appliesTo: workerOnly,
  },
];

const violations = [];

for (const filePath of (
  await Promise.all([workerSrc, ledgerSrc].map(listTypeScriptFiles))
).flat()) {
  const relativePath = path.relative(fileURLToPath(repoRoot), filePath);
  if (filePath.endsWith(".test.ts")) {
    continue;
  }

  const source = await readFile(filePath, "utf8");
  for (const check of checks) {
    if (!check.appliesTo(filePath)) {
      continue;
    }

    for (const match of source.matchAll(check.pattern)) {
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(`${relativePath}:${line} uses forbidden ${check.name}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Hibernation conformance check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Hibernation conformance check passed.");

async function listTypeScriptFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      directoryUrl,
    );
    if (entry.isDirectory()) {
      files.push(...(await listTypeScriptFiles(entryUrl)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fileURLToPath(entryUrl));
    }
  }

  return files;
}
