export type IbkrConnectionMode = "paper" | "live";

export type IbkrProfile = {
  broker: "ibkr";
  mode: IbkrConnectionMode;
  ready: boolean;
};

export function getIbkrProfile(
  mode: IbkrConnectionMode = "paper",
): IbkrProfile {
  return {
    broker: "ibkr",
    mode,
    ready: false,
  };
}
