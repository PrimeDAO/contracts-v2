const deployFunction = async ({
  getNamedAccounts,
  deployments,
  getContract,
}) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const safeInstance = await getContract("Safe");

  const { address: seedFactoryAddress } = await deploy("SeedFactory", {
    from: root,
    args: [],
    log: true,
  });

  const { address: seedAddress } = await deploy("Seed", {
    from: root,
    args: [],
    log: true,
  });

  const seedFactoryInstance = await ethers.getContract("SeedFactory");

  await seedFactoryInstance.setMasterCopy(seedAddress);

  await deploy("Signer", {
    from: root,
    args: [safeInstance.address, seedFactoryAddress],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Seeds"];
