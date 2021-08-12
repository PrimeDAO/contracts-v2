const { expect } = require("chai");
const { ethers } = require("hardhat");
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

    const contractInstances = {
      reputationInstance: await ethers.getContract("Reputation"),
    };

    return contractInstances;
  }
);

describe.only("SeedFactory", () => {
  let reputationInstance, repHolders, root, alice, bob, carl, dean;

  const amountsInEther = {
    alice: 10,
    bob: 10.5,
    carl: 20,
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
    [root, alice, bob, carl, dean] = await ethers.getSigners();
    repHolders = [alice.address, bob.address, carl.address];
  });

  beforeEach("create fresh Reputation contract", async () => {
    ({ reputationInstance } = await setupFixture({ repHolders, repAmounts }));
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
});
