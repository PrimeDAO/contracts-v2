require('dotenv').config({path:'./.env'});
const {PROVIDER, MNEMONIC} = process.env;
const DeployedContracts = require('../contractAddresses.json');
const {getNetwork} = require('./utils/helpers.js');

const main = async () => {
    const network = await getNetwork();
    console.log(`Using ${network}\n`);
    const key = PROVIDER.split('/')[PROVIDER.split('/').length-1];
    const rinkeby = new ethers.providers.InfuraProvider(network, key);
    const wallet = await (new ethers.Wallet.fromMnemonic(MNEMONIC)).connect(rinkeby);

    const SEED_FACTORY = DeployedContracts[network].SeedFactory;
    const Safe = DeployedContracts[network].Safe;
    const SeedFactory = await hre.artifacts.readArtifact("SeedFactory");
    const seedFactory = await new ethers.Contract(SEED_FACTORY, SeedFactory.abi, wallet);
    console.log("Current Owner:- ",await seedFactory.owner());
    console.log("New Owner:- ",Safe);
    console.log("Sender:- ",wallet.address);
    console.log("SeedFactory:- ", seedFactory.address);

    seedFactory.once("OwnershipTransferred", (prev, next) => {
        console.log(`
        Previous Owner:- ${prev}.
        New Owner:- ${next}
        `);
    });
    console.log(await seedFactory.estimateGas.transferOwnership(Safe));
    // await seedFactory.connect(wallet).transferOwnership(Safe)
}

main().then().catch(console.log);