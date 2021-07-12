// For Trial/Test - Sends transaction signer by Signer Contract to the Gnosis Safe API

require('dotenv').config({path:'./.env'});
const DeployedContracts = require('../contractAddresses.json');
const { api } = require('./utils/gnosis.js');
const {getNetwork} = require('./utils/helpers.js');
const {
    ADMIN,
    BENEFICIARY,
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
} = require('../test/test-сonfig.json');

const main = async () => {
    const network = await getNetwork();
    const account = (await ethers.getSigners())[0];

    const SEED_FACTORY = DeployedContracts[network].SeedFactory;
    const SIGNER = DeployedContracts[network].Signer;
    const SAFE = DeployedContracts[network].Safe;

    // Step 1 
    const gnosis = api(SAFE);

    const SeedFactory = await hre.artifacts.readArtifact("SeedFactory");
    const seedFactory = await new ethers.Contract(SEED_FACTORY, SeedFactory.abi, account);

    const Signer = await hre.artifacts.readArtifact("Signer");
    const signer = await new ethers.Contract(SIGNER, Signer.abi, account);

    // step 2
    const transaction = {};
    transaction.to = seedFactory.address;
    transaction.value = 0;
    transaction.operation = 0;
    transaction.safe = SAFE;
    const {data} = await seedFactory.populateTransaction.deploySeed(
        BENEFICIARY,
        ADMIN,
        [PRIME,WETH],
        [softCap,hardCap],
        price,
        startTime,
        endTime,
        [vestingDuration, vestingCliff],
        isPermissioned,
        fee,
        metadata
    );
    transaction.data = data;

    // step 3
    const estimate = await gnosis.getEstimate(transaction);
    transaction.safeTxGas = estimate.data.safeTxGas;

    // step 4
    transaction.baseGas        = 0;
    transaction.gasPrice       = 0;
    transaction.gasToken       = '0x0000000000000000000000000000000000000000';
    transaction.refundReceiver = '0x0000000000000000000000000000000000000000';

    // step 5
    transaction.nonce = await gnosis.getCurrentNonce();

    // step 6
    const {hash, signature} = await signer.callStatic.generateSignature(
        transaction.to,
        transaction.value,
        transaction.data,
        transaction.operation,
        transaction.safeTxGas,
        transaction.baseGas,
        transaction.gasPrice,
        transaction.gasToken,
        transaction.refundReceiver,
        transaction.nonce
    );
    transaction.contractTransactionHash = hash;
    transaction.signature = signature;

    // step 7
    transaction.sender = signer.address;

    //step 8
    (await signer.generateSignature(
        transaction.to,
        transaction.value,
        transaction.data,
        transaction.operation,
        transaction.safeTxGas,
        transaction.baseGas,
        transaction.gasPrice,
        transaction.gasToken,
        transaction.refundReceiver,
        transaction.nonce)).wait()
        .then(
            async () => await gnosis.sendTransaction(transaction)
        );
}

main().then().catch(console.log);
