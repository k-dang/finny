#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
  version?: string;
};

const usage = `cli\n\nUsage:\n  cli [options]\n\nOptions:\n  -h, --help      Show help\n  -v, --version   Show version`;

if (args.length === 0) {
  console.log("cli is ready");
  process.exit(0);
}

if (args.includes("-h") || args.includes("--help")) {
  console.log(usage);
  process.exit(0);
}

if (args.includes("-v") || args.includes("--version")) {
  console.log(packageJson.version ?? "0.0.0");
  process.exit(0);
}

console.error(`Unknown option: ${args[0]}`);
console.error("Run 'cli --help' for usage.");
process.exit(1);
