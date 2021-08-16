const { utils } = require("ethers");
const DeployedContracts = require("../contractAddresses.json");
const path = require("path");
const fs = require("fs");

const { parseEther } = utils;
const PRIME_SUPPLY_V2 = parseEther("100000000").toString();

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { V2_INITIAL_SUPPLY } = process.env;
  const { Safe } = DeployedContracts[network.name];
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const { address: primeTokenAddress } = await deploy("PrimeToken", {
    from: root,
    args: [parseEther(PRIME_SUPPLY_V2), parseEther(PRIME_SUPPLY_V2), Safe],
    log: true
  });

  const { address: merkleDropAddress } = await deploy("MerkleDrop", {
    from: root,
    args: [],
    log: true
  });

  console.log("Saving Address to contractAddresses.json\n");
  DeployedContracts[network.name].PrimeToken = primeTokenAddress;
  DeployedContracts[network.name].MerkleDrop = merkleDropAddress;

  fs.writeFileSync(
    path.resolve(__dirname, "../contractAddresses.json"),
    JSON.stringify(DeployedContracts)
  );
};

module.exports = deployFunction;
module.exports.tags = ["Migration", "MainDeploy"];
