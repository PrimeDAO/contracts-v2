const LBPArtifact = require("../../imports/LiquidityBootstrappingPool.json");
const { ethers } = require("hardhat");

const getLbpFactoryInstance = async (vaultInstance) => {
  const lbPFactoryFactory = await ethers.getContractFactory(
    "LiquidityBootstrappingPoolFactory"
  );
  const lbpFactoryInstance = await lbPFactoryFactory.deploy(
    vaultInstance.address
  );

  return lbpFactoryInstance;
};

const getVaultInstance = async () => {
  const { root } = await ethers.getNamedSigners();
  const pauseWindowDuration = 0;
  const bufferPeriodDuration = 0;

  const WETHFactory = await ethers.getContractFactory("ERC20Mock");
  const WETHInstance = await WETHFactory.deploy("WRAPETH", "WETH");

  const authorizerFactory = await ethers.getContractFactory("Authorizer");
  const authorizerInstance = await authorizerFactory.deploy(root.address);

  const vaultFactory = await ethers.getContractFactory("Vault");
  const vaultInstance = await vaultFactory.deploy(
    authorizerInstance.address,
    WETHInstance.address,
    pauseWindowDuration,
    bufferPeriodDuration
  );

  return vaultInstance;
};

const getLbpFactory = (root) =>
  new ethers.ContractFactory(LBPArtifact.abi, LBPArtifact.bytecode, root);

module.exports = {
  getLbpFactoryInstance,
  getVaultInstance,
  getLbpFactory,
};
