const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers, deployments } = require("hardhat");
const { setupTest } = require("../helpers");
const {
  constants,
  time,
  expectRevert,
  BN,
} = require("@openzeppelin/test-helpers");
const { parseEther } = ethers.utils;

use(solidity);

const toHex = (str) => {
  let hex = "";
  for (let i = 0; i < str.length; i++) {
    hex += "" + str.charCodeAt(i).toString(16);
  }
  return hex;
};

describe("SeedFactory", () => {
  let tx,
    setup,
    dao,
    admin,
    buyer1,
    buyer2,
    seedToken,
    fundingToken,
    hardCap,
    price,
    startTime,
    endTime,
    vestingDuration,
    vestingCliff,
    isWhitelisted,
    fee,
    softCap,
    seedFactory,
    newSeed,
    metadata,
    receipt,
    requiredSeedAmount,
    Seed,
    uninitializedSeedFactory;

  const pct_base = new BN("1000000000000000000"); // 10**18

  context("» creator is owner", () => {
    beforeEach("!! deploy setup", async () => {
      ({
        Seed,
        seedFactory,
        uninitializedSeedFactory,
        seedToken,
        fundingToken,
        prime: admin,
        root: dao,
        buyer1,
        buyer2,
      } = await setupTest());
      hardCap = parseEther("100").toString();
      price = parseEther("0.01").toString();
      softCap = parseEther("100").toString();
      startTime = await time.latest();
      endTime = await startTime.add(await time.duration.days(7));
      vestingDuration = await time.duration.days(365); // 1 year
      vestingCliff = await time.duration.days(90); // 3 months
      isWhitelisted = false;
      fee = 2;
      metadata = `0x${toHex("QmRCtyCWKnJTtTCy1RTXte8pY8vV58SU8YtAC9oa24C4Qg")}`;
    });

    context("» parameters are valid", () => {
      it("it reverts when masterCopy is zero address", async () => {
        await expectRevert(
          uninitializedSeedFactory.deploySeed(
            dao.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            startTime.toNumber(),
            endTime.toNumber(),
            [vestingDuration.toNumber(), vestingCliff.toNumber()],
            isWhitelisted,
            fee,
            metadata
          ),
          "SeedFactory: mastercopy cannot be zero address"
        );
      });

      it("sets master copy", async () => {
        await uninitializedSeedFactory.setMasterCopy(Seed.address);
        const masterCopyAddress = await uninitializedSeedFactory.masterCopy();
        expect(masterCopyAddress).to.equal(Seed.address);
      });

      it("it reverts when masterCopy is zero address", async () => {
        const deployWithZeroAddress = await expectRevert(
          seedFactory.deploySeed(
            dao.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            startTime.toNumber(),
            endTime.toNumber(),
            [vestingDuration.toNumber()],
            isWhitelisted,
            fee,
            metadata
          ),
          "SeedFactory: Hasn't provided both vesting duration and cliff"
        );
      });

      it("reverts when fundingToken == seedToken", async () => {
        await expectRevert(
          seedFactory.deploySeed(
            dao.address,
            admin.address,
            [seedToken.address, seedToken.address],
            [softCap, hardCap],
            price,
            startTime.toNumber(),
            endTime.toNumber(),
            [vestingDuration.toNumber(), vestingCliff.toNumber()],
            isWhitelisted,
            fee,
            metadata
          ),
          "SeedFactory: seedToken cannot be fundingToken"
        );
      });

      it("reverts when softCap > hardCap", async () => {
        await expectRevert(
          seedFactory.deploySeed(
            dao.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [parseEther("101").toString(), softCap],
            price,
            startTime.toNumber(),
            endTime.toNumber(),
            [vestingDuration.toNumber(), vestingCliff.toNumber()],
            isWhitelisted,
            fee,
            metadata
          ),
          "SeedFactory: hardCap cannot be less than softCap"
        );
      });

      it("reverts when vestingCliff > vestingDuration", async () => {
        await expectRevert(
          seedFactory.deploySeed(
            dao.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [hardCap, softCap],
            price,
            startTime.toNumber(),
            endTime.toNumber(),
            [vestingCliff.toNumber(), vestingDuration.toNumber()],
            isWhitelisted,
            fee,
            metadata
          ),
          "SeedFactory: vestingDuration cannot be less than vestingCliff"
        );
      });

      it("reverts when startTime >= endTime", async () => {
        await expectRevert(
          seedFactory.deploySeed(
            dao.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [hardCap, softCap],
            price,
            endTime.toNumber(),
            startTime.toNumber(),
            [vestingDuration.toNumber(), vestingCliff.toNumber()],
            isWhitelisted,
            fee,
            metadata
          ),
          "SeedFactory: endTime cannot be less than equal to startTime"
        );
      });

      it("it creates new seed contract", async () => {
        requiredSeedAmount = new BN(hardCap).div(new BN(price)).mul(pct_base);

        await expect(
          seedFactory.deploySeed(
            dao.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            startTime.toNumber(),
            endTime.toNumber(),
            [vestingDuration.toNumber(), vestingCliff.toNumber()],
            isWhitelisted,
            fee,
            metadata
          )
        ).to.emit(seedFactory, "SeedCreated");
      });
    });

    context("» setMasterCopy", () => {
      it("only Owner can change master copy", async () => {
        await expectRevert(
          seedFactory.connect(admin).setMasterCopy(Seed.address),
          "Ownable: caller is not the owner"
        );
      });

      it("new mastercopy cannot be zero address", async () => {
        await expectRevert(
          seedFactory.connect(dao).setMasterCopy(constants.ZERO_ADDRESS),
          "SeedFactory: new mastercopy cannot be zero address"
        );
      });
    });

    context("» changeOwner", () => {
      it("only Owner can change owner", async () => {
        await expectRevert(
          seedFactory.connect(admin).transferOwnership(buyer1.address),
          "Ownable: caller is not the owner"
        );
      });

      it("changes owner", async () => {
        await seedFactory.connect(dao).transferOwnership(buyer2.address);
        expect(await seedFactory.owner()).to.equal(buyer2.address);
      });
    });
  });
});
