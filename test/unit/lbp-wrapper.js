const { expect } = require("chai");
const { ethers, artifacts } = require("hardhat");
const { parseEther } = ethers.utils;

const init = require("../test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const { constants } = require("@openzeppelin/test-helpers");
const VaultArtifact = require("../../imports/Vault.json");

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

describe("Contract: LBPWrapper", async () => {
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

  const fromInternalBalance = false;
  let userData, poolId, JOIN_KIND_INIT;

  context(">> deploy LBP Wrapper", async () => {
    before("!! setup", async () => {
      setup = await deploy();
      swapsEnabled = true;

      sortedTokens = sortTokens(setup.tokenList);
      tokenAddresses = sortedTokens.map((token) => token.address);
      JOIN_KIND_INIT = 0;
    });
    it("$ deploy LBPWrapper", async () => {
      setup.lbpWrapper = await setup.LBPWrapper.deploy();
    });
  });
  context(">> deploy LBP using Wrapper", async () => {
    it("$ success", async () => {
      await setup.lbpWrapper
        .connect(setup.roles.root)
        .initializeLBP(
          setup.lbpFactory.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          WEIGHTS,
          swapsEnabled,
          startTime,
          endTime,
          END_WEIGHTS
        );
      setup.Lbp = setup.Lbp.attach(await setup.lbpWrapper.lbp());
      poolId = await setup.Lbp.getPoolId();

      expect(await setup.lbpWrapper.lbp()).not.equal(constants.ZERO_ADDRESS);
    });
    it("$ reverts when calling initializeLBP twice", async () => {
      await expect(
        setup.lbpWrapper
          .connect(setup.roles.root)
          .initializeLBP(
            setup.lbpFactory.address,
            NAME,
            SYMBOL,
            tokenAddresses,
            WEIGHTS,
            swapsEnabled,
            startTime,
            endTime,
            END_WEIGHTS
          )
      ).to.be.revertedWith("LBPWrapper: LBP has already been initialized");
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
          .joinPool(tokenAddresses, WEIGHTS, fromInternalBalance, userData)
      ).to.be.revertedWith("LBPWrapper: only owner function");
    });
    it("$ add liquidity to the pool", async () => {
      const eventName = "PoolBalanceChanged";
      const { abi } = VaultArtifact;
      const vaultInterface = new ethers.utils.Interface(abi);

      const tx = await setup.lbpWrapper
        .connect(setup.roles.prime)
        .joinPool(tokenAddresses, WEIGHTS, fromInternalBalance, userData);

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
    });
    it("$ revert when adding liquidity more then once", async () => {
      await expect(
        setup.lbpWrapper
          .connect(setup.roles.prime)
          .joinPool(tokenAddresses, WEIGHTS, fromInternalBalance, userData)
      ).to.be.revertedWith("LBPWrapper: pool has already been joined");
    });
  });
});
