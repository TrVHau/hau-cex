/**
 * helpers/hre.ts — Cung cấp ethers và signers cho Hardhat 3 tests
 *
 * Hardhat 3: ethers nằm trong network connection, không phải hre.ethers trực tiếp.
 * Import từ file này thay vì dùng hre trực tiếp.
 */

import type { HardhatEthers } from "@nomicfoundation/hardhat-ethers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// Lấy ethers từ global được inject bởi setup.ts
function getEthers(): HardhatEthers {
  const e = (globalThis as any).__ethers;
  if (!e) throw new Error("ethers not initialized. Did you include test/setup.ts as a root hook?");
  return e;
}

export function ethersHelper(): HardhatEthers {
  return getEthers();
}

export async function getSigners(): Promise<HardhatEthersSigner[]> {
  return getEthers().getSigners();
}

export async function getContractFactory(name: string) {
  return getEthers().getContractFactory(name);
}
