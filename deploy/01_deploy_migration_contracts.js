const { utils } = require("ethers");
const DeployedContracts = require("../contractAddresses.json");

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { V2_INITIAL_SUPPLY } = process.env;
  const GENESIS_MULTISIG = DeployedContracts[network.name].Safe;
  const { parseEther } = utils;
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  await deploy("PrimeToken", {
    from: root,
    args: [
      parseEther(V2_INITIAL_SUPPLY),
      parseEther(V2_INITIAL_SUPPLY),
      GENESIS_MULTISIG,
    ],
    log: true,
  });

  await deploy("MerkleDrop", {
    from: root,
    args: [],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Migration"];
