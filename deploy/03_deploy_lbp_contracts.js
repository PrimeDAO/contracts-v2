const { getBalancerContractAddress } = require("@balancer-labs/v2-deployments");

const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const safeInstance = await ethers.getContract("Safe");
  const liquidityBootstrappingPoolFactoryTaskId =
    "20210721-liquidity-bootstrapping-pool";
  const contractName = "LiquidityBootstrappingPoolFactory";
  const networkName = hre.network.name;

  const lbpFactoryAddress = await getBalancerContractAddress(
    liquidityBootstrappingPoolFactoryTaskId,
    contractName,
    networkName
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
