const { utils } = require("ethers");
const path = require("path");
const fs = require("fs");
const DeployedContracts = require("../contractAddresses.json");
const initialRepBalances = require("../inputs/initialRepBalances.json");

const { parseEther } = utils;

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  let repHolders = [];
  let repAmounts = [];
  Object.entries(initialRepBalances).forEach(([address, amount]) => {
    repHolders.push(address);
    repAmounts.push(parseEther(amount.toString()));
  });

  const { address: reputationAddress } = await deploy("Reputation", {
    contract: "Reputation",
    from: root.address,
    args: [repHolders, repAmounts],
    log: true,
  });

  console.log("Saving Address to contractAddresses.json\n");
  DeployedContracts[network.name].Reputation = reputationAddress;
  fs.writeFileSync(
    path.resolve(__dirname, "../contractAddresses.json"),
    JSON.stringify(DeployedContracts)
  );
};

module.exports = deployFunction;
module.exports.tags = ["Reputation"];
