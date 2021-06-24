const {expect} = require('chai');
const {constants} = require('@openzeppelin/test-helpers');
const {BENEFICIARY, ADMIN} = require('../config.json');
const {
    WETH,
    PRIME,
    softCap,
    hardCap,
    price,
    startTime,
    endTime,
    vestingDuration,
    vestingCliff,
    isPermissioned,
    fee,
    metadata,
} = require('../testSeedDetails.json');

const zero = 0;
const oneMillion = 1000000;
const magicValue = `0x20c13b0b`;
const signaturePosition = 196;
const EXECUTION_SUCCESS = 'ExecutionSuccess';
const PROXY_CREATION = 'ProxyCreation';
const SIGNATURE_CREATED = 'SignatureCreated';


const deploy = async () => {
    const setup = {};
    const accounts = await ethers.getSigners();
    setup.roles = {
        deployer: accounts[0],
        randomPerson: accounts[1],
    };
    const GnosisSafe_Factory = await ethers.getContractFactory(
        "GnosisSafe",
        setup.roles.deployer
    );
    setup.gnosisSafe = await GnosisSafe_Factory.deploy();

    const GnosisSafeProxyFactory_Factory = await ethers.getContractFactory(
        "GnosisSafeProxyFactory",
        setup.roles.deployer
    );
    setup.gnosisSafeProxyFactory = await  GnosisSafeProxyFactory_Factory.deploy();

    const Signer_Factory = await ethers.getContractFactory(
        "Signer",
        setup.roles.deployer
    );
    setup.signer = await Signer_Factory.deploy();

    const SeedFactory_Factory = await ethers.getContractFactory(
        "SeedFactory",
        setup.roles.deployer
    );
    setup.seedFactory = await  SeedFactory_Factory.deploy();

    const Seed_Factory = await ethers.getContractFactory(
        "Seed",
        setup.roles.deployer
    );
    setup.seed = await Seed_Factory.deploy();

    await setup.seedFactory.connect(setup.roles.deployer).setMasterCopy(setup.seed.address);

    setup.data = {};

    return setup;
}

const createGnosisProxy = async (setup) => {
    const proxy_tx = await setup.gnosisSafeProxyFactory
            .connect(setup.roles.deployer)
            .createProxy(setup.gnosisSafe.address, "0x00");
    const proxy_receit = await proxy_tx.wait();
    const proxy_addr = proxy_receit.events.filter((data) => {return data.event === PROXY_CREATION})[0].args['proxy'];
    return await ethers.getContractAt(
        "GnosisSafe",
        proxy_addr
    );
}

describe('>> Gnosis Integration', async () => {
    let setup;
    let nonce = 0;
    before('!! setup', async () => {
        setup = await deploy();
        setup.safe = await createGnosisProxy(setup);
    });
    context('$ prequesities', async () => {
        it('set masterCopy at Seed Factory', async () => {
            expect(await setup.seedFactory.masterCopy()).to.equal(setup.seed.address);
        });
        it('transfer seed factory ownership to safe', async () => {
            await setup.seedFactory.connect(setup.roles.deployer).transferOwnership(setup.safe.address);
            expect(await setup.seedFactory.connect(setup.roles.deployer).owner()).to.equal(setup.safe.address);
        });
        it('setup gnosis proxy', async () => {
            expect(await setup.safe.isOwner(setup.roles.deployer.address)).to.equal(false);
            await setup.safe.connect(setup.roles.deployer).setup(
                [setup.roles.deployer.address, setup.signer.address],
                1,
                setup.safe.address,
                '0x',
                constants.ZERO_ADDRESS,
                constants.ZERO_ADDRESS,
                0,
                setup.roles.deployer.address
            );
            expect(await setup.safe.isOwner(setup.roles.deployer.address)).to.equal(true);
            expect(await setup.safe.isOwner(setup.signer.address)).to.equal(true);
        });
    });
    context('$ create and execute transaction to deploy new seed using safe', async () => {
        it('produce valid signature for a transaction', async () => {
            nonce++;
            const {data, to} = await setup.seedFactory.populateTransaction.deploySeed(
                BENEFICIARY,
                ADMIN,
                [PRIME,WETH],
                [softCap,hardCap],
                price,
                startTime,
                endTime,
                vestingDuration,
                vestingCliff,
                isPermissioned,
                fee,
                metadata
            );
            const trx = [
                to,
                zero,
                data,
                zero,
                oneMillion,
                oneMillion,
                zero,
                constants.ZERO_ADDRESS,
                constants.ZERO_ADDRESS
            ];
            const hash = await setup.safe.connect(setup.roles.deployer).encodeTransactionData(...trx, nonce);
            const transaction = await setup.signer.generateSignature(hash);
            const receipt = await transaction.wait();
            const signature = receipt.events.filter((data) => {return data.event === SIGNATURE_CREATED})[0].args['signature'];
            trx.push(signature);
            setup.data.trx = trx;
            setup.data.hash = hash;
            expect(await setup.signer.isValidSignature(hash,`0x${signature.slice(signaturePosition)}`)).to.equal(magicValue);
        });
        it('executes transaction in safe contract successfully', async () => {
            await expect(setup.safe.execTransaction(...(setup.data.trx))).to.emit(setup.safe, EXECUTION_SUCCESS);
        });
        it('deploys seed', async () => {
            const eventsFilter = setup.seedFactory.filters.SeedCreated();
            const events = await setup.seedFactory.queryFilter(eventsFilter);
            const seedAddress = await events[0].args.newSeed;
            const seed = await ethers.getContractAt(
                "Seed",
                seedAddress
            );
            expect(await seed.beneficiary()).to.equal(BENEFICIARY);
            expect(await seed.admin()).to.equal(ADMIN);
            expect((await seed.hardCap()).toString()).to.equal(hardCap);
        });
    });
});
