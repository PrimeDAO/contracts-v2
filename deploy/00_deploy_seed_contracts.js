const DeployedContracts = require("../contractAddresses.json");

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const { Safe } = DeployedContracts[network.name];

  const { address: seedFactoryAddress } = await deploy("SeedFactory", {
    from: root,
    args: [],
    log: true,
  });

  const { address: seedAddress } = await deploy("Seed", {
    from: root,
    args: [],
    log: true,
  });

  const seedFactoryInstance = await ethers.getContract("SeedFactory");

  await seedFactoryInstance.setMasterCopy(seedAddress);

  await deploy("Signer", {
    from: root,
    args: [Safe, seedFactoryAddress],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Seeds", "MainDeploy"];
