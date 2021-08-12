const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const { utils } = require("ethers");

const { parseEther, formatEther } = utils;

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

const parseNumbers = (balancesInEther) =>
  Object.fromEntries(
    Object.entries(balancesInEther).map(([signerName, amount]) => [
      signerName,
      parseEther(amount.toString()),
    ])
  );

describe("Reputation", () => {
  let reputationInstance, repHolders, root, alice, bob, carl, dean, eddie;

  const amountsInEther = {
    alice: 10,
    bob: 10.5,
    carl: 20,
    dean: 5,
    eddie: 6,
  };
  const parsedAmounts = parseNumbers(amountsInEther);
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

    context("> new REP holders", () => {
      beforeEach(async () => {
        await reputationInstance.batchMint(newRepHolders, newRepAmounts);
      });

      it("mints REP to dean", async () => {
        const deanBalance = await reputationInstance.balanceOf(dean.address);
        expect(deanBalance).to.eq(parsedAmounts.dean);
      });

      it("mints REP to eddie", async () => {
        const eddieBalance = await reputationInstance.balanceOf(eddie.address);
        expect(eddieBalance).to.eq(parsedAmounts.eddie);
      });
    });

    context("> existing REP holders", () => {
      let existingRepHolders;

      const additionalRepAmounts = {
        alice: 2,
        bob: 3,
      };
      const parsedAdditionalAmounts = parseNumbers(additionalRepAmounts);

      beforeEach(async () => {
        existingRepHolders = [alice.address, bob.address];
        await reputationInstance.batchMint(existingRepHolders, [
          parsedAdditionalAmounts.alice,
          parsedAdditionalAmounts.bob,
        ]);
      });

      it("adds REP to Alice's balance", async () => {
        const aliceBalance = await reputationInstance.balanceOf(alice.address);
        expect(aliceBalance).to.eq(
          parsedAmounts.alice.add(parsedAdditionalAmounts.alice)
        );
      });

      it("adds REP to Bob's balance", async () => {
        const bobBalance = await reputationInstance.balanceOf(bob.address);
        expect(bobBalance).to.eq(
          parsedAmounts.bob.add(parsedAdditionalAmounts.bob)
        );
      });
    });
  });

  describe("#batchBurn", () => {
    let burnRepHolders;

    const burnRepAmounts = {
      alice: 2,
      bob: 3,
    };
    const parsedBurnRepAmounts = parseNumbers(burnRepAmounts);
    const repAmountsInputParam = [
      parsedBurnRepAmounts.alice,
      parsedBurnRepAmounts.bob,
    ];

    beforeEach(async () => {
      burnRepHolders = [alice.address, bob.address];
      await reputationInstance.batchBurn(burnRepHolders, repAmountsInputParam);
    });

    it("removes REP from Bob's balance", async () => {
      const bobBalance = await reputationInstance.balanceOf(bob.address);
      expect(bobBalance).to.eq(parsedAmounts.bob.sub(parsedBurnRepAmounts.bob));
    });

    it("leaves Carl's balance unchanged", async () => {
      const carlBalance = await reputationInstance.balanceOf(carl.address);
      expect(carlBalance).to.eq(parsedAmounts.carl);
    });

    context("> caller is NOT owner", () => {
      it("reverts", async () => {
        const batchBurnAttempt = reputationInstance
          .connect(alice)
          .batchBurn(burnRepHolders, repAmountsInputParam);
        await expect(batchBurnAttempt).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
      });
    });
  });
});
