const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("RatingReputation", {
    contract: "Reputation",
    from: root,
    args: ["PrimeDAO Rating Reputation", "PRR"],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Reputation"];
