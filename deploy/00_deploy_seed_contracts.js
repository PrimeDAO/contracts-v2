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

  const { address: signerAddress } = await deploy("Signer", {
    from: root,
    args: [Safe, seedFactoryAddress],
    log: true,
  });

  DeployedContracts[network.name].Signer = signerAddress;
  DeployedContracts[network.name].SeedFactory = seedFactoryAddress;
  DeployedContracts[network.name].Seed = seedAddress;

  console.log("Saving Address to contractAddresses.json\n");
  fs.writeFileSync(
    path.resolve(__dirname,"../contractAddresses.json"),
    JSON.stringify(DeployedContracts)
    );
};

module.exports = deployFunction;
module.exports.tags = ["Seeds", "MainDeploy"];
