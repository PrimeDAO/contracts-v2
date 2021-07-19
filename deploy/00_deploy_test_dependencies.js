const { utils } = require("ethers");
const DeployedContracts = require("../contractAddresses.json");

const { parseEther } = utils;
const PRIME_SUPPLY_V2 = parseEther("100000000").toString();

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("GnosisSafe", {
    from: root,
    args: [],
    log: true,
  });

  await deploy("GnosisSafeProxyFactory", {
    from: root,
    args: [],
    log: true,
  });

  await deploy("FundingToken", {
    contract: "ERC20Mock",
    from: root,
    args: ["DAI Stablecoin", "DAI"],
    log: true,
  });

  await deploy("PrimeToken", {
    from: root,
    args: [PRIME_SUPPLY_V2, PRIME_SUPPLY_V2, root],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Test"];
