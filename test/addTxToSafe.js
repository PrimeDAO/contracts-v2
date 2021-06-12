require('dotenv').config({path:'./.env'});
const hre = require('hardhat');
const {PROVIDER_KEY, SAFE, SEED_FACTORY, SEED_SIGNATURE, ADMIN, BENEFICIARY, MNEMONIC} = process.env;
const ethers = hre.ethers;
const axios = require('axios');
const { generateUrlFor, api } = require('./GnosisApi.js');
const generateUrl = generateUrlFor(SAFE);

const WETH = '0xc778417E063141139Fce010982780140Aa0cD5Ab';
const PRIME = '0x561b8e669cE0239c560CAe80b3717De61aff19be';

function convertToHex(str) {
    var hex = '';
    for(var i=0;i<str.length;i++) {
        hex += ''+str.charCodeAt(i).toString(16);
    }
    return hex;
}

const opts = [
    BENEFICIARY,
    ADMIN,
    [PRIME,WETH],
    ['100000000000000000000','10000000000000000000000'],
    [Date.now(),Date.now()+10000],
    '1500000000000000000',
    Math.floor(360*86400),
    Math.floor(22*86400),
    false,
    2,
    ethers.utils.formatBytes32String(`0x`)
]

const main = async () => {
    const rinkeby = new ethers.providers.InfuraProvider('rinkeby', PROVIDER_KEY);
    const wallet = await (new ethers.Wallet.fromMnemonic(MNEMONIC)).connect(rinkeby);

    const Safe = await hre.artifacts.readArtifact("ISafe");
    const safe = await new ethers.Contract(SAFE, Safe.abi, wallet);

    const SeedFactory = await hre.artifacts.readArtifact("SeedFactory");
    const seedFactory = await new ethers.Contract(SEED_FACTORY, SeedFactory.abi, wallet);

    const SeedSignature = await hre.artifacts.readArtifact("SeedSignature");
    const seedSignature = await new ethers.Contract(SEED_SIGNATURE, SeedSignature.abi, wallet);

    const {data, to} = await seedFactory.populateTransaction.deploySeed(...opts);
    const trx = {
        to,
        value: 0,
        data,
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
    trx.baseGas = estimate.baseGas,
    trx.dataGas = estimate.dataGas,
    trx.gasPrice = estimate.gasPrice,
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

    await seedSignature.once('SignatureCreated',async (error)=> {
        console.log(error);
        const sign = error;
        trx.signature= sign;
  
        const options = {
          safe: trx.safe,
          to: trx.to,
          value: trx.value,
          data: trx.data,
          operation: trx.operation,
          safeTxGas: trx.safeTxGas,
          baseGas: trx.baseGas,
          gasPrice: trx.gasPrice,
          nonce: trx.nonce,
          contractTransactionHash: trx.hash,
          sender: seedSignature.address,
          signature: trx.signature
        }
        console.log(options);
        const res = await axios.post(generateUrl(api.sendTransaction), options);
        console.log(res);
      })

    await seedSignature.generateSignature(trx.hash);
}

main().then().catch(console.log);