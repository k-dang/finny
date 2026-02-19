#!/usr/bin/env bun
// @ts-nocheck

import { existsSync } from "node:fs";
import path from "node:path";

if (Bun.argv.includes("--help")) {
  console.log("Start the IBKR Client Portal Gateway.");
  console.log("Usage: bun run setup");
  process.exit(0);
}

const repoRoot = path.resolve(import.meta.dir, "..");
const gatewayDir = path.join(repoRoot, "clientportal.gw");
const confPath = path.join(gatewayDir, "root", "conf.yaml");

if (!existsSync(gatewayDir)) {
  console.error(`Gateway directory not found: ${gatewayDir}`);
  process.exit(1);
}

if (!existsSync(confPath)) {
  console.error(`Gateway config file not found: ${confPath}`);
  process.exit(1);
}

const launcher =
  process.platform === "win32"
    ? path.join(gatewayDir, "bin", "run.bat")
    : path.join(gatewayDir, "bin", "run.sh");

if (!existsSync(launcher)) {
  console.error(`Gateway launcher not found: ${launcher}`);
  process.exit(1);
}

console.log(`Starting IBKR Client Portal Gateway from: ${gatewayDir}`);
console.log(`Using config: ${confPath}`);
console.log("After startup, sign in at: https://localhost:5000");

const command =
  process.platform === "win32"
    ? ["cmd", "/c", launcher, confPath]
    : [launcher, confPath];

const child = Bun.spawn(command, {
  cwd: gatewayDir,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(await child.exited);
