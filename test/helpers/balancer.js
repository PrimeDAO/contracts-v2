const LBPArtifact = require("../../imports/LiquidityBootstrappingPool.json");
const LBPFactoryArtifact = require('../../imports/LiquidityBootstrappingPoolFactory.json');
const VaultArtifact = require("../../imports/Vault.json");
const AuthorizerArtifact = require("../../imports/Authorizer.json");
const { constants } = require('@openzeppelin/test-helpers');
const { ethers } = require("hardhat");

const LBPFactory = async (setup) => {
    const LBPFactory_Factory = new ethers.ContractFactory(LBPFactoryArtifact.abi, LBPFactoryArtifact.bytecode, setup.roles.root);
    const lbpFactory = await LBPFactory_Factory.deploy(setup.vault.address);
    return lbpFactory;
}

const Vault = async (setup) => {

    const pauseWindowDuration = 0;
    const bufferPeriodDuration = 0;

    const WETH_Factory = await ethers.getContractFactory(
		"ERC20Mock",
		setup.roles.root
	);
    const WETH = await WETH_Factory.deploy("WRAPETH", "WETH");
    
    const Authorizer_Factory = new ethers.ContractFactory(
        AuthorizerArtifact.abi,
        AuthorizerArtifact.bytecode,
        setup.roles.root);
        const authorizer = await Authorizer_Factory.deploy(setup.roles.root.address);
        
    const Vault_factory = new ethers.ContractFactory(
        VaultArtifact.abi,
        VaultArtifact.bytecode,
        setup.roles.root);
    const vault = await Vault_factory.deploy(
        authorizer.address,
        WETH.address,
        pauseWindowDuration,
        bufferPeriodDuration);


    return vault;
}

const Lbp = (setup) => new ethers.ContractFactory(LBPArtifact.abi, LBPArtifact.bytecode, setup.roles.root);


module.exports = {
	LBPFactory,
	Vault,
	Lbp,
}
