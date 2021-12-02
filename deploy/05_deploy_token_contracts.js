const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("Prime", {
    contract: "Prime",
    from: root,
    args: [],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Token"];
