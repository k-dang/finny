#!/usr/bin/env bun

import { CommanderError } from "commander";
import { buildProgram } from "./program";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("cli is ready");
  process.exit(0);
}

const program = buildProgram();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    process.exit(error.exitCode);
  }

  throw error;
}
