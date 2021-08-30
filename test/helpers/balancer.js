const LBPArtifact = require("../../imports/LiquidityBootstrappingPool.json");
const { ethers } = require("hardhat");

const getLbpFactoryInstance = async (setup) => {
  const lbPFactoryFactory = await ethers.getContractFactory(
    "LiquidityBootstrappingPoolFactory"
  );
  const lbpFactoryInstance = await lbPFactoryFactory.deploy(
    setup.vault.address
  );

  return lbpFactoryInstance;
};

const getVaultInstance = async (setup) => {
  const pauseWindowDuration = 0;
  const bufferPeriodDuration = 0;

  const WETHFactory = await ethers.getContractFactory("ERC20Mock");
  const WETHInstance = await WETHFactory.deploy("WRAPETH", "WETH");

  const authorizerFactory = await ethers.getContractFactory("Authorizer");
  const authorizerInstance = await authorizerFactory.deploy(
    setup.roles.root.address
  );

  const vaultFactory = await ethers.getContractFactory("Vault");
  const vaultInstance = await vaultFactory.deploy(
    authorizerInstance.address,
    WETHInstance.address,
    pauseWindowDuration,
    bufferPeriodDuration
  );

  return vaultInstance;
};

const getLbpFactory = (setup) =>
  new ethers.ContractFactory(
    LBPArtifact.abi,
    LBPArtifact.bytecode,
    setup.roles.root
  );

module.exports = {
  getLbpFactoryInstance,
  getVaultInstance,
  getLbpFactory,
};
