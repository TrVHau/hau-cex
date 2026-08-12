/**
 * test/setup.ts — Mocha root hook: khởi tạo Hardhat Runtime Environment
 *
 * Hardhat 3 không auto-inject hre khi dùng mocha trực tiếp.
 * File này tạo HRE + network connection, lưu vào globalThis.
 *
 * Cách dùng:
 *   mocha --require tsx/esm --file test/setup.ts 'test/**\/*.test.ts'
 */


import {
  createHardhatRuntimeEnvironment,
  resolveHardhatConfigPath,
  importUserConfig,
} from "hardhat/hre";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";


export const mochaHooks = {
  async beforeAll(this: Mocha.Context) {
    this.timeout(120_000);

    const configPath = await resolveHardhatConfigPath();
    const userConfig = await importUserConfig(configPath);

    const hre = await createHardhatRuntimeEnvironment(
      { ...userConfig, plugins: [hardhatEthers] },
      {},
      configPath,
    );

    // Hardhat 3: ethers nằm ở hre.network.connect().ethers
    const conn = await hre.network.connect();

    (globalThis as any).__hre    = hre;
    (globalThis as any).__ethers = conn.ethers;
    (globalThis as any).__conn   = conn;
  },

  async afterAll() {
    const conn = (globalThis as any).__conn;
    if (conn?.close) await conn.close();
  },
};
