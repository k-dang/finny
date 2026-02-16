import {
  getIbkrProfile,
  type IbkrConnectionMode,
  type IbkrProfile,
} from "@repo/ibkr";
import type { Command } from "commander";

type IbkrStatusPayload = {
  profile: IbkrProfile;
};

export function registerIbkrCommand(program: Command): void {
  program
    .command("ibkr")
    .description("Interactive Brokers integration status")
    .option("--live", "Show live account mode profile", false)
    .option("--minimal", "Output minified JSON", false)
    .action((options: { live?: boolean; minimal?: boolean }) => {
      const mode: IbkrConnectionMode = options.live ? "live" : "paper";
      const payload: IbkrStatusPayload = {
        profile: getIbkrProfile(mode),
      };

      const json = options.minimal
        ? JSON.stringify(payload)
        : JSON.stringify(payload, null, 2);
      console.log(json);
    });
}
