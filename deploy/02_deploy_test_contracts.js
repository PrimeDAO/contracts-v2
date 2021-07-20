const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("TestToken", {
    contract: "ERC20Mock",
    from: root,
    args: ["TTOKEN", "TToken"],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Test"];
