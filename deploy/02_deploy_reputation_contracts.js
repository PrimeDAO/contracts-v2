const path = require("path");
const fs = require("fs");
const DeployedContracts = require("../contractAddresses.json");

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const { address: reputationAddress } = await deploy("Reputation", {
    contract: "Reputation",
    from: root,
    args: [],
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
