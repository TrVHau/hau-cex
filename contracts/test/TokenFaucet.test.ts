import { expect } from "chai";
import { getSigners, getFactory, increaseTime, assertReverts, assertEmitted } from "./helpers/contract.js";

const CLAIM_AMOUNT = 1_000n * 10n ** 6n; // 1,000 USDT (6 decimals)
const ONE_DAY      = 86_400n;            // 86400 giây

describe("TokenFaucet", () => {
  // ─── Deploy helper ──────────────────────────────────────────────────────────
  async function deploy() {
    const [admin, user1, user2, attacker] = await getSigners();

    const USDT    = await getFactory("MockERC20");
    const Faucet  = await getFactory("TokenFaucet");

    const usdt   = await USDT.deploy("Mock USDT", "USDT", 6, admin.address);
    await usdt.waitForDeployment();

    const faucet = await Faucet.deploy(admin.address);
    await faucet.waitForDeployment();

    // Grant MINTER_ROLE cho Faucet để nó mint khi claim
    const MINTER_ROLE = await usdt.MINTER_ROLE();
    await (await usdt.connect(admin).grantRole(MINTER_ROLE, await faucet.getAddress())).wait();

    // Cấu hình: usdt supported, 1000 USDT/ngày
    await (
      await faucet.connect(admin).setTokenConfig(
        await usdt.getAddress(), true, CLAIM_AMOUNT, ONE_DAY,
      )
    ).wait();

    return { faucet, usdt, admin, user1, user2, attacker };
  }

  // ─── claim() happy path ─────────────────────────────────────────────────────
  describe("claim() — happy path", () => {
    it("user claim thành công, nhận đúng claimAmount", async () => {
      const { faucet, usdt, user1 } = await deploy();
      await (await faucet.connect(user1).claim(await usdt.getAddress())).wait();
      expect(await usdt.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT);
    });

    it("emit TokenClaimed với args đúng", async () => {
      const { faucet, usdt, user1 } = await deploy();
      const usdtAddr = await usdt.getAddress();
      const receipt  = await (await faucet.connect(user1).claim(usdtAddr)).wait();
      assertEmitted(receipt, faucet, "TokenClaimed", [user1.address, usdtAddr, CLAIM_AMOUNT]);
    });

    it("hai user claim độc lập nhau", async () => {
      const { faucet, usdt, user1, user2 } = await deploy();
      const usdtAddr = await usdt.getAddress();
      await (await faucet.connect(user1).claim(usdtAddr)).wait();
      await (await faucet.connect(user2).claim(usdtAddr)).wait();
      expect(await usdt.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT);
      expect(await usdt.balanceOf(user2.address)).to.equal(CLAIM_AMOUNT);
    });

    it("user claim lần 2 sau khi cooldown hết", async () => {
      const { faucet, usdt, user1 } = await deploy();
      const usdtAddr = await usdt.getAddress();
      await (await faucet.connect(user1).claim(usdtAddr)).wait();
      await increaseTime(ONE_DAY); // advance 1 ngày
      await (await faucet.connect(user1).claim(usdtAddr)).wait();
      expect(await usdt.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT * 2n);
    });
  });

  // ─── claim() reverts ────────────────────────────────────────────────────────
  describe("claim() — reverts", () => {
    it("token không được support → UnsupportedToken", async () => {
      const { faucet, attacker } = await deploy();
      await assertReverts(faucet.connect(attacker).claim(attacker.address), "UnsupportedToken");
    });

    it("claim lần 2 trước cooldown → FaucetCooldownActive", async () => {
      const { faucet, usdt, user1 } = await deploy();
      const usdtAddr = await usdt.getAddress();
      await (await faucet.connect(user1).claim(usdtAddr)).wait();
      await assertReverts(faucet.connect(user1).claim(usdtAddr), "FaucetCooldownActive");
    });

    it("claim khi paused → EnforcedPause", async () => {
      const { faucet, usdt, user1, admin } = await deploy();
      await (await faucet.connect(admin).pause()).wait();
      await assertReverts(faucet.connect(user1).claim(await usdt.getAddress()), "EnforcedPause");
    });
  });

  // ─── Admin permissions ──────────────────────────────────────────────────────
  describe("Admin permissions", () => {
    it("non-admin setTokenConfig → revert", async () => {
      const { faucet, usdt, attacker } = await deploy();
      await assertReverts(
        faucet.connect(attacker).setTokenConfig(await usdt.getAddress(), true, 100n, 100n),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("non-admin pause → revert", async () => {
      const { faucet, attacker } = await deploy();
      await assertReverts(faucet.connect(attacker).pause(), "AccessControlUnauthorizedAccount");
    });

    it("non-admin unpause → revert", async () => {
      const { faucet, attacker, admin } = await deploy();
      await (await faucet.connect(admin).pause()).wait();
      await assertReverts(faucet.connect(attacker).unpause(), "AccessControlUnauthorizedAccount");
    });

    it("admin pause → unpause → claim thành công", async () => {
      const { faucet, usdt, user1, admin } = await deploy();
      await (await faucet.connect(admin).pause()).wait();
      await (await faucet.connect(admin).unpause()).wait();
      await (await faucet.connect(user1).claim(await usdt.getAddress())).wait();
      expect(await usdt.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT);
    });

    it("setSupportedToken, setClaimAmount, setClaimCooldown update state đúng", async () => {
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
