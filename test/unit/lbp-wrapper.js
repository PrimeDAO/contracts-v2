const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const init = require("../test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const { constants } = require("@openzeppelin/test-helpers");

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
  const END_WEIGHTS = [parseEther("0.4").toString(), parseEther("0.6")];
  const POOL_SWAP_FEE_PERCENTAGE = parseEther("0.01").toString();
  const NEW_SWAP_FEE_PERCENTAGE = parseEther("0.02").toString();
  const JOIN_KIND_INIT = 0;

  const fromInternalBalance = false;
  let userData;

  context(">> deploy LBP Wrapper", async () => {
    before("!! setup", async () => {
      setup = await deploy();
      swapsEnabled = true;

      sortedTokens = sortTokens(setup.tokenList);
      tokenAddresses = sortedTokens.map((token) => token.address);
    });
    it("$ deploy LBPWrapper", async () => {
      setup.lbpWrapper = await setup.LBPWrapper.deploy();
    });
  });
  context(">> initialize LBPWrapper", async () => {
    it("success", async () => {
      await setup.lbpWrapper
        .connect(setup.roles.root)
        .initialize(setup.lbpFactory.address);
      expect(await setup.lbpWrapper.LBPFactory()).to.equal(
        setup.lbpFactory.address
      );
    });
  });
  context(">> deploy LBP using Wrapper", async () => {
    it("$ reverts when called by non-owner", async () => {
      await expect(
        setup.lbpWrapper
          .connect(setup.roles.prime)
          .deployLbpFromFactory(
            NAME,
            SYMBOL,
            tokenAddresses,
            WEIGHTS,
            swapsEnabled,
            startTime,
            endTime,
            END_WEIGHTS
          )
      ).to.be.revertedWith("LBPWrapper: only owner function");
    });
    it("$ success", async () => {
      await setup.lbpWrapper
        .connect(setup.roles.root)
        .deployLbpFromFactory(
          NAME,
          SYMBOL,
          tokenAddresses,
          WEIGHTS,
          swapsEnabled,
          startTime,
          endTime,
          END_WEIGHTS
        );
      expect(await setup.lbpWrapper.lbp()).not.equal(constants.ZERO_ADDRESS);
    });
  });
  context(">> transfers ownership to admin", async () => {
    it("$ reverts when new owner address is zero", async () => {
      await expect(
        setup.lbpWrapper
          .connect(setup.roles.root)
          .transferOwnership(constants.ZERO_ADDRESS)
      ).to.be.revertedWith("LBPWrapper: new owner cannot be zero");
    });
    it("$ success", async () => {
      await setup.lbpWrapper
        .connect(setup.roles.root)
        .transferOwnership(setup.roles.prime.address);
      expect(await setup.lbpWrapper.owner()).to.equal(
        setup.roles.prime.address
      );
    });
  });
  context(">> add liquidity to the pool", async () => {
    beforeEach("!! transfer balances", async () => {
      await setup.tokenList[0]
        .connect(setup.roles.root)
        .transfer(setup.roles.prime.address, WEIGHTS[0]);
      await setup.tokenList[1]
        .connect(setup.roles.root)
        .transfer(setup.roles.prime.address, WEIGHTS[1]);
      await setup.tokenList[0]
        .connect(setup.roles.prime)
        .transfer(setup.lbpWrapper.address, WEIGHTS[0]);
      await setup.tokenList[1]
        .connect(setup.roles.prime)
        .transfer(setup.lbpWrapper.address, WEIGHTS[1]);
      userData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256[]"],
        [JOIN_KIND_INIT, WEIGHTS]
      );
    });
    it("$ reverts when not called by owner", async () => {
      await expect(
        setup.lbpWrapper
          .connect(setup.roles.root)
          .addLiquidityToLbp(
            tokenAddresses,
            fromInternalBalance,
            userData,
            WEIGHTS
          )
      ).to.be.revertedWith("LBPWrapper: only owner function");
    });
    it("$ add liquidity to the pool", async () => {
      // const tx = await setup.lbpWrapper
      //   .connect(setup.roles.prime)
      //   .addLiquidityToLbp(
      //     tokenAddresses,
      //     fromInternalBalance,
      //     userData,
      //     WEIGHTS
      //   );
        // const receipt = await tx.wait();
        // const eventSignature = "PoolBalanceChanged";
        // const cloneCreationEvent = receipt.events.find(
        //   (log) => log.eventSignature === eventSignature
        // );

        // const args = receipt.events.filter((data) => {
        //   return data.event === "PoolBalanceChanged";
        // })[0].args;

        await expect(await setup.lbpWrapper
        .connect(setup.roles.prime)
        .addLiquidityToLbp(
          tokenAddresses,
          fromInternalBalance,
          userData,
          WEIGHTS
        )).to.emit(
          setup.vault,
          "PoolBalanceChanged"
        );
        
        // console.log(cloneCreationEvent);
    });
  });
});
