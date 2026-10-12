/**
 * test/helpers/types.ts — Typed contract interfaces cho Hardhat 3 tests
 *
 * Hardhat 3 + ethers v6 không tự generate typechain. File này định nghĩa
 * interface tối giản cho từng contract, đủ để TypeScript typecheck tests.
 */

import type { BaseContract, ContractTransactionResponse, BytesLike } from "ethers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";

// ─── Shared ──────────────────────────────────────────────────────────────────

/** Bất kỳ contract nào cũng có thể .connect() với signer */
type Connectable<T> = T & {
  connect(signer: HardhatEthersSigner): T;
  getAddress(): Promise<string>;
};

// ─── MockERC20 ───────────────────────────────────────────────────────────────

export type MockERC20Contract = Connectable<
  BaseContract & {
    // ERC20
    name(): Promise<string>;
    symbol(): Promise<string>;
    decimals(): Promise<bigint>;
    totalSupply(): Promise<bigint>;
    balanceOf(account: string): Promise<bigint>;
    allowance(owner: string, spender: string): Promise<bigint>;
    approve(spender: string, amount: bigint): Promise<ContractTransactionResponse>;
    transfer(to: string, amount: bigint): Promise<ContractTransactionResponse>;
    transferFrom(from: string, to: string, amount: bigint): Promise<ContractTransactionResponse>;
    // Mintable
    mint(to: string, amount: bigint): Promise<ContractTransactionResponse>;
    // AccessControl
    MINTER_ROLE(): Promise<string>;
    grantRole(role: string, account: string): Promise<ContractTransactionResponse>;
    hasRole(role: string, account: string): Promise<boolean>;
  }
>;

// ─── ExchangeVault ───────────────────────────────────────────────────────────

export type ExchangeVaultContract = Connectable<
  BaseContract & {
    // User
    deposit(
      token: string,
      amount: bigint,
      accountReference: BytesLike,
    ): Promise<ContractTransactionResponse>;
    // Admin
    setSupportedToken(token: string, supported: boolean): Promise<ContractTransactionResponse>;
    pause(): Promise<ContractTransactionResponse>;
    unpause(): Promise<ContractTransactionResponse>;
    recoverERC20(token: string, to: string, amount: bigint): Promise<ContractTransactionResponse>;
    // View
    supportedTokens(token: string): Promise<boolean>;
    usedDepositKeys(key: BytesLike): Promise<boolean>;
  }
>;

// ─── TokenFaucet ─────────────────────────────────────────────────────────────

export type TokenFaucetContract = Connectable<
  BaseContract & {
    // User
    claim(token: string): Promise<ContractTransactionResponse>;
    // Admin
    setTokenConfig(
      token: string,
      supported: boolean,
      amount: bigint,
      cooldown: bigint,
    ): Promise<ContractTransactionResponse>;
    setSupportedToken(token: string, supported: boolean): Promise<ContractTransactionResponse>;
    setClaimAmount(token: string, amount: bigint): Promise<ContractTransactionResponse>;
    setClaimCooldown(token: string, cooldown: bigint): Promise<ContractTransactionResponse>;
    pause(): Promise<ContractTransactionResponse>;
    unpause(): Promise<ContractTransactionResponse>;
    // View
    supportedTokens(token: string): Promise<boolean>;
    claimAmounts(token: string): Promise<bigint>;
    claimCooldowns(token: string): Promise<bigint>;
    lastClaimAt(token: string, user: string): Promise<bigint>;
  }
>;
