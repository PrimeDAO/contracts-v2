const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const { utils } = require("ethers");

const { parseEther } = utils;

const setupFixture = deployments.createFixture(
  async ({ deployments }, options) => {
    const { deploy } = deployments;
    const [root] = await ethers.getSigners();
    const { repHolders, repAmounts } = options;

    await deploy("Reputation", {
      contract: "Reputation",
      from: root.address,
      args: [repHolders, repAmounts],
      log: true,
    });

    return await ethers.getContract("Reputation");
  }
);

describe.only("Reputation", () => {
  let reputationInstance, repHolders, root, alice, bob, carl, dean, eddie;

  const amountsInEther = {
    alice: 10,
    bob: 10.5,
    carl: 20,
    dean: 5,
    eddie: 6,
  };
  const parsedAmounts = Object.fromEntries(
    Object.entries(amountsInEther).map(([signerName, amount]) => [
      signerName,
      parseEther(amount.toString()),
    ])
  );
  const repAmounts = [
    parsedAmounts.alice,
    parsedAmounts.bob,
    parsedAmounts.carl,
  ];

  before("get array of signers/addresses", async () => {
    [root, alice, bob, carl, dean, eddie] = await ethers.getSigners();
    repHolders = [alice.address, bob.address, carl.address];
  });

  beforeEach("create fresh Reputation contract", async () => {
    reputationInstance = await setupFixture({ repHolders, repAmounts });
  });

  describe("!deployment", () => {
    const { deploy } = deployments;

    context("> more repHolders than repAmounts", () => {
      it("reverts", async () => {
        const deployment = deploy("Reputation", {
          contract: "Reputation",
          from: root.address,
          args: [[...repHolders, dean.address], repAmounts],
          log: true,
        });
        await expect(deployment).to.be.revertedWith(
          "Reputation: number of reputation holders doesn't match number of reputation amounts"
        );
      });
    });

    context("> valid constructor arguments", () => {
      it("deploys the Reputation contract", async () => {
        const { address } = await deploy("Reputation", {
          contract: "Reputation",
          from: root.address,
          args: [repHolders, repAmounts],
          log: true,
        });
        expect(address).to.be.properAddress;
      });
    });
  });

  describe("#transfer", () => {
    beforeEach(async () => {
      await reputationInstance
        .connect(alice)
        .transfer(dean.address, parsedAmounts.alice);
    });

    it("doesn't remove REP from sender", async () => {
      const aliceBalance = await reputationInstance.balanceOf(alice.address);
      expect(aliceBalance).to.eq(parsedAmounts.alice);
    });

    it("doesn't add REP to recipient", async () => {
      const deanBalance = await reputationInstance.balanceOf(dean.address);
      expect(deanBalance).to.eq(0);
    });
  });

  describe("#transferFrom", () => {
    beforeEach("set allowance for bob and call transferFrom", async () => {
      await reputationInstance
        .connect(alice)
        .approve(bob.address, parsedAmounts.alice);
      await reputationInstance
        .connect(bob)
        .transferFrom(alice.address, dean.address, parsedAmounts.alice);
    });

    it("doesn't remove REP from sender", async () => {
      const aliceBalance = await reputationInstance.balanceOf(alice.address);
      expect(aliceBalance).to.eq(parsedAmounts.alice);
    });

    it("doesn't add REP to recipient", async () => {
      const deanBalance = await reputationInstance.balanceOf(dean.address);
      expect(deanBalance).to.eq(0);
    });
  });

  describe("#batchMint", () => {
    let newRepHolders, newRepAmounts;

    beforeEach(() => {
      newRepHolders = [dean.address, eddie.address];
      newRepAmounts = [parsedAmounts.dean, parsedAmounts.eddie];
    });

    context("> caller is NOT owner", () => {
      it("reverts", async () => {
        const batchMintAttempt = reputationInstance
          .connect(alice)
          .batchMint(newRepHolders, newRepAmounts);
        await expect(batchMintAttempt).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
      });
    });

    context("> caller is owner", () => {
      // it("mints REP to new recipients", async () => {
      //   await reputationInstance.batchMint(newRepHolders, newRepAmounts);
      //   await expect(batchMintAttempt).to.be.revertedWith(
      //     "Ownable: caller is not the owner"
      //   );
      // });
    });
  });
});
