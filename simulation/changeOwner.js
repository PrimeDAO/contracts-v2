require('dotenv').config({path:'./.env'});
const hre = require('hardhat');
const {PROVIDER_KEY, SAFE, SEED_FACTORY, MNEMONIC} = process.env;
const ethers = hre.ethers;

const main = async () => {
    
    const rinkeby = new ethers.providers.InfuraProvider('rinkeby', PROVIDER_KEY);
    const wallet = await (new ethers.Wallet.fromMnemonic(MNEMONIC)).connect(rinkeby);

    const SeedFactory = await hre.artifacts.readArtifact("SeedFactory");
    const seedFactory = await new ethers.Contract(SEED_FACTORY, SeedFactory.abi, wallet);

    await seedFactory.transferOwnership(SAFE);

    console.log("New Owner:- ",await seedFactory.owner());
}

main().then().catch(console.log);