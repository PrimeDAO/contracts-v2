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
    alice = signers[3];
  });

  describe("$ thresholdBlock lies in the future", () => {
    let expectedBalance;
    const initialState = { ...commonState, thresholdInPast: false };

    beforeEach(async () => {
      ({ merkleDropInstance, v2TokenInstance, tree } = await setupFixture({
        initialState,
      }));
      proof = getAccountBalanceProof(
        tree,
        alice.address,
        new BN(parsedAllocations[alice.address].toString())
      );
      tranche = "0";
      expectedBalance = parsedAllocations[alice.address];
    });

    it("reverts", async () => {
      const claim = merkleDropInstance
        .connect(alice)
        .claimTranche(
          alice.address,
          tranche,
          parsedAllocations[alice.address],
          proof
        );
      expect(claim).to.be.revertedWith("Rewards are not yet claimable");
    });
  });
});
