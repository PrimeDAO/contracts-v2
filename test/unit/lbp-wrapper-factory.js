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

describe.only(">> Contract: WrapperFactory", () => {
  let setup, swapsEnabled;
  let tokenAddresses, admin, owner, sortedTokens, newOwner;

  const startTime = Date.now();
  const endTime = startTime + 100000;

  const NAME = "SEED-MKR POOL";
  const SYMBOL = "SEED-MKR";

  const START_WEIGHTS = [0.7e18, 0.3e18].map((weight) => weight.toString());
  const END_WEIGHTS = [0.3e18, 0.7e18].map((weight) => weight.toString());
  const ADMIN_BALANCE = [32.667e18, 30000e6].map((balance) =>
    balance.toString()
  );

  const SWAP_FEE_PERCENTAGE = (0.5e16).toString(); // 0.5%
  const JOIN_KIND_INIT = 0;
  const ZERO_ADDRESS = constants.ZERO_ADDRESS;
  30000000000;

  context("» deploy LBP WrapperFactory", () => {
    beforeEach("!! setup", async () => {
      setup = await deploy();

      swapsEnabled = true;

      ({ root: owner, prime: admin, beneficiary: newOwner } = setup.roles);
      sortedTokens = sortTokens(setup.tokenList);
      // Need to solve this in tokens.js helper file for > 2 tokens.
      tokenAddresses = sortedTokens.map((token) => token.address);
    });
    it("$ deploy WrapperFactory", async () => {
      setup.wrapperFactory = await init.getContractInstance(
        "WrapperFactory",
        owner,
        [setup.lbpFactory.address, SWAP_FEE_PERCENTAGE]
      );
      expect(await setup.wrapperFactory.LBPFactory()).to.equal(
        setup.lbpFactory.address
      );
      expect(await setup.wrapperFactory.swapFeePercentage()).to.equal(
        SWAP_FEE_PERCENTAGE
      );
    });
  });
  context("» set MasterCopy of LBPWrapper", () => {
    it("$ reverts on zero address", async () => {
      await expectRevert(
        setup.wrapperFactory.setMasterCopy(ZERO_ADDRESS),
        "WrapperFactory: mastercopy cannot be zero"
      );
    });
    it("$ reverts on same address as WrapperFactory", async () => {
      await expectRevert(
        setup.wrapperFactory.setMasterCopy(setup.wrapperFactory.address),
        "WrapperFactory: mastercopy cannot be the same as WrapperFactory"
      );
    });
    it("$ reverts on called not by owner", async () => {
      await expectRevert(
        setup.wrapperFactory
          .connect(admin)
          .setMasterCopy(setup.lbpWrapper.address),
        "Ownable: caller is not the owner"
      );
    });
    it("$ succeeds on valid master copy", async () => {
      await setup.wrapperFactory.setMasterCopy(setup.lbpWrapper.address);
      expect(await setup.wrapperFactory.wrapperMasterCopy()).to.equal(
        setup.lbpWrapper.address
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
      const tx = await setup.wrapperFactory
        .connect(owner)
        .deployLBPUsingWrapper(...params);
      const receipt = await tx.wait();

      const args = receipt.events.filter((data) => {
        return data.event === "LBPDeployedUsingWrapper";
      })[0].args;

      setup.lbp = setup.Lbp.attach(args.lbp);
      expect(await setup.lbp.getOwner()).to.equal(args.wrapper);
      expect(await args.admin).to.equal(admin.address);
    });
  });
});
