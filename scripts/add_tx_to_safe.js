require('dotenv').config({path:'./.env'});
const {['4']: {SeedFactory: SEED_FACTORY, Signer: SIGNER, Safe: SAFE}} = require('../contract-addresses.json');
const { api } = require('./utils/gnosis_url_generator.js');
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
} = require('../test/test-сonfig.json');
const { ethers } = require('ethers');
const {PROVIDER_KEY, MNEMONIC} = process.env;
const gnosis = api(SAFE);

const ADMIN = "0x7589116F8dA3ef3934b6A7b6D398c46348d0A718";
const BENEFICIARY = "0x67BE2C36e75B7439ffc2DCb99dBdF4fbB2455930";

const main = async () => {
    const rinkeby = new ethers.providers.InfuraProvider('rinkeby', PROVIDER_KEY);
    const wallet = await (new ethers.Wallet.fromMnemonic(MNEMONIC)).connect(rinkeby);

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
        [vestingDuration, vestingCliff],
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

    const {data: estimate} = await gnosis.getEstimate({
        safe: SAFE,
        to: trx.to,
        value: trx.value,
        data: trx.data,
        operation: trx.operation
    });
    trx.safeTxGas = estimate.safeTxGas;
    trx.baseGas = 0,
    trx.gasPrice = 0,
    trx.nonce = await gnosis.getCurrentNonce();

    await signer.once('SignatureCreated',async (signature, hash)=> {
        trx.signature= signature;
        const options = {
            safe: trx.safe,
            to: trx.to,
            value: trx.value,
            data: trx.data,
            operation: trx.operation,
            safeTxGas: trx.safeTxGas,
            baseGas: trx.baseGas,
            gasPrice: trx.gasPrice,
            gasToken: trx.gasToken,
            refundReceiver: trx.refundReceiver,
            nonce: trx.nonce,
            contractTransactionHash: hash,
            sender: signer.address,
            signature: trx.signature
          }
          await gnosis.sendTransaction(options);
    });

    await signer.generateSignature(
        trx.to,
		trx.value,
		trx.data,
		trx.operation,
		trx.safeTxGas,
		trx.baseGas,
		trx.gasPrice,
		trx.gasToken,
		trx.refundReceiver,
		trx.nonce
    );
}

main().then().catch(console.log);
