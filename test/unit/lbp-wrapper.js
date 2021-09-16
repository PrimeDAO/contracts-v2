const { expect } = require("chai");
const { ethers, artifacts } = require("hardhat");
const { parseEther } = ethers.utils;

const init = require("../test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const { constants } = require("@openzeppelin/test-helpers");
const VaultArtifact = require("../../imports/Vault.json");
const { parseUnits, formatUnits, big } = require("@ethersproject/units");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.vault = await balancer.getVaultInstance(setup);

  setup.lbpFactory = await balancer.getLbpFactoryInstance(setup);

  setup.Lbp = balancer.getLbpFactory(setup);

  setup.LBPWrapper = await init.getLBPWrapperFactory(setup);

  setup.tokenList = await tokens.getErc20TokenInstances(2, setup.roles.root);

  return setup;
};

function sortTokens(tokens) {
  if (tokens[0].address > tokens[1].address) {
    const temp = tokens[0];
    tokens[0] = tokens[1];
    tokens[1] = temp;
  }

  return tokens;
}

describe.only("Contract: LBPWrapper", async () => {
  let setup;
  let swapsEnabled;
  let tokenAddresses;
  let sortedTokens;
  const NAME = "Test";
  const SYMBOL = "TT";
  let startTime = Date.now();
  let endTime = startTime + 100000;
  let WEIGHTS = [parseEther("0.6").toString(), parseEther("0.4")];
  const HUNDRED_PERCENT = parseUnits("10", 18);
  const FIVE_PERCENT = parseUnits("10", 16).mul(5);
  const INITIAL_BALANCES = [parseUnits("2000", 18), parseUnits("1000", 18)];
  const END_WEIGHTS = [parseEther("0.4").toString(), parseEther("0.6")];
  const POOL_SWAP_FEE_PERCENTAGE = parseEther("0.01").toString();
  const NEW_SWAP_FEE_PERCENTAGE = parseEther("0.02").toString();
  const SWAP_FEE_PERCENTAGE = parseUnits("1", 16);
  const JOIN_KIND_INIT = 0;
  const PRIME_DAO_FEE_PERCENTAGE = parseUnits("5", 17);

  const fromInternalBalance = false;
  let userData, poolId, admin, owner, beneficiary, amountToAddForFee;

  context(">> deploy LBP Wrapper", async () => {
    before("!! setup", async () => {
      setup = await deploy();
      swapsEnabled = true;

      sortedTokens = sortTokens(setup.tokenList);
      tokenAddresses = sortedTokens.map((token) => token.address);
      ({ root: owner, prime: admin, beneficiary: beneficiary } = setup.roles);
    });
    it("$ deploy LBPWrapper", async () => {
      setup.lbpWrapper = await setup.LBPWrapper.deploy();
    });
  });
  context(">> deploy LBP using Wrapper", async () => {
    it("$ success", async () => {
      await setup.lbpWrapper
        .connect(owner)
        .initializeLBP(
          setup.lbpFactory.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          SWAP_FEE_PERCENTAGE,
          PRIME_DAO_FEE_PERCENTAGE,
          beneficiary.address
        );
      setup.lbp = setup.Lbp.attach(await setup.lbpWrapper.lbp());
      poolId = await setup.lbp.getPoolId();

      expect(await setup.lbpWrapper.lbp()).not.equal(constants.ZERO_ADDRESS);
      expect(await setup.lbpWrapper.beneficiary()).to.equal(
        beneficiary.address
      );
      expect(await setup.lbpWrapper.primeDaoFeePercentage()).to.equal(
        PRIME_DAO_FEE_PERCENTAGE
      );
    });

    it("$ reverts when invoking it again", async () => {
      await expect(
        setup.lbpWrapper
          .connect(admin)
          .initializeLBP(
            setup.lbpFactory.address,
            NAME,
            SYMBOL,
            tokenAddresses,
            WEIGHTS,
            startTime,
            endTime,
            END_WEIGHTS,
            SWAP_FEE_PERCENTAGE,
            PRIME_DAO_FEE_PERCENTAGE,
            beneficiary.address
          )
      ).to.be.revertedWith("LBPWrapper: already initialized");
    });
  });
  context(">> transfers ownership to admin", async () => {
    it("$ reverts when new owner address is zero", async () => {
      await expect(
        setup.lbpWrapper
          .connect(owner)
          .transferAdminRights(constants.ZERO_ADDRESS)
      ).to.be.revertedWith("LBPWrapper: new owner cannot be zero");
    });
    it("$ success", async () => {
      await setup.lbpWrapper.connect(owner).transferAdminRights(admin.address);
      expect(await setup.lbpWrapper.admin()).to.equal(admin.address);
    });
  });
  context(">> add liquidity to the pool", async () => {
    before("!! transfer balances", async () => {
      userData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256[]"],
        [JOIN_KIND_INIT, INITIAL_BALANCES]
      );
      await setup.tokenList[0]
        .connect(owner)
        .transfer(admin.address, INITIAL_BALANCES[0].mul(2).toString());
      await setup.tokenList[1]
        .connect(owner)
        .transfer(admin.address, INITIAL_BALANCES[1].mul(2).toString());

      // Add fee amount on top
      amountToAddForFee = INITIAL_BALANCES[0]
        .mul(PRIME_DAO_FEE_PERCENTAGE)
        .div(HUNDRED_PERCENT);
      INITIAL_BALANCES[0] = INITIAL_BALANCES[0].add(amountToAddForFee);

      await setup.tokenList[0]
        .connect(admin)
        .transfer(setup.lbpWrapper.address, INITIAL_BALANCES[0].toString());
      await setup.tokenList[1]
        .connect(admin)
        .transfer(setup.lbpWrapper.address, INITIAL_BALANCES[1].toString());
    });
    it("$ reverts when not called by owner", async () => {
      await expect(
        setup.lbpWrapper
          .connect(owner)
          .fundPool(
            tokenAddresses,
            INITIAL_BALANCES,
            owner.address,
            fromInternalBalance,
            userData
          )
      ).to.be.revertedWith("LBPWrapper: admin owner function");
    });

    it("$ add liquidity to the pool", async () => {
      const eventName = "PoolBalanceChanged";
      const { abi } = VaultArtifact;
      const vaultInterface = new ethers.utils.Interface(abi);

      expect((await setup.lbp.balanceOf(owner.address)).toString()).to.equal(
        "0"
      );
      // check balance of beneficiary before joinPool()
      expect(await sortedTokens[0].balanceOf(beneficiary.address)).to.equal(0);

      const tx = await setup.lbpWrapper
        .connect(admin)
        .fundPool(
          tokenAddresses,
          INITIAL_BALANCES,
          owner.address,
          fromInternalBalance,
          userData
        );

      const receipt = await tx.wait();
      const vaultAddress = setup.vault.address;
      const vaultEvent = receipt.events.find(
        (log) => log.address === vaultAddress
      );
      const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);

      expect(decodedVaultEvent.name).to.equal(eventName);
      expect(decodedVaultEvent.args[0]).to.equal(poolId);
      expect(decodedVaultEvent.args[1]).to.equal(setup.lbpWrapper.address);
      expect(decodedVaultEvent.args[2][0]).to.equal(tokenAddresses[0]);
      expect(decodedVaultEvent.args[2][1]).to.equal(tokenAddresses[1]);
      expect((await setup.lbp.balanceOf(owner.address)).toString()).not.equal(
        "0"
      );
      // Check balance beneficiary after joinPool()
      expect(await sortedTokens[0].balanceOf(beneficiary.address)).to.equal(
        amountToAddForFee
      );
    });
    it("$ revert when adding liquidity more then once", async () => {
      await expect(
        setup.lbpWrapper
          .connect(admin)
          .fundPool(
            tokenAddresses,
            INITIAL_BALANCES,
            owner.address,
            fromInternalBalance,
            userData
          )
      ).to.be.revertedWith("LBPWrapper: pool has already been funded");
    });
  });
  context(">> pause the LBP", async () => {
    it("$ revert on being called by not the owner", async () => {
      await expect(
        setup.lbpWrapper.connect(owner).setSwapEnabled(false)
      ).to.be.revertedWith("LBPWrapper: admin owner function");
    });
    it("$ pauses the LBP", async () => {
      await setup.lbpWrapper.connect(admin).setSwapEnabled(false);
      expect(await setup.lbp.getSwapEnabled()).to.equal(false);
    });
  });
});
