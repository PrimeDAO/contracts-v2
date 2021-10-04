const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther, parseUnits } = ethers.utils;

const init = require("../test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const { constants, BN, expectRevert } = require("@openzeppelin/test-helpers");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.vault = await balancer.getVaultInstance();

  setup.lbpFactory = await balancer.getLbpFactoryInstance(setup.vault);

  setup.lbpManager = await init.getContractInstance(
    "LBPManager",
    setup.roles.root
  );

  setup.Lbp = balancer.getLbpFactory(setup.roles.root);

  setup.tokenList = await tokens.getErc20TokenInstances(2, setup.roles.root);

  return setup;
};

describe(">> Contract: LBPManagerFactory", () => {
  let setup, primeDaoFeePercentage, beneficiary;
  let tokenAddresses, admin, owner, sortedTokens, newLBPFactory;

  const startTime = Date.now();
  const endTime = startTime + 100000;

  const NAME = "SEED-MKR POOL";
  const SYMBOL = "SEED-MKR";

  const amounts = [1e18, 10e18].map((amount) => amount.toString());
  const START_WEIGHTS = [0.7e18, 0.3e18].map((weight) => weight.toString());
  const END_WEIGHTS = [0.3e18, 0.7e18].map((weight) => weight.toString());
  const ADMIN_BALANCE = [32.667e18, 30000e6].map((balance) =>
    balance.toString()
  );
  const SWAP_FEE_PERCENTAGE = (1e12).toString();
  const SWAP_FEE_PERCENTAGE_CHANGED = (1e16).toString();
  const TO_LOW_SWAP_FEE_PERCENTAGE = 1e10;
  const TO_HIGH_SWAP_FEE_PERCENTAGE = (1e18).toString();
  const PRIME_DAO_FEE_PERCENTAGE = parseUnits("5", 17);

  const ZERO_ADDRESS = constants.ZERO_ADDRESS;

  context("» deploy LBP LBPManagerFactory", () => {
    beforeEach("!! setup", async () => {
      setup = await deploy();

      primeDaoFeePercentage = 10;

      ({ root: owner, prime: admin, beneficiary: beneficiary } = setup.roles);

      tokenAddresses = setup.tokenList.map((token) => token.address);
    });
    it("$ revert on deploy LBPManagerFactory with zero address LBPFactory", async () => {
      await expect(
        init.getContractInstance("LBPManagerFactory", owner, [ZERO_ADDRESS])
      ).to.be.revertedWith("LBPManagerFactory: LBPFactory can not be zero");
    });
    it("$ deploy LBPManagerFactory", async () => {
      setup.lbpManagerFactory = await init.getContractInstance(
        "LBPManagerFactory",
        owner,
        [setup.lbpFactory.address]
      );
      expect(await setup.lbpManagerFactory.LBPFactory()).to.equal(
        setup.lbpFactory.address
      );
    });
  });
  context("» set MasterCopy of LBPManager", () => {
    let params;
    before("!! setup for deploying LBPManager", async () => {
      params = [
        admin.address,
        beneficiary.address,
        NAME,
        SYMBOL,
        tokenAddresses,
        amounts,
        START_WEIGHTS,
        [startTime, endTime],
        END_WEIGHTS,
        SWAP_FEE_PERCENTAGE,
        primeDaoFeePercentage,
      ];
    });
    it("$ reverts if deploying LBPManager & mastercopy is not set", async () => {
      await expect(
        setup.lbpManagerFactory.connect(owner).deployLBPUsingManager(...params)
      ).to.be.revertedWith(
        "LBPManagerFactory: LBPManager mastercopy is not set"
      );
    });
    it("$ reverts on zero address", async () => {
      await expect(
        setup.lbpManagerFactory.setMasterCopy(ZERO_ADDRESS)
      ).to.be.revertedWith("address can not be zero");
    });
    it("$ reverts on same address as LBPManagerFactory", async () => {
      await expect(
        setup.lbpManagerFactory.setMasterCopy(setup.lbpManagerFactory.address)
      ).to.be.revertedWith(
        "LBPManagerFactory: address can not be the same as LBPManagerFactory"
      );
    });
    it("$ reverts on called not by owner", async () => {
      await expect(
        setup.lbpManagerFactory
          .connect(admin)
          .setMasterCopy(setup.lbpManager.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("$ succeeds on valid master copy", async () => {
      await setup.lbpManagerFactory.setMasterCopy(setup.lbpManager.address);
      expect(await setup.lbpManagerFactory.masterCopy()).to.equal(
        setup.lbpManager.address
      );
    });
  });
  context("» set new LBPFactory", () => {
    before("!! deploy new LBP Factory", async () => {
      newLBPFactory = await balancer.getLbpFactoryInstance(setup.vault);
    });
    it("$ reverts on zero address", async () => {
      await expect(
        setup.lbpManagerFactory.setLBPFactory(ZERO_ADDRESS)
      ).to.be.revertedWith("LBPManagerFactory: address can not be zero");
    });
    it("$ reverts on same address as LBPManagerFactory", async () => {
      await expect(
        setup.lbpManagerFactory.setLBPFactory(setup.lbpManagerFactory.address)
      ).to.be.revertedWith(
        "LBPManagerFactory: address can not be the same as LBPManagerFactory"
      );
    });
    it("$ reverts on called not by owner", async () => {
      await expect(
        setup.lbpManagerFactory
          .connect(admin)
          .setLBPFactory(newLBPFactory.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("$ succeeds on valid master copy", async () => {
      await setup.lbpManagerFactory.setLBPFactory(newLBPFactory.address);
      expect(await setup.lbpManagerFactory.LBPFactory()).to.equal(
        newLBPFactory.address
      );
    });
  });
  context("» deploy LBP using LBPManager with wrong values", () => {
    let params;
    it("$ reverts on invalid swapFeePercentage", async () => {
      params = [
        admin.address,
        beneficiary.address,
        NAME,
        SYMBOL,
        tokenAddresses,
        amounts,
        START_WEIGHTS,
        [startTime, endTime],
        END_WEIGHTS,
        TO_LOW_SWAP_FEE_PERCENTAGE,
        primeDaoFeePercentage,
      ];
      await expect(
        setup.lbpManagerFactory.connect(owner).deployLBPUsingManager(...params)
      ).to.be.revertedWith(
        "BAL#203" //MIN_SWAP_FEE_PERCENTAGE
      );

      params = [
        admin.address,
        beneficiary.address,
        NAME,
        SYMBOL,
        tokenAddresses,
        amounts,
        START_WEIGHTS,
        [startTime, endTime],
        END_WEIGHTS,
        TO_HIGH_SWAP_FEE_PERCENTAGE,
        primeDaoFeePercentage,
      ];
      await expect(
        setup.lbpManagerFactory.connect(owner).deployLBPUsingManager(...params)
      ).to.be.revertedWith(
        "BAL#202" //MAX_SWAP_FEE_PERCENTAGE
      );
    });
    it("$ reverts on invalid beneficiary address", async () => {
      params = [
        admin.address,
        ZERO_ADDRESS,
        NAME,
        SYMBOL,
        tokenAddresses,
        amounts,
        START_WEIGHTS,
        [startTime, endTime],
        END_WEIGHTS,
        SWAP_FEE_PERCENTAGE_CHANGED,
        primeDaoFeePercentage,
      ];
      await expect(
        setup.lbpManagerFactory.connect(owner).deployLBPUsingManager(...params)
      ).to.be.revertedWith("LBPManager: _beneficiary can not be zero address");
    });
    it("$ reverts on to large token list array", async () => {
      const largeTokenList = await tokens.getErc20TokenInstances(4, owner);
      const largeTokenListAddresses = largeTokenList.map(
        (token) => token.address
      );

      params = [
        admin.address,
        beneficiary.address,
        NAME,
        SYMBOL,
        largeTokenListAddresses,
        amounts,
        START_WEIGHTS,
        [startTime, endTime],
        END_WEIGHTS,
        SWAP_FEE_PERCENTAGE_CHANGED,
        primeDaoFeePercentage,
      ];
      await expect(
        setup.lbpManagerFactory.connect(owner).deployLBPUsingManager(...params)
      ).to.be.revertedWith("LBPManager: token list size is not 2");
    });
  });
  context("» deploy LBP using LBPManager", () => {
    let params;
    before("!! setup for deploying LBPManager", async () => {
      params = [
        admin.address,
        beneficiary.address,
        NAME,
        SYMBOL,
        tokenAddresses,
        amounts,
        START_WEIGHTS,
        [startTime, endTime],
        END_WEIGHTS,
        SWAP_FEE_PERCENTAGE_CHANGED,
        primeDaoFeePercentage,
      ];
    });
    it("$ deploys LBP successful", async () => {
      const tx = await setup.lbpManagerFactory
        .connect(owner)
        .deployLBPUsingManager(...params);
      const receipt = await tx.wait();

      const args = receipt.events.filter((data) => {
        return data.event === "LBPDeployedUsingManager";
      })[0].args;

      setup.lbp = setup.Lbp.attach(args.lbp);
      expect(await setup.lbp.getOwner()).to.equal(args.lbpManager);
      expect(await args.admin).to.equal(admin.address);
      expect(await args.primeDaoAddress).to.equal();
    });
  });
});
