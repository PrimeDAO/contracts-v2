const { deployments, ethers } = require("hardhat");
const init = require("../test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());
  const merkleDrop = await init.merkleDrop(setup);
  return merkleDrop;
};

const setupFixture = deployments.createFixture(
  async ({ deployments, ethers }, options) => {
    await deployments.fixture();
    const merkleDropInstance = await deploy();
    return merkleDropInstance;
  }
);

describe("MerkleDrop", () => {
  let merkleDropInstance;

  beforeEach("", async () => {
    ({ merkleDropInstance } = await setupFixture());
  });

  describe("initialization", () => {
    it("bla", async () => {
      console.log(await merkleDropInstance.token());
    });
  });
});
