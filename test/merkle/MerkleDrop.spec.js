const { expect } = require("chai");
const { utils } = require("ethers");
const { setupFixture, setupInitialState } = require("./utils/prepareState");
const { ethers } = require("hardhat");

const commonState = {
  initialPrimeV2Supply: utils.parseEther("100000000"),
  forwardBlocks: 100,
};

describe(">> MerkleDrop", () => {
  let merkleDropInstance, v2TokenInstance, contractInstances, alice, bob;

  before(async () => {
    const signers = await ethers.getSigners();
    alice = signers[2];
    bob = signers[3];
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({ merkleDropInstance, v2TokenInstance } = contractInstances);
  });

  describe("# claimTranche", () => {
    let proof, trancheIdx, expectedBalance;

    describe("$ thresholdBlock lies in the future", () => {
      const initialState = {
        ...commonState,
        thresholdInPast: false,
        withProof: true,
      };

      it("reverts", async () => {
        ({ proof, trancheIdx, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));
        const claim = merkleDropInstance
          .connect(alice)
          .claimTranche(alice.address, trancheIdx, expectedBalance, proof);
        expect(claim).to.be.revertedWith("Rewards are not yet claimable");
      });
    });

    describe("$ thresholdBlock lies in the past", () => {
      let proof, trancheIdx, expectedBalance;
      const initialState = {
        ...commonState,
        thresholdInPast: true,
        withProof: true,
      };

      beforeEach(async () => {
        ({ proof, trancheIdx, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));
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

        expect(duplicateClaim).to.be.revertedWith("LP has already claimed");
      });
    });

    describe("$ allocation is zero", () => {
      let proof, trancheIdx, expectedBalance;

      const initialState = {
        ...commonState,
        thresholdInPast: true,
        withProof: true,
        zeroAllocation: true,
      };

      it("reverts", async () => {
        ({ proof, trancheIdx, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));
        const zeroClaim = merkleDropInstance.claimTranche(
          alice.address,
          trancheIdx,
          expectedBalance,
          proof
        );

        await expect(zeroClaim).to.be.revertedWith(
          "No balance would be transferred - not going to waste your gas"
        );
      });
    });
  });

  describe("# verifyClaim", () => {
    describe("$ claim is valid", () => {
      let proof, trancheIdx, expectedBalance;

      const initialState = {
        ...commonState,
        thresholdInPast: false,
        withProof: true,
      };

      beforeEach(async () => {
        ({ proof, trancheIdx, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));
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
      let proof, trancheIdx, expectedBalance;

      const initialState = {
        ...commonState,
        thresholdInPast: false,
        withProof: true,
        trancheExpired: true,
      };

      beforeEach(async () => {
        ({ proof, trancheIdx, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));
      });

      it("returns false", async () => {
        const verifiedAfterExpiration = await merkleDropInstance.verifyClaim(
          alice.address,
          trancheIdx,
          expectedBalance,
          proof
        );

        expect(verifiedAfterExpiration).to.eq(false);
      });
    });

    describe("$ merkle proof is incorrect", () => {
      let proof, trancheIdx, expectedBalance;

      const initialState = {
        ...commonState,
        thresholdInPast: true,
        withProof: true,
        incorrectProof: true,
      };

      it("reverts", async () => {
        ({ proof, trancheIdx, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));

        const claimWithIncorrectProof = merkleDropInstance
          .connect(alice)
          .claimTranche(alice.address, trancheIdx, expectedBalance, proof);

        await expect(claimWithIncorrectProof).to.be.revertedWith(
          "Incorrect merkle proof"
        );
      });
    });
  });
});
