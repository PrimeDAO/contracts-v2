const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const safeInstance =
    network.name == "kovan" ? root : await ethers.getContract("Safe");

  await deploy("SeedFactory", {
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

  await seedFactoryInstance.transferOwnership(safeInstance.address);
};

module.exports = deployFunction;
module.exports.tags = ["Seed"];
