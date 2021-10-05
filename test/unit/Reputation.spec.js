const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const { utils, BigNumber } = require("ethers");
const { getReputationParams } = require("../../tasks/utils/reputation");

const { parseEther } = utils;

const setupFixture = deployments.createFixture(
  async ({ deployments, getNamedAccounts }, options) => {
    const { deploy } = deployments;
    const { root } = await getNamedAccounts();

    await deploy("Reputation", {
      contract: "Reputation",
      from: root,
      args: ["PrimeDAO Rating Reputation", "PRR"],
      log: true,
    });

    const { repHolders, repAmounts } = options;

    const reputationInstance = await ethers.getContract("Reputation");
    await reputationInstance.batchMint(repHolders, repAmounts);

    return reputationInstance;
  }
);

const parseNumbers = (balancesInEther) =>
  Object.fromEntries(
    Object.entries(balancesInEther).map(([signerName, amount]) => [
      signerName,
      BigNumber.from(amount),
    ])
  );

describe("Reputation", () => {
  let reputationInstance,
    repHolders,
    repAmounts,
    root,
    alice,
    bob,
    carl,
    dean,
    eddie;

  const amountsInWei = {
    alice: "10000000000000000000",
    bob: "10500000000000000000",
    carl: "20000000000000000000",
    dean: "5000000000000000000",
    eddie: "6000000000000000000",
  };

  const parsedAmounts = parseNumbers(amountsInWei);

  before("get array of signers/addresses", async () => {
    [root, alice, bob, carl, dean, eddie] = await ethers.getSigners();
    const initialBalances = {
      [alice.address]: amountsInWei.alice,
      [bob.address]: amountsInWei.bob,
      [carl.address]: amountsInWei.carl,
    };
    ({ repHolders, repAmounts } = getReputationParams(initialBalances));
  });

  beforeEach("create fresh Reputation contract", async () => {
    reputationInstance = await setupFixture({ repHolders, repAmounts });
  });

  describe("!deployment", () => {
    it("deploys the Reputation contract", async () => {
      const reputationInstance = await ethers.getContract("Reputation");

      expect(reputationInstance.address).to.be.properAddress;
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

  describe("#mint", () => {
    let mintRecipient;

    const mintAmount = parseEther("2");

    beforeEach(async () => {
      mintRecipient = alice.address;
    });

    it("mints REP to Alice", async () => {
      await reputationInstance.mint(mintRecipient, mintAmount);
      const aliceBalance = await reputationInstance.balanceOf(alice.address);

      expect(aliceBalance).to.eq(parsedAmounts.alice.add(mintAmount));
    });

    context("> with caller NOT being the owner", () => {
      it("reverts", async () => {
        const mintAttempt = reputationInstance
          .connect(alice)
          .mint(mintRecipient, mintAmount);

        await expect(mintAttempt).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
      });
    });
  });

  describe("#burn", () => {
    let burnVictim;

    const burnAmount = parseEther("2");

    beforeEach(async () => {
      burnVictim = alice.address;
    });

    it("mints REP to Alice", async () => {
      await reputationInstance.burn(burnVictim, burnAmount);
      const aliceBalance = await reputationInstance.balanceOf(alice.address);

      expect(aliceBalance).to.eq(parsedAmounts.alice.sub(burnAmount));
    });

    context("> with caller NOT being the owner", () => {
      it("reverts", async () => {
        const mintAttempt = reputationInstance
          .connect(alice)
          .mint(burnVictim, burnAmount);

        await expect(mintAttempt).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
      });
    });
  });

  describe("#batchMint", () => {
    let newRepHolders, newRepAmounts;

    beforeEach(() => {
      newRepHolders = [dean.address, eddie.address];
      newRepAmounts = [parsedAmounts.dean, parsedAmounts.eddie];
    });

    context("> with input arrays too long", () => {
      it("reverts", async () => {
        const excessiveRepHolderArr = Array(250).fill(alice.address);
        const excessiveRepAmountsArr = Array(250).fill(parsedAmounts.alice);

        const batchMintAttempt = reputationInstance.batchMint(
          excessiveRepHolderArr,
          excessiveRepAmountsArr
        );
        await expect(batchMintAttempt).to.be.revertedWith(
          "Reputation: maximum number of reputation holders and amounts of 200 was exceeded"
        );
      });
    });

    context("> with caller NOT being the owner", () => {
      it("reverts", async () => {
        const batchMintAttempt = reputationInstance
          .connect(alice)
          .batchMint(newRepHolders, newRepAmounts);

        await expect(batchMintAttempt).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
      });
    });

    context("> with new REP holders", () => {
      beforeEach(async () => {
        await reputationInstance.batchMint(newRepHolders, newRepAmounts);
      });

      it("mints REP to Dean", async () => {
        const deanBalance = await reputationInstance.balanceOf(dean.address);
        expect(deanBalance).to.eq(parsedAmounts.dean);
      });

      it("mints REP to Eddie", async () => {
        const eddieBalance = await reputationInstance.balanceOf(eddie.address);
        expect(eddieBalance).to.eq(parsedAmounts.eddie);
      });
    });

    context("> with existing REP holders", () => {
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

    context("> with differing numbers of addresses and balances", () => {
      it("reverts 'Reputation: number of reputation holders doesn't match number of reputation amounts'", async () => {
        const batchMintAttempt = reputationInstance.batchMint(
          [alice.address, bob.address],
          [BigNumber.from(10)]
        );

        await expect(batchMintAttempt).to.be.revertedWith(
          "Reputation: number of reputation holders doesn't match number of reputation amounts"
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

    context("> with input arrays being too long", () => {
      it("reverts", async () => {
        const excessiveRepHolderArr = Array(250).fill(alice.address);
        const excessiveRepAmountsArr = Array(250).fill(parsedAmounts.alice);

        const batchBurnAttempt = reputationInstance.batchBurn(
          excessiveRepHolderArr,
          excessiveRepAmountsArr
        );

        await expect(batchBurnAttempt).to.be.revertedWith(
          "Reputation: maximum number of reputation holders and amounts of 200 was exceeded"
        );
      });
    });
  });
});
