const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const safeInstance = await ethers.getContract("Safe");
  const lbpFactoryInstance = await ethers.getContract(
    "LiquidityBootstrappingPoolFactory"
  );

  await deploy("LBPManagerFactory", {
    from: root,
    args: [lbpFactoryInstance.address],
    log: true,
  });

  const { address: lbpManagerAddress } = await deploy("LBPManager", {
    from: root,
    args: [],
    log: true,
  });

  const lbpManagerFactoryInstance = await ethers.getContract(
    "LBPManagerFactory"
  );

  await lbpManagerFactoryInstance.setMasterCopy(lbpManagerAddress);

  await lbpManagerFactoryInstance.transferOwnership(safeInstance.address);
};

module.exports = deployFunction;
module.exports.tags = ["LBP"];
