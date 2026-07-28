import { expect } from "chai";
import { ethers as ethersLib } from "ethers";
import { getSigners, getContractFactory } from "./helpers/hre.js";

const DEPOSIT_AMOUNT = 500n * 10n ** 6n; // 500 USDT (6 decimals)

// accountReference là bytes32 ngẫu nhiên — mô phỏng Backend sinh ra qua Deposit Intent API
const REF_1 = ethersLib.encodeBytes32String("deposit-ref-001");
const REF_2 = ethersLib.encodeBytes32String("deposit-ref-002");
const ZERO_REF = ethersLib.ZeroHash; // bytes32(0)

describe("ExchangeVault", () => {
  // ── Deploy helper ─────────────────────────────────────────────────────────
  async function deploy() {
    const [admin, user1, user2, attacker] = await getSigners();

    const MockERC20     = await getContractFactory("MockERC20");
    const ExchangeVault = await getContractFactory("ExchangeVault");

    const usdt  = await MockERC20.deploy("Mock USDT", "USDT", 6, admin.address);
    await usdt.waitForDeployment();

    const vault = await ExchangeVault.deploy(admin.address);
    await vault.waitForDeployment();

    const usdtAddr  = await usdt.getAddress();
    const vaultAddr = await vault.getAddress();

    // Set usdt as supported
    await (await vault.connect(admin).setSupportedToken(usdtAddr, true)).wait();

    // Mint tokens for users
    const MINTER_ROLE = await usdt.MINTER_ROLE();
    await (await usdt.connect(admin).grantRole(MINTER_ROLE, admin.address)).wait();
    await (await usdt.connect(admin).mint(user1.address, DEPOSIT_AMOUNT * 10n)).wait();
    await (await usdt.connect(admin).mint(user2.address, DEPOSIT_AMOUNT * 10n)).wait();
    await (await usdt.connect(admin).mint(attacker.address, DEPOSIT_AMOUNT * 10n)).wait();

    return { vault, usdt, admin, user1, user2, attacker, usdtAddr, vaultAddr };
  }

  // ── deposit() happy path ──────────────────────────────────────────────────
  describe("deposit() — happy path", () => {
    it("deposit after approve — vault receives tokens", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT);
      expect(await usdt.balanceOf(user1.address)).to.equal(DEPOSIT_AMOUNT * 9n);
    });

    it("emits Deposited(accountReference, depositor, token, amount)", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await expect(vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1))
        .to.emit(vault, "Deposited")
        .withArgs(REF_1, user1.address, usdtAddr, DEPOSIT_AMOUNT);
    });

    it("two different users can use same accountReference (different depositKey)", async () => {
      const { vault, usdt, user1, user2, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await (await usdt.connect(user2).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      // Same REF_1 — different msg.sender → different depositKey → OK
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      await (await vault.connect(user2).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT * 2n);
    });
  });

  // ── accountReference is one-time per depositor ────────────────────────────
  describe("accountReference is one-time per depositor", () => {
    it("same depositor reuses same ref → DepositReferenceAlreadyUsed", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT * 2n)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      await expect(vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1))
        .to.be.revertedWithCustomError(vault, "DepositReferenceAlreadyUsed");
    });

    it("same depositor with different ref — success (each Intent needs new ref)", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT * 2n)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_2)).wait();
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT * 2n);
    });
  });

  // ── deposit() reverts ─────────────────────────────────────────────────────
  describe("deposit() — reverts", () => {
    it("unsupported token → UnsupportedToken", async () => {
      const { vault, user1, admin } = await deploy();
      await expect(vault.connect(user1).deposit(admin.address, DEPOSIT_AMOUNT, REF_1))
        .to.be.revertedWithCustomError(vault, "UnsupportedToken");
    });

    it("amount = 0 → InvalidAmount", async () => {
      const { vault, user1, usdtAddr } = await deploy();
      await expect(vault.connect(user1).deposit(usdtAddr, 0n, REF_1))
        .to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("accountReference = bytes32(0) → InvalidAccountReference", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await expect(vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, ZERO_REF))
        .to.be.revertedWithCustomError(vault, "InvalidAccountReference");
    });

    it("no ERC20 approval → reverts", async () => {
      const { vault, user1, usdtAddr } = await deploy();
      await expect(vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1))
        .to.be.reverted;
    });

    it("paused → EnforcedPause", async () => {
      const { vault, usdt, user1, admin, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await (await vault.connect(admin).pause()).wait();
      await expect(vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1))
        .to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("cannot receive native ETH → reverts", async () => {
      const { vault, user1 } = await deploy();
      await expect(
        user1.sendTransaction({ to: await vault.getAddress(), value: ethersLib.parseEther("1") })
      ).to.be.reverted;
    });
  });

  // ── Reentrancy check ──────────────────────────────────────────────────────
  describe("Reentrancy protection", () => {
    it("nonReentrant guard: contract not stuck after first deposit — sequential deposits work", async () => {
      // Standard ERC20 không có reentrancy callback
      // Test verify: sau lần deposit 1, contract không bị stuck, lần 2 (ref khác) vẫn thành công
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT * 2n)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_2)).wait();
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT * 2n);
    });
  });

  // ── recoverERC20() ────────────────────────────────────────────────────────
  describe("recoverERC20()", () => {
    async function deployWithStray() {
      const base = await deploy();
      const { admin, vault } = base;

      // Deploy stray token (NOT supported in vault)
      const MockERC20  = await getContractFactory("MockERC20");
      const strayToken = await MockERC20.deploy("Stray", "STR", 18, admin.address);
      await strayToken.waitForDeployment();
      const MINTER_ROLE = await strayToken.MINTER_ROLE();
      await (await strayToken.connect(admin).grantRole(MINTER_ROLE, admin.address)).wait();
      // Mint directly into vault (simulating accidental transfer)
      await (await strayToken.connect(admin).mint(await vault.getAddress(), ethersLib.parseEther("100"))).wait();

      return { ...base, strayToken };
    }

    it("admin recovers unsupported stray token", async () => {
      const { vault, admin, strayToken } = await deployWithStray();
      const amount = ethersLib.parseEther("100");
      await (await vault.connect(admin).recoverERC20(await strayToken.getAddress(), admin.address, amount)).wait();
      expect(await strayToken.balanceOf(admin.address)).to.equal(amount);
      expect(await strayToken.balanceOf(await vault.getAddress())).to.equal(0n);
    });

    it("emits ERC20Recovered(token, to, amount)", async () => {
      const { vault, admin, strayToken } = await deployWithStray();
      const amount = ethersLib.parseEther("100");
      await expect(vault.connect(admin).recoverERC20(await strayToken.getAddress(), admin.address, amount))
        .to.emit(vault, "ERC20Recovered")
        .withArgs(await strayToken.getAddress(), admin.address, amount);
    });

    it("cannot recover supported token → CannotRecoverSupportedToken", async () => {
      const { vault, admin, usdtAddr } = await deploy();
      await expect(vault.connect(admin).recoverERC20(usdtAddr, admin.address, 1n))
        .to.be.revertedWithCustomError(vault, "CannotRecoverSupportedToken");
    });

    it("recover to address(0) → ZeroAddress", async () => {
      const { vault, admin, strayToken } = await deployWithStray();
      await expect(
        vault.connect(admin).recoverERC20(await strayToken.getAddress(), ethersLib.ZeroAddress, 1n)
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("non-admin cannot recover → AccessControl revert", async () => {
      const { vault, attacker, strayToken } = await deployWithStray();
      await expect(
        vault.connect(attacker).recoverERC20(await strayToken.getAddress(), attacker.address, 1n)
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("after setSupportedToken(false), admin can recover previously supported token", async () => {
      const { vault, usdt, admin, usdtAddr } = await deploy();
      // Mint directly into vault
      await (await usdt.connect(admin).mint(await vault.getAddress(), 1000n)).wait();
      // Unsupport first
      await (await vault.connect(admin).setSupportedToken(usdtAddr, false)).wait();
      // Now can recover
      await (await vault.connect(admin).recoverERC20(usdtAddr, admin.address, 1000n)).wait();
      expect(await usdt.balanceOf(admin.address)).to.equal(1000n);
    });
  });

  // ── Admin permissions ─────────────────────────────────────────────────────
  describe("Admin permissions", () => {
    it("non-admin cannot setSupportedToken → AccessControl revert", async () => {
      const { vault, attacker, usdtAddr } = await deploy();
      await expect(vault.connect(attacker).setSupportedToken(usdtAddr, false))
        .to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("non-admin cannot pause → AccessControl revert", async () => {
      const { vault, attacker } = await deploy();
      await expect(vault.connect(attacker).pause())
        .to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("admin can pause and unpause", async () => {
      const { vault, usdt, user1, admin, vaultAddr, usdtAddr } = await deploy();
      await (await vault.connect(admin).pause()).wait();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await expect(vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1))
        .to.be.revertedWithCustomError(vault, "EnforcedPause");
      await (await vault.connect(admin).unpause()).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT);
    });

    it("setSupportedToken emits TokenSupportUpdated", async () => {
      const { vault, admin, usdtAddr } = await deploy();
      await expect(vault.connect(admin).setSupportedToken(usdtAddr, false))
        .to.emit(vault, "TokenSupportUpdated")
        .withArgs(usdtAddr, false);
    });
  });
});
