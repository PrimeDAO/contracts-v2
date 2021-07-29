const { utils } = require("ethers");
const DeployedContracts = require("../contractAddresses.json");
const {execSync} = require('child_process')

const { parseEther } = utils;
const PRIME_SUPPLY_V2 = parseEther("100000000").toString();

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { V2_INITIAL_SUPPLY } = process.env;
  const { Safe } = DeployedContracts[network.name];
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("PrimeToken", {
    from: root,
    args: [parseEther(PRIME_SUPPLY_V2), parseEther(PRIME_SUPPLY_V2), Safe],
    log: true,
  });

  await deploy("MerkleDrop", {
    from: root,
    args: [],
    log: true,
  });

  execSync('npx hardhat exportAddress');
};

module.exports = deployFunction;
module.exports.tags = ["Migration", "MainDeploy"];
