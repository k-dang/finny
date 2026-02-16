export type IbkrRequestOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  verifyTls?: boolean;
  fetchFn?: typeof fetch;
};

export type IbkrOrderQuery = {
  accountId?: string;
  filters?: string;
  force?: boolean;
};

export type IbkrTransactionQuery = {
  accountId: string;
  conid: number;
  currency?: string;
  days?: number;
};

export type IbkrContractSearchQuery = {
  symbol: string;
  secType?: string;
  name?: string;
  exchange?: string;
  currency?: string;
};

export type IbkrClient = {
  checkAuth: () => Promise<void>;
  getAccounts: () => Promise<string[]>;
  getAccountSummary: (accountId: string) => Promise<Record<string, unknown>>;
  getPositions: (accountId: string) => Promise<Record<string, unknown>[]>;
  getOrders: (query?: IbkrOrderQuery) => Promise<Record<string, unknown>>;
  getTransactions: (
    query: IbkrTransactionQuery,
  ) => Promise<Record<string, unknown> | unknown[]>;
  searchContracts: (
    query: IbkrContractSearchQuery,
  ) => Promise<Record<string, unknown>[]>;
};
