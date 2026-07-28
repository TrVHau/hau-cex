import { expect } from "chai";
import { getSigners, getContractFactory } from "./helpers/hre.js";

const CLAIM_AMOUNT = 1000n * 10n ** 6n; // 1,000 USDT (6 decimals)
const ONE_DAY = 86400n;                  // 86400 seconds

describe("TokenFaucet", () => {
  // ── Deploy helper ─────────────────────────────────────────────────────────
  async function deploy() {
    const [admin, user1, user2, attacker] = await getSigners();

    const MockERC20   = await getContractFactory("MockERC20");
    const TokenFaucet = await getContractFactory("TokenFaucet");

    const usdt = await MockERC20.deploy("Mock USDT", "USDT", 6, admin.address);
    await usdt.waitForDeployment();

    const faucet = await TokenFaucet.deploy(admin.address);
    await faucet.waitForDeployment();

    // Grant MINTER_ROLE to Faucet
    const MINTER_ROLE = await usdt.MINTER_ROLE();
    await (await usdt.connect(admin).grantRole(MINTER_ROLE, await faucet.getAddress())).wait();

    // Configure Faucet: usdt supported, 1000 USDT/day
    await (await faucet.connect(admin).setTokenConfig(
      await usdt.getAddress(), true, CLAIM_AMOUNT, ONE_DAY
    )).wait();

    return { faucet, usdt, admin, user1, user2, attacker };
  }

  // Helper: advance blockchain time
  async function increaseTime(seconds: bigint) {
    // Dùng hardhat network provider qua global __conn
    const conn = (globalThis as any).__conn;
    await conn.provider.request({ method: "evm_increaseTime", params: [Number(seconds)] });
    await conn.provider.request({ method: "evm_mine", params: [] });
  }

  // ── claim() happy path ────────────────────────────────────────────────────
  describe("claim() — happy path", () => {
    it("user claims successfully, balance equals claimAmount", async () => {
      const { faucet, usdt, user1 } = await deploy();
      await (await faucet.connect(user1).claim(await usdt.getAddress())).wait();
      expect(await usdt.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT);
    });

    it("emits TokenClaimed with correct args", async () => {
      const { faucet, usdt, user1 } = await deploy();
      await expect(faucet.connect(user1).claim(await usdt.getAddress()))
        .to.emit(faucet, "TokenClaimed")
        .withArgs(user1.address, await usdt.getAddress(), CLAIM_AMOUNT);
    });

    it("two different users can claim independently", async () => {
      const { faucet, usdt, user1, user2 } = await deploy();
      await (await faucet.connect(user1).claim(await usdt.getAddress())).wait();
      await (await faucet.connect(user2).claim(await usdt.getAddress())).wait();
      expect(await usdt.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT);
      expect(await usdt.balanceOf(user2.address)).to.equal(CLAIM_AMOUNT);
    });

    it("same user can claim again after cooldown expires", async () => {
      const { faucet, usdt, user1 } = await deploy();
      await (await faucet.connect(user1).claim(await usdt.getAddress())).wait();
      await increaseTime(ONE_DAY);
      await (await faucet.connect(user1).claim(await usdt.getAddress())).wait();
      expect(await usdt.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT * 2n);
    });
  });

  // ── claim() reverts ────────────────────────────────────────────────────────
  describe("claim() — reverts", () => {
    it("unsupported token → UnsupportedToken", async () => {
      const { faucet, admin } = await deploy();
      await expect(faucet.connect(admin).claim(admin.address))
        .to.be.revertedWithCustomError(faucet, "UnsupportedToken");
    });

    it("claim again before cooldown → FaucetCooldownActive", async () => {
      const { faucet, usdt, user1 } = await deploy();
      await (await faucet.connect(user1).claim(await usdt.getAddress())).wait();
      await expect(faucet.connect(user1).claim(await usdt.getAddress()))
        .to.be.revertedWithCustomError(faucet, "FaucetCooldownActive");
    });

    it("claim when paused → EnforcedPause", async () => {
      const { faucet, usdt, user1, admin } = await deploy();
      await (await faucet.connect(admin).pause()).wait();
      await expect(faucet.connect(user1).claim(await usdt.getAddress()))
        .to.be.revertedWithCustomError(faucet, "EnforcedPause");
    });
  });

  // ── Admin functions ────────────────────────────────────────────────────────
  describe("Admin permissions", () => {
    it("non-admin cannot setTokenConfig → AccessControl revert", async () => {
      const { faucet, usdt, attacker } = await deploy();
      await expect(
        faucet.connect(attacker).setTokenConfig(await usdt.getAddress(), true, 100n, 100n)
      ).to.be.revertedWithCustomError(faucet, "AccessControlUnauthorizedAccount");
    });

    it("non-admin cannot pause → AccessControl revert", async () => {
      const { faucet, attacker } = await deploy();
      await expect(faucet.connect(attacker).pause())
        .to.be.revertedWithCustomError(faucet, "AccessControlUnauthorizedAccount");
    });

    it("non-admin cannot unpause → AccessControl revert", async () => {
      const { faucet, attacker, admin } = await deploy();
      await (await faucet.connect(admin).pause()).wait();
      await expect(faucet.connect(attacker).unpause())
        .to.be.revertedWithCustomError(faucet, "AccessControlUnauthorizedAccount");
    });

    it("admin can pause then unpause; claim works after unpause", async () => {
      const { faucet, usdt, user1, admin } = await deploy();
      await (await faucet.connect(admin).pause()).wait();
      await (await faucet.connect(admin).unpause()).wait();
      await (await faucet.connect(user1).claim(await usdt.getAddress())).wait();
      expect(await usdt.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT);
    });

    it("individual setters update state correctly", async () => {
      const { faucet, usdt, admin } = await deploy();
      const usdtAddr = await usdt.getAddress();
      await (await faucet.connect(admin).setSupportedToken(usdtAddr, false)).wait();
      expect(await faucet.supportedTokens(usdtAddr)).to.equal(false);
      await (await faucet.connect(admin).setClaimAmount(usdtAddr, 500n)).wait();
      expect(await faucet.claimAmounts(usdtAddr)).to.equal(500n);
      await (await faucet.connect(admin).setClaimCooldown(usdtAddr, 3600n)).wait();
      expect(await faucet.claimCooldowns(usdtAddr)).to.equal(3600n);
    });
  });
});
