const LBPArtifact = require("../../imports/LiquidityBootstrappingPool.json");
const LBPFactoryArtifact = require('../../imports/LiquidityBootstrappingPoolFactory.json');
const VaultArtifact = require("../../imports/Vault.json");
const { constants } = require('@openzeppelin/test-helpers');

const LBPFactory = async (setup) => {
    const LBPFactory_Factory = new ethers.ContractFactory(LBPFactoryArtifact.abi, LBPFactoryArtifact.bytecode, setup.roles.root);
    const lbpFactory = await LBPFactory_Factory.deploy(setup.vault.address);
    return lbpFactory;
}

const deployVault = async (setup) => {
    const Vault_factory = new ethers.ContractFactory(VaultArtifact.abi, VaultArtifact.bytecode, setup.roles.root);
    const vault = await Vault_factory.deploy(constants.ZERO_ADDRESS, constants.ZERO_ADDRESS, 0, 0);

    return vault;
}

const Lbp = (setup) => new ethers.ContractFactory(LBPArtifact.abi, LBPArtifact.bytecode, setup.roles.root);

module.exports = {
	LBPFactory,
	deployVault,
	Lbp
}
