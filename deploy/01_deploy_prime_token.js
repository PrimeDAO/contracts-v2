const { utils } = require("ethers");
const DeployedContracts = require("../contractAddresses.json");

const { parseEther } = utils;
const PRIME_SUPPLY_V2 = parseEther("100000000");

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const { Safe } = DeployedContracts[network.name];

  await deploy("PrimeToken", {
    from: root,
    args: [PRIME_SUPPLY_V2, PRIME_SUPPLY_V2, Safe],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["PrimeToken", "MainDeploy"];
