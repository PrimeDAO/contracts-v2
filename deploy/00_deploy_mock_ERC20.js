const { parseEther } = require("ethers/lib/utils");

const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  // Change these values
  const name = "TestToken5";
  const symbol = "TT";
  const supply = "2100000";

  const convertedSupply = parseEther(supply);

  await deploy("ERC20MockToken", {
    from: root,
    args: [convertedSupply, name, symbol],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["ERC20Mock"];
