const { deployments } = require("hardhat");

const PROXY_CREATION = "ProxyCreation";

const setupTest = deployments.createFixture(
  async ({ deployments, ethers }, options) => {
    await deployments.fixture(["Seed", "Test"]);
    const { prime, root, buyer1, buyer2, buyer3, buyer4, beneficiary } =
      await ethers.getNamedSigners();
    const Seed = await ethers.getContract("Seed");
    const seedFactory = await ethers.getContract("SeedFactory");
    const { deploy } = deployments;
    await deploy("TestSeedFactory", {
      contract: "SeedFactory",
      from: root.address,
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
      signer,
      prime,
      root,
      buyer1,
      buyer2,
      buyer3,
      buyer4,
      beneficiary,
    };
  }
);

const setupSignerTest = deployments.createFixture(
  async ({ deployments, ethers }, options) => {
    await deployments.fixture(["Seed", "Test"]);
    const { prime, root } = await ethers.getNamedSigners();
    const gnosisSafeInstance = await ethers.getContract("GnosisSafe");
    const gnosisSafeProxyFactoryInstance = await ethers.getContract(
      "GnosisSafeProxyFactory"
    );
    const createProxy = await gnosisSafeProxyFactoryInstance
      .connect(prime)
      .createProxy(gnosisSafeInstance.address, "0x00");
    const proxy_receit = await createProxy.wait();
    const proxy_addr = proxy_receit.events.filter((data) => {
      return data.event === PROXY_CREATION;
    })[0].args["proxy"];
    const proxySafeInstance = await ethers.getContractAt(
      "GnosisSafe",
      proxy_addr
    );

    const seedFactoryInstance = await ethers.getContract("SeedFactory");
    const signerFactory = await ethers.getContractFactory("Signer", root);
    const signerInstance = await signerFactory.deploy(
      proxySafeInstance.address,
      seedFactoryInstance.address
    );

    return {
      root,
      prime,
      signerInstance,
      seedFactoryInstance,
      proxySafeInstance,
    };
  }
);

module.exports = {
  setupTest,
  setupSignerTest,
};
