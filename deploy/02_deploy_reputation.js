const { utils } = require("ethers");
const path = require("path");
const fs = require("fs");

const { parseEther } = utils;

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const { address: primeTokenAddress } = await deploy("PrimeToken", {
    from: root,
    args: [parseEther(PRIME_SUPPLY_V2), parseEther(PRIME_SUPPLY_V2), Safe],
    log: true,
  });

  const { address: merkleDropAddress } = await deploy("MerkleDrop", {
    from: root,
    args: [],
    log: true,
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
