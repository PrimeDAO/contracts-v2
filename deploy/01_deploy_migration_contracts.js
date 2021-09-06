const { utils } = require("ethers");

const { parseEther } = utils;
const PRIME_SUPPLY_V2 = parseEther("100000000").toString();

const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const safeInstance = await ethers.getContract("Safe");

  await deploy("PrimeToken", {
    from: root,
    args: [
      parseEther(PRIME_SUPPLY_V2),
      parseEther(PRIME_SUPPLY_V2),
      safeInstance.address,
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
module.exports.tags = ["Migration", "MainDeploy"];
