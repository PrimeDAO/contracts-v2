const { parseEther } = ethers.utils
const constants = require("@openzeppelin/test-helpers/src/constants");
const LBP = require("../imports/LiquidityBootstrappingPool.json");
const LBPFactory = require('../imports/LiquidityBootstrappingPoolFactory.json');
const Vault = require("../imports/Vault.json");

const PROXY_CREATION = 'ProxyCreation';
const PRIME_CAP = parseEther('90000000').toString();
const PRIME_SUPPLY = parseEther('21000000').toString();

const initialize = async (accounts) => {
    const setup = {};
    setup.roles = {
        root: accounts[0],
        prime: accounts[1],
        beneficiary: accounts[2],
        buyer1: accounts[3],
        buyer2: accounts[4],
        buyer3: accounts[5],
        buyer4: accounts[6],
    };

    return setup;
};

const gnosisSafe = async (setup) => {
    const GnosisSafe_Factory = await ethers.getContractFactory(
        "GnosisSafe",
        setup.roles.prime
    );
    const safe = await GnosisSafe_Factory.deploy();

    return safe;
};

const gnosisProxy = async (setup) => {
    const GnosisSafeProxyFactory_Factory = await ethers.getContractFactory(
        "GnosisSafeProxyFactory",
        setup.roles.prime
    );
    setup.gnosisSafeProxyFactory = await  GnosisSafeProxyFactory_Factory.deploy(); 

    const proxy_tx = await setup.gnosisSafeProxyFactory
            .connect(setup.roles.prime)
            .createProxy(setup.gnosisSafe.address, "0x00");
    const proxy_receit = await proxy_tx.wait();
    const proxy_addr = proxy_receit.events.filter((data) => {return data.event === PROXY_CREATION})[0].args['proxy'];
    return await ethers.getContractAt(
        "GnosisSafe",
        proxy_addr
    );
}

const seedFactory = async (setup) => {
    const SeedFactory_Factory = await ethers.getContractFactory(
        "SeedFactory",
        setup.roles.prime
    );
    const factory = await SeedFactory_Factory.deploy();

    return factory;
};

const seedMasterCopy = async (setup) => {
    const Seed_Factory = await ethers.getContractFactory(
        "Seed",
        setup.roles.prime
    );
    const seed = await Seed_Factory.deploy();

    return seed;
};

const Lbp = (setup) => new ethers.ContractFactory(LBP.abi, LBP.bytecode, setup.roles.root);

const deployLBPFactory = async (setup) => {
    const LBPFactory_Factory = new ethers.ContractFactory(LBPFactory.abi, LBPFactory.bytecode, setup.roles.root);
    const lbpFactory = await LBPFactory_Factory.deploy(setup.vault.address);
    return lbpFactory;
}

const deployVault = async (setup) => {
    const Vault_factory = new ethers.ContractFactory(Vault.abi, Vault.bytecode, setup.roles.root);
    const vault = await Vault_factory.deploy(constants.ZERO_ADDRESS, constants.ZERO_ADDRESS, 0, 0);

    return vault;
}

const tokens = async (setup) => {
    const PrimeToken_Factory = await ethers.getContractFactory(
        "PrimeToken",
        setup.roles.root
    );
    const seedToken = await PrimeToken_Factory.deploy(
        PRIME_SUPPLY, PRIME_CAP, setup.roles.root.address);

    const ERC20_Factory = await ethers.getContractFactory(
        "ERC20Mock",
        setup.roles.root
    );
    const fundingToken = await ERC20_Factory.deploy('DAI Stablecoin', 'DAI');
    const fundingToken2 = await ERC20_Factory.deploy('Wrapped Ether', 'WETH');

    return { seedToken, fundingToken, fundingToken2 }
}

module.exports = {
    initialize,
    gnosisSafe,
    gnosisProxy,
    seedFactory,
    seedMasterCopy,
    deployLBPFactory,
    Lbp,
    deployVault,
    tokens,
};

