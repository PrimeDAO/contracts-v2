const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const safeInstance = await ethers.getContract("Safe");
  const lbpFactoryInstance = await ethers.getContract("LBPFactory");

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

  const deployLBPManagerFunctionSignature =
    await lbpManagerFactoryInstance.interface.getSighash("deployLBPManager");

  await deploy("SignerV2", {
    from: root,
    args: [
      safeInstance.address,
      [lbpManagerFactoryInstance.address],
      [deployLBPManagerFunctionSignature],
    ],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["LBP"];
