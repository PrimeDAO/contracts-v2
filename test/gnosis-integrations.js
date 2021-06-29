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
        prime: accounts[0],
        randomPerson: accounts[1],
    };
    const GnosisSafe_Factory = await ethers.getContractFactory(
        "GnosisSafe",
        setup.roles.prime
    );
    setup.gnosisSafe = await GnosisSafe_Factory.deploy();

    const GnosisSafeProxyFactory_Factory = await ethers.getContractFactory(
        "GnosisSafeProxyFactory",
        setup.roles.prime
    );
    setup.gnosisSafeProxyFactory = await  GnosisSafeProxyFactory_Factory.deploy();

    const SeedFactory_Factory = await ethers.getContractFactory(
        "SeedFactory",
        setup.roles.prime
    );
    setup.seedFactory = await  SeedFactory_Factory.deploy();

    const Seed_Factory = await ethers.getContractFactory(
        "Seed",
        setup.roles.prime
    );
    setup.seed = await Seed_Factory.deploy();

    await setup.seedFactory.connect(setup.roles.prime).setMasterCopy(setup.seed.address);

    setup.data = {};

    return setup;
}

const createGnosisProxy = async (setup) => {
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

describe('>> Gnosis Integration', async () => {
    let setup;
    let nonce = 0;
    before('!! setup', async () => {
        setup = await deploy();
        setup.safe = await createGnosisProxy(setup);
    });
    context('$ prequesities', async () => {
        it('seed factory should have correct mastercopy', async () => {
            // checking if the mastercopy is set correct
            expect(await setup.seedFactory.masterCopy()).to.equal(setup.seed.address);
        });
        it('transfer seed factory ownership to safe', async () => {
            // transfering ownership to safe, as seedFactory.deploySeed() should be called by safe only
            await setup.seedFactory.connect(setup.roles.prime).transferOwnership(setup.safe.address);
            expect(await setup.seedFactory.connect(setup.roles.prime).owner()).to.equal(setup.safe.address);
        });
        it("deploys signer contract with correct safe and seedFactory addresses", async () => {
            const Signer_Factory = await ethers.getContractFactory(
                "Signer",
                setup.roles.prime
            );
            setup.signer = await Signer_Factory.deploy(setup.safe.address, setup.seedFactory.address);
        });
        it('setup gnosis proxy', async () => {
            // setting up safe with two owners, 1) prime 2) signer contract
            expect(await setup.safe.isOwner(setup.roles.prime.address)).to.equal(false);
            await setup.safe.connect(setup.roles.prime).setup(
                [setup.roles.prime.address, setup.signer.address],
                1,
                setup.safe.address,
                '0x',
                constants.ZERO_ADDRESS,
                constants.ZERO_ADDRESS,
                0,
                setup.roles.prime.address
            );
            expect(await setup.safe.isOwner(setup.roles.prime.address)).to.equal(true);
            expect(await setup.safe.isOwner(setup.signer.address)).to.equal(true);
        });
    });
    context('$ create and execute transaction to deploy new seed using safe', async () => {
        it('produce valid signature for a transaction', async () => {
            // here we create a transaction object
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
            // once transaction object is created, we send the transaction data along with nonce to generate safeTrx hash
            // and verify if the transaction is valid or not, and sign the hash.
            const transaction = await setup.signer.generateSignature(...trx, nonce);
            const receipt = await transaction.wait();
            const {signature, hash} = receipt.events.filter((data) => {return data.event === SIGNATURE_CREATED})[0].args;
            trx.push(signature);
            setup.data.trx = trx;
            setup.data.hash = hash;
            // checking if the signature produced can correctly be verified by signer contract.
            expect(await setup.signer.isValidSignature(hash,`0x${signature.slice(signaturePosition)}`)).to.equal(magicValue);
        });
        it('executes transaction in safe contract successfully', async () => {
            // once the transaction is signed, we use safe.execTransaction() to execute this transaction using safe.
            // this is where the seedFactory.deploySeed() will be invoked and new seed will be created.
            await expect(setup.safe.connect(setup.roles.prime).execTransaction(...(setup.data.trx))).to.emit(setup.safe, EXECUTION_SUCCESS);
        });
        it('seed should have been deployed', async () => {
            // checking if the seed is created and if, then with correct parameters.
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
    context('$ create and execute transaction other than to deploy new seed using safe', async () => {
        it('reverts', async () => {
            // here we create a transaction object
            nonce++;
            // incorrect function call
            const {data, to} = await setup.seedFactory.populateTransaction.setMasterCopy(
                BENEFICIARY
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
            // once transaction object is created, we send the transaction data along with nonce to generate safeTrx hash
            // and verify if the transaction is valid or not, and sign the hash.
            await expect(setup.signer.generateSignature(...trx, nonce)).to.be.revertedWith("Signer: cannot sign invalid function call");
        });
    });
    context('$ create and execute transaction to deploy new seed using safe from other seedFactory', async () => {
        it('reverts', async () => {
            // here we create a transaction object
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
            // incorrect seedFactory address
            const trx = [
                BENEFICIARY,
                zero,
                data,
                zero,
                oneMillion,
                oneMillion,
                zero,
                constants.ZERO_ADDRESS,
                constants.ZERO_ADDRESS
            ];
            await expect(setup.signer.generateSignature(...trx, nonce)).to.be.revertedWith("Signer: cannot sign invalid transaction");
        });
    });
});
