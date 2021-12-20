const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("Badger", {
    from: root,
    args: ["https://gateway.pinata.cloud/ipfs/"],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Badger"];
