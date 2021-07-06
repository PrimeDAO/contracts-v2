require('dotenv').config({path:'./.env'});
const hre = require('hardhat');
const {PROVIDER_KEY, MNEMONIC} = process.env;
const {'rinkeby': {SeedFactory: SEED_FACTORY, Safe}} = require('../contractAddresses.json');
const ethers = hre.ethers;

const main = async () => {
    
    const rinkeby = new ethers.providers.InfuraProvider('rinkeby', PROVIDER_KEY);
    const wallet = await (new ethers.Wallet.fromMnemonic(MNEMONIC)).connect(rinkeby);

    const SeedFactory = await hre.artifacts.readArtifact("SeedFactory");
    const seedFactory = await new ethers.Contract(SEED_FACTORY, SeedFactory.abi, wallet);

    seedFactory.once("OwnershipTransferred", (prev, next) => {
        console.log(`
        Previous Owner:- ${prev}.
        New Owner:- ${next}
        `);
    });
    await seedFactory.connect(wallet).transferOwnership(Safe)
}

main().then().catch(console.log);