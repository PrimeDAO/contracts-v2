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
  let setup, fee, beneficiary;
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
  const ZERO_ADDRESS = constants.ZERO_ADDRESS;
  const METADATA = "0x";
  const PRIME_FEE = 10;

  context("» deploy LBP LBPManagerFactory", () => {
    beforeEach("!! setup", async () => {
      setup = await deploy();

      fees = [SWAP_FEE_PERCENTAGE, 10];

      ({ root: owner, prime: admin, beneficiary: beneficiary } = setup.roles);

      tokenAddresses = setup.tokenList.map((token) => token.address);
    });
    it("$ revert on deploy LBPManagerFactory with zero address LBPFactory", async () => {
      await expect(
        init.getContractInstance("LBPManagerFactory", owner, [ZERO_ADDRESS])
      ).to.be.revertedWith("LBPMFactory: LBPFactory is zero");
    });
    it("$ deploy LBPManagerFactory", async () => {
      setup.lbpManagerFactory = await init.getContractInstance(
        "LBPManagerFactory",
        owner,
        [setup.lbpFactory.address]
      );
      expect(await setup.lbpManagerFactory.lbpFactory()).to.equal(
        setup.lbpFactory.address
      );
    });
  });
  context("» set MasterCopy of LBPManager", () => {
    let params;
    before("!! setup for deploying LBPManager", async () => {
      fees = [SWAP_FEE_PERCENTAGE, PRIME_FEE];
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
        fees,
        METADATA,
      ];
    });
    it("$ reverts if deploying LBPManager & mastercopy is not set", async () => {
      await expect(
        setup.lbpManagerFactory.connect(owner).deployLBPManager(...params)
      ).to.be.revertedWith("LBPMFactory: LBPManager mastercopy not set");
    });
    it("$ reverts on zero address", async () => {
      await expect(
        setup.lbpManagerFactory.setMasterCopy(ZERO_ADDRESS)
      ).to.be.revertedWith("LBPMFactory: address is zero");
    });
    it("$ reverts on same address as LBPManagerFactory", async () => {
      await expect(
        setup.lbpManagerFactory.setMasterCopy(setup.lbpManagerFactory.address)
      ).to.be.revertedWith("LBPMFactory: address same as LBPManagerFactory");
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
    it("$ set new mastercopy", async () => {
      const newMasterCopy = await init.getContractInstance(
        "LBPManager",
        setup.roles.root
      );
      await expect(setup.lbpManagerFactory.setMasterCopy(newMasterCopy.address))
        .to.emit(setup.lbpManagerFactory, "MastercopyChanged")
        .withArgs(setup.lbpManager.address, newMasterCopy.address);
      expect(await setup.lbpManagerFactory.masterCopy()).to.equal(
        newMasterCopy.address
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
      ).to.be.revertedWith("LBPMFactory: address is zero");
    });
    it("$ reverts on same address as LBPManagerFactory", async () => {
      await expect(
        setup.lbpManagerFactory.setLBPFactory(setup.lbpManagerFactory.address)
      ).to.be.revertedWith("LBPMFactory: address same as LBPManagerFactory");
    });
    it("$ reverts on called not by owner", async () => {
      await expect(
        setup.lbpManagerFactory
          .connect(admin)
          .setLBPFactory(newLBPFactory.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("$ succeeds on valid LBPFactory copy", async () => {
      await expect(setup.lbpManagerFactory.setLBPFactory(newLBPFactory.address))
        .to.emit(setup.lbpManagerFactory, "LBPFactoryChanged")
        .withArgs(setup.lbpFactory.address, newLBPFactory.address);
      expect(await setup.lbpManagerFactory.lbpFactory()).to.equal(
        newLBPFactory.address
      );
    });
  });
  context("» deploy LBP using LBPManager with wrong values", () => {
    let params;
    it("$ reverts on invalid beneficiary address", async () => {
      fees = [SWAP_FEE_PERCENTAGE_CHANGED, PRIME_FEE];
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
        fees,
        METADATA,
      ];
      await expect(
        setup.lbpManagerFactory.connect(owner).deployLBPManager(...params)
      ).to.be.revertedWith("LBPManager: _beneficiary is zero");
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
        fees,
        METADATA,
      ];
    });
    it("$ deploys LBP successful", async () => {
      const tx = await setup.lbpManagerFactory
        .connect(owner)
        .deployLBPManager(...params);
      const receipt = await tx.wait();

      const args = receipt.events.filter((data) => {
        return data.event === "LBPManagerDeployed";
      })[0].args;

      expect(args[1]).to.equal(admin.address);
      expect(args[2]).to.equal(METADATA);
    });
  });
});
