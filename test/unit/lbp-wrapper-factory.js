const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const init = require("../test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const { constants, BN, expectRevert } = require("@openzeppelin/test-helpers");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.vault = await balancer.getVaultInstance(setup);

  setup.lbpFactory = await balancer.getLbpFactoryInstance(setup);

  setup.lbpWrapper = await init.getContractInstance(
    "LBPWrapper",
    setup.roles.root
  );

  setup.Lbp = balancer.getLbpFactory(setup);

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

describe(">> Contract: LBPWrapperFactory", () => {
  let setup, swapsEnabled;
  let tokenAddresses, admin, owner, sortedTokens, newOwner, newLBPFactory;

  const startTime = Date.now();
  const endTime = startTime + 100000;

  const NAME = "SEED-MKR POOL";
  const SYMBOL = "SEED-MKR";

  const START_WEIGHTS = [0.7e18, 0.3e18].map(weight => weight.toString());
  const END_WEIGHTS = [0.3e18, 0.7e18].map(weight => weight.toString());
  const ADMIN_BALANCE = [32.667e18, 30000e6].map(balance => balance.toString());

  const JOIN_KIND_INIT = 0;
  const ZERO_ADDRESS = constants.ZERO_ADDRESS;
  30000000000;

  context("» deploy LBP LBPWrapperFactory", () => {
    beforeEach("!! setup", async () => {
      setup = await deploy();

      swapsEnabled = true;

      ({ root: owner, prime: admin, beneficiary: newOwner } = setup.roles);
      sortedTokens = sortTokens(setup.tokenList);
      // Need to solve this in tokens.js helper file for > 2 tokens.
      tokenAddresses = sortedTokens.map(token => token.address);
    });
    it("$ deploy LBPWrapperFactory", async () => {
      setup.LbpWrapperFactory = await init.getContractInstance(
        "LBPWrapperFactory",
        owner,
        [setup.lbpFactory.address]
      );
      expect(await setup.LbpWrapperFactory.LBPFactory()).to.equal(
        setup.lbpFactory.address
      );
    });
  });
  context("» set MasterCopy of LBPWrapper", () => {
    it("$ reverts on zero address", async () => {
      await expectRevert(
        setup.LbpWrapperFactory.setMasterCopy(ZERO_ADDRESS),
        "LBPWrapperFactory: mastercopy cannot be zero"
      );
    });
    it("$ reverts on same address as LBPWrapperFactory", async () => {
      await expectRevert(
        setup.LbpWrapperFactory.setMasterCopy(setup.LbpWrapperFactory.address),
        "LBPWrapperFactory: mastercopy cannot be the same as LBPWrapperFactory"
      );
    });
    it("$ reverts on called not by owner", async () => {
      await expectRevert(
        setup.LbpWrapperFactory.connect(admin).setMasterCopy(
          setup.lbpWrapper.address
        ),
        "Ownable: caller is not the owner"
      );
    });
    it("$ succeeds on valid master copy", async () => {
      await setup.LbpWrapperFactory.setMasterCopy(setup.lbpWrapper.address);
      expect(await setup.LbpWrapperFactory.wrapperMasterCopy()).to.equal(
        setup.lbpWrapper.address
      );
    });
  });
  context("» set new LBPFactory", () => {
    before("!! deploy new LBP Factory", async () => {
      newLBPFactory = await balancer.getLbpFactoryInstance(setup);
    });
    it("$ reverts on zero address", async () => {
      await expectRevert(
        setup.LbpWrapperFactory.setLBPFactory(ZERO_ADDRESS),
        "LBPWrapperFactory: LBPFactory cannot be zero"
      );
    });
    it("$ reverts on same address as LBPWrapperFactory", async () => {
      await expectRevert(
        setup.LbpWrapperFactory.setLBPFactory(setup.LbpWrapperFactory.address),
        "LBPWrapperFactory: LBPFactory cannot be the same as LBPWrapperFactory"
      );
    });
    it("$ reverts on called not by owner", async () => {
      await expectRevert(
        setup.LbpWrapperFactory.connect(admin).setLBPFactory(
          newLBPFactory.address
        ),
        "Ownable: caller is not the owner"
      );
    });
    it("$ succeeds on valid master copy", async () => {
      await setup.LbpWrapperFactory.setLBPFactory(newLBPFactory.address);
      expect(await setup.LbpWrapperFactory.LBPFactory()).to.equal(
        newLBPFactory.address
      );
    });
  });
  context("» deploy LBP using LBPWrapper", () => {
    let params;
    before("!! setup for deploying LBPWrapper", async () => {
      params = [
        NAME,
        SYMBOL,
        tokenAddresses,
        START_WEIGHTS,
        swapsEnabled,
        startTime,
        endTime,
        END_WEIGHTS,
        admin.address,
      ];
    });
    it("$ deploys LBP", async () => {
      const tx = await setup.LbpWrapperFactory.connect(
        owner
      ).deployLBPUsingWrapper(...params);
      const receipt = await tx.wait();

      const args = receipt.events.filter(data => {
        return data.event === "LBPDeployedUsingWrapper";
      })[0].args;

      setup.lbp = setup.Lbp.attach(args.lbp);
      expect(await setup.lbp.getOwner()).to.equal(args.wrapper);
      expect(await args.admin).to.equal(admin.address);
    });
  });
});
