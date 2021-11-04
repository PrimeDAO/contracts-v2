const { getBalancerContractAddress } = require("@balancer-labs/v2-deployments");

const deployFunction = async ({
  getNamedAccounts,
  deployments,
  ethers,
  network,
}) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const safeInstance =
    network.name == "kovan" ? root : await ethers.getContract("Safe");

  // Gnosis Safe has no deployments on Kovan testnet. Because of this we use the deployer address instead
  const liquidityBootstrappingPoolFactoryTaskId =
    "20210721-liquidity-bootstrapping-pool";
  const contractName = "LiquidityBootstrappingPoolFactory";

  const lbpFactoryAddress = await getBalancerContractAddress(
    liquidityBootstrappingPoolFactoryTaskId,
    contractName,
    network.name
  );

  await deploy("LBPManagerFactory", {
    from: root,
    args: [lbpFactoryAddress],
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
