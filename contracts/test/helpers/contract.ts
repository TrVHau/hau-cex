/**
 * test/helpers/contract.ts — Helpers cho Hardhat 3 tests
 *
 * Hardhat 3 không có built-in chai matchers như hardhat-chai-matchers v2.
 * File này cung cấp:
 *   - getEthers()        → ethers instance từ network connection
 *   - getSigners()       → account signers
 *   - getFactory(name)   → contract factory
 *   - mine(n)            → advance blocks
 *   - increaseTime(s)    → advance time
 *   - assertRevertsWith  → kiểm tra revert với custom error
 *   - assertEmitted      → kiểm tra event đã được emit
 */

import { expect } from "chai";
import type { HardhatEthers } from "@nomicfoundation/hardhat-ethers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { ContractTransactionResponse, BaseContract } from "ethers";

// ─── HRE Access ──────────────────────────────────────────────────────────────

function _ethers(): HardhatEthers {
  const e = (globalThis as any).__ethers;
  if (!e) throw new Error("[setup] HRE not initialized — is test/setup.ts loaded?");
  return e;
}

function _conn(): any {
  return (globalThis as any).__conn;
}

export function getEthers(): HardhatEthers {
  return _ethers();
}

export async function getSigners(): Promise<HardhatEthersSigner[]> {
  return _ethers().getSigners();
}

export async function getFactory(name: string) {
  return _ethers().getContractFactory(name);
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

export async function increaseTime(seconds: number | bigint) {
  await _conn().provider.request({
    method: "evm_increaseTime",
    params: [Number(seconds)],
  });
  await _conn().provider.request({ method: "evm_mine", params: [] });
}

export async function mine(blocks = 1) {
  for (let i = 0; i < blocks; i++) {
    await _conn().provider.request({ method: "evm_mine", params: [] });
  }
}

// ─── Revert matchers ──────────────────────────────────────────────────────────

/**
 * Kiểm tra một tx promise bị revert với custom error cụ thể.
 *
 * @example
 *   await assertReverts(
 *     vault.connect(user).deposit(token, 0n, REF_1),
 *     "InvalidAmount"
 *   );
 */
export async function assertReverts(
  txPromise: Promise<any>,
  expectedErrorName: string,
  ...args: any[]
): Promise<void> {
  let caught = false;
  try {
    await txPromise;
  } catch (err: any) {
    caught = true;
    const msg: string = err?.message ?? err?.toString() ?? "";
    // ethers v6 format: "... reverted with custom error 'ErrorName(args)'"
    // hoặc Error object có errorName
    const errorName: string = err?.errorName ?? err?.revert?.name ?? "";
    if (errorName) {
      expect(errorName, `Expected error "${expectedErrorName}" but got "${errorName}"`).to.equal(expectedErrorName);
    } else if (msg) {
      expect(msg, `Expected revert with "${expectedErrorName}" but got: ${msg}`)
        .to.include(expectedErrorName);
    }
    if (args.length > 0 && (err?.revert?.args || err?.errorArgs)) {
      const actualArgs = err?.revert?.args ?? err?.errorArgs ?? [];
      for (let i = 0; i < args.length; i++) {
        expect(actualArgs[i]?.toString()).to.equal(args[i]?.toString());
      }
    }
  }
  expect(caught, `Expected tx to revert with "${expectedErrorName}" but it succeeded`).to.equal(true);
}

/**
 * Kiểm tra một tx đã emit event cụ thể với args đúng.
 *
 * @example
 *   const receipt = await (await vault.connect(user).deposit(...)).wait();
 *   assertEmitted(receipt, vault, "Deposited", [REF_1, user.address, token, amount]);
 */
export function assertEmitted(
  receipt: any,
  contract: BaseContract,
  eventName: string,
  expectedArgs?: any[],
): void {
  const iface = contract.interface;
  const eventFragment = iface.getEvent(eventName);
  expect(eventFragment, `Event "${eventName}" not found in contract ABI`).to.not.be.null;

  const found = (receipt?.logs ?? []).find((log: any) => {
    try {
      const parsed = iface.parseLog(log);
      return parsed?.name === eventName;
    } catch {
      return false;
    }
  });

  expect(found, `Event "${eventName}" was not emitted`).to.not.be.undefined;

  if (expectedArgs && found) {
    const parsed = iface.parseLog(found)!;
    for (let i = 0; i < expectedArgs.length; i++) {
      const actual   = parsed.args[i];
      const expected = expectedArgs[i];
      expect(
        actual?.toString?.() ?? actual,
        `Event "${eventName}" arg[${i}]: expected "${expected}" but got "${actual}"`,
      ).to.equal(expected?.toString?.() ?? expected);
    }
  }
}
