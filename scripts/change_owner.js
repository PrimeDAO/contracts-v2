require('dotenv').config({path:'./.env'});
const hre = require('hardhat');
const {PROVIDER_KEY, MNEMONIC} = process.env;
const {SAFE} = require("../config.json");
const {'4': {SEED_FACTORY}} = require('../contract-addresses.json');
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
    await seedFactory.connect(wallet).transferOwnership(SAFE)
}

main().then().catch(console.log);