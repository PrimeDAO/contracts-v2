const PROXY_CREATION = 'ProxyCreation';


const initialize = async (accounts) => {
    const setup = {};
    setup.roles = {
        root: accounts[0],
        prime: accounts[1],
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


module.exports = {
    initialize,
    gnosisSafe,
    gnosisProxy,
    seedFactory,
    seedMasterCopy
};

