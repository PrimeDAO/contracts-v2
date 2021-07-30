const DeployedContracts = require("../contractAddresses.json");
const path = require("path");
const fs = require('fs');

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

  const signerInstance = await ethers.getContract("Signer");
  const seedInstance = await ethers.getContract("Seed");

  DeployedContracts[network.name].Signer = signerInstance.address;
  DeployedContracts[network.name].SeedFactory = seedFactoryInstance.address;
  DeployedContracts[network.name].Seed = seedInstance.address;

  console.log("Saving Address to contractAddresses.json\n");
  fs.writeFileSync(
    path.resolve(__dirname,"../contractAddresses.json"),
    JSON.stringify(DeployedContracts)
    );
};

module.exports = deployFunction;
module.exports.tags = ["Seeds", "MainDeploy"];
