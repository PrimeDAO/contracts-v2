const { expect } = require("chai");
const { utils } = require("ethers");
const BN = require("bn.js");
const { setupFixture, parsedAllocations } = require("./utils/setupHelpers");
const {
  parseToBnArr,
  createTreeWithAccounts,
  getTranche,
  getAccountBalanceProof,
} = require("./merkle");
const { ethers } = require("hardhat");

const commonState = {
  initialPrimeV2Supply: utils.parseEther("100000000"),
  forwardBlocks: 100,
};

describe(">> MerkleDrop", () => {
  let merkleDropInstance, tranche, tree, proof, alice;

  before(async () => {
    const signers = await ethers.getSigners();
    alice = signers[2];
  });

  describe("$ thresholdBlock lies in the future", () => {
    const initialState = {
      ...commonState,
      thresholdInPast: false,
      withProof: true,
    };

    beforeEach(async () => {
      ({
        merkleDropInstance,
        v2TokenInstance,
        tree,
        proof,
        trancheIdx,
        expectedBalance,
      } = await setupFixture({
        initialState,
      }));
    });

    it("reverts", async () => {
      const claim = merkleDropInstance
        .connect(alice)
        .claimTranche(alice.address, trancheIdx, expectedBalance, proof);
      expect(claim).to.be.revertedWith("Rewards are not yet claimable");
    });
  });

  describe("$ thresholdBlock lies in the past", () => {
    const initialState = {
      ...commonState,
      thresholdInPast: true,
      withProof: true,
    };

    beforeEach(async () => {
      ({
        merkleDropInstance,
        v2TokenInstance,
        tree,
        proof,
        trancheIdx,
        expectedBalance,
      } = await setupFixture({
        initialState,
      }));

      await merkleDropInstance
        .connect(alice)
        .claimTranche(alice.address, trancheIdx, expectedBalance, proof);
    });

    it("lets alice claim her allocation", async () => {
      const aliceBalance = await v2TokenInstance.balanceOf(alice.address);
      expect(aliceBalance).to.eq(expectedBalance);
    });
  });
});
