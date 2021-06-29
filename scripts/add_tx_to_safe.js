require('dotenv').config({path:'./.env'});
const hre = require('hardhat');
const {SAFE, ADMIN, BENEFICIARY,} = require('../config.json');
const {['4']: {SEED_FACTORY, SIGNER}} = require('../contract-addresses.json');
const axios = require('axios');
const { generateUrlFor, api } = require('./utils/gnosis_url_generator.js');
const {send} = require('./utils/helpers.js');
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
const {PROVIDER_KEY, MNEMONIC} = process.env;
const generateUrl = generateUrlFor(SAFE);
const ethers = hre.ethers;

const main = async () => {
    const rinkeby = new ethers.providers.InfuraProvider('rinkeby', PROVIDER_KEY);
    const wallet = await (new ethers.Wallet.fromMnemonic(MNEMONIC)).connect(rinkeby);

    const Safe = await hre.artifacts.readArtifact("ISafe");
    const safe = await new ethers.Contract(SAFE, Safe.abi, wallet);

    const SeedFactory = await hre.artifacts.readArtifact("SeedFactory");
    const seedFactory = await new ethers.Contract(SEED_FACTORY, SeedFactory.abi, wallet);

    const Signer = await hre.artifacts.readArtifact("Signer");
    const signer = await new ethers.Contract(SIGNER, Signer.abi, wallet);

    const {data, to} = await seedFactory.populateTransaction.deploySeed(
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
    const trx = {
        to,
        value: 0,
        data: data,
        gasToken: '0x0000000000000000000000000000000000000000',
        refundReceiver: '0x0000000000000000000000000000000000000000',
        operation: 0,
        safe: SAFE,
    }

    const {data: estimate} = await axios.post(generateUrl(api.getEstimate), {
        safe: '0x2E46E481d57477A0663a7Ec61E7eDc65F4cb7F5C',
        to: trx.to,
        value: trx.value,
        data: trx.data,
        operation: trx.operation
    });
    trx.safeTxGas = estimate.safeTxGas;
    trx.baseGas = 0,
    trx.gasPrice = 0,
    trx.nonce = estimate.lastUsedNonce+1;

    trx.hash = await safe.getTransactionHash(
        trx.to,
        trx.value,
        trx.data,
        trx.operation,
        trx.safeTxGas,
        trx.baseGas,
        trx.gasPrice,
        trx.gasToken,
        trx.refundReceiver,
        trx.nonce);

    await signer.once('SignatureCreated',async (signature)=> {
        trx.signature= signature;
        send(trx,SEED_SIGNATURE);
    })

    await signer.generateSignature(trx.hash);
}

main().then().catch(console.log);