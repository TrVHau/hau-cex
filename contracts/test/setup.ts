/**
 * Mocha Root Hook — Setup Hardhat Runtime Environment cho tests.
 *
 * Hardhat 3 thay đổi kiến trúc: ethers nằm trong hre.network.connect().ethers
 * File này khởi tạo HRE + network connection, expose qua global.
 */

import {
  createHardhatRuntimeEnvironment,
  resolveHardhatConfigPath,
  importUserConfig,
} from "hardhat/hre";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

export const mochaHooks = {
  async beforeAll(this: Mocha.Context) {
    this.timeout(60000);

    const configPath = await resolveHardhatConfigPath();
    const userConfig = await importUserConfig(configPath);

    const hre = await createHardhatRuntimeEnvironment(
      { ...userConfig, plugins: [hardhatEthers] },
      {},
      configPath,
    );

    const conn = await hre.network.connect();

    // Expose globally để test files import được
    (globalThis as any).__hre = hre;
    (globalThis as any).__ethers = conn.ethers;
    (globalThis as any).__conn = conn;
  },

  async afterAll() {
    const conn = (globalThis as any).__conn;
    if (conn?.close) await conn.close();
  },
};
