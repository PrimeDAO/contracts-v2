const { expect } = require("chai");
const { utils } = require("ethers");
const { setupFixture } = require("./utils/setupHelpers");
const { ethers } = require("hardhat");

const commonState = {
  initialPrimeV2Supply: utils.parseEther("100000000"),
  forwardBlocks: 100,
};

describe(">> MerkleDrop", () => {
  let merkleDropInstance, tranche, tree, proof, alice, bob;

  before(async () => {
    const signers = await ethers.getSigners();
    alice = signers[2];
    bob = signers[3];
  });

  describe("# claimTranche", () => {
    describe("$ thresholdBlock lies in the future", () => {
      const initialState = {
        ...commonState,
        thresholdInPast: false,
        withProof: true,
      };

      beforeEach(async () => {
        ({ merkleDropInstance, proof, trancheIdx, expectedBalance } =
          await setupFixture({
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

      it("reverts if alice claims a second time", async () => {
        const duplicateClaim = merkleDropInstance.claimTranche(
          alice.address,
          trancheIdx,
          expectedBalance,
          proof
        );

        await expect(duplicateClaim).to.be.revertedWith(
          "LP has already claimed"
        );
      });
    });
  });

  describe("# verifyClaim", () => {
    describe("$ claim is valid", () => {
      const initialState = {
        ...commonState,
        thresholdInPast: false,
        withProof: true,
      };

      beforeEach(async () => {
        ({ merkleDropInstance, proof, trancheIdx, expectedBalance } =
          await setupFixture({
            initialState,
          }));
      });

      it("returns true", async () => {
        const verifiedBeforeExpiration = await merkleDropInstance.verifyClaim(
          alice.address,
          trancheIdx,
          expectedBalance,
          proof
        );

        expect(verifiedBeforeExpiration).to.eq(true);
      });
    });

    describe("$ tranche is expired", () => {
      const initialState = {
        ...commonState,
        thresholdInPast: false,
        withProof: true,
        trancheExpired: true,
      };

      beforeEach(async () => {
        ({ merkleDropInstance, proof, trancheIdx, expectedBalance } =
          await setupFixture({
            initialState,
          }));
      });

      it.only("returns false", async () => {
        const verifiedAfterExpiration = await merkleDropInstance.verifyClaim(
          alice.address,
          trancheIdx,
          expectedBalance,
          proof
        );

        expect(verifiedAfterExpiration).to.eq(false);
      });
    });
  });
});
