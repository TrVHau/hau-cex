export type DepositIntentResponseDto = {
  depositId: string;
  asset: string;
  chainId: string;
  tokenAddress: string;
  vaultAddress: string;
  accountReference: string;
  status: string;
  amount: string | null;
  expiresAt: string;
  createdAt: string;
};

export type DepositDetailResponseDto = DepositIntentResponseDto & {
  txHash: string | null;
  blockNumber: string | null;
  confirmationCount: number;
  creditedAt: string | null;
};

export type DepositConfigDto = {
  asset: string;
  chainId: string;
  tokenAddress: string;
  vaultAddress: string;
  requiredConfirmations: number;
};
