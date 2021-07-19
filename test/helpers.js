const { deployments } = require("hardhat");

const setupTest = deployments.createFixture(
  async ({ deployments, ethers }, options) => {
    await deployments.fixture(["Seed", "Test"]);
    const {
      prime: admin,
      root: dao,
      buyer1,
      buyer2,
    } = await ethers.getNamedSigners();
    const Seed = await ethers.getContract("Seed");
    const seedFactory = await ethers.getContract("SeedFactory");
    const { deploy } = deployments;
    await deploy("TestSeedFactory", {
      contract: "SeedFactory",
      from: dao.address,
      args: [],
      log: true,
    });
    const uninitializedSeedFactory = await ethers.getContract(
      "TestSeedFactory"
    );
    const fundingToken = await ethers.getContract("FundingToken");
    const seedToken = await ethers.getContract("PrimeToken");
    return {
      Seed,
      fundingToken,
      seedToken,
      seedFactory,
      uninitializedSeedFactory,
      admin,
      dao,
      buyer1,
      buyer2,
    };
  }
);

module.exports = {
  setupTest,
};
