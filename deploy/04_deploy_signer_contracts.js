const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const safeInstance = await ethers.getContract("Safe");

  const lbpManagerFactoryInstance = await ethers.getContract(
    "LBPManagerFactory"
  );
  const seedFactoryInstance = await ethers.getContract("SeedFactory");

  const deployLBPManagerFunctionSignature =
    await lbpManagerFactoryInstance.interface.getSighash("deployLBPManager");

  const deploySeedFunctionSignature =
    await seedFactoryInstance.interface.getSighash("deploySeed");

  await deploy("SignerV2", {
    from: root,
    args: [
      safeInstance.address,
      [lbpManagerFactoryInstance.address, seedFactoryInstance.address],
      [deployLBPManagerFunctionSignature, deploySeedFunctionSignature],
    ],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Signer"];
