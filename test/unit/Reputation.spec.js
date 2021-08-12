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
      args: [
        repHolders,
        repAmounts.map((amount) => parseEther(amount.toString())),
      ],
      log: true,
    });

    const contractInstances = {
      reputationInstance: await ethers.getContract("Reputation"),
    };

    return contractInstances;
  }
);

describe.only("SeedFactory", () => {
  let reputationInstance, root, alice, bob, carl;

  before("get array of signers/addresses", async () => {
    [root, alice, bob, carl] = await ethers.getSigners();
  });

  beforeEach("deploy Reputation contract (= clean slate)", async () => {
    const repHolders = [alice.address, bob.address, carl.address];
    const repAmounts = [10, 10.5, 20];
    ({ reputationInstance } = await setupFixture({ repHolders, repAmounts }));
  });

  context("» creator is owner", () => {
    it("does a test", async () => {
      console.log("test");
    });
  });
});
