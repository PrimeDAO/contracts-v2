// Changes SeedFactory Owner from the deployer to Gnosis Safe

require('dotenv').config({path:'./.env'});
const DeployedContracts = require('../../contractAddresses.json');

const main = async () => {
    console.log("Using rinkeby\n");
    const account = (await ethers.getSigners())[0];
    
    const SEED_FACTORY = DeployedContracts.rinkeby.SeedFactory;
    const Safe = DeployedContracts.rinkeby.Safe;
    const SeedFactory = await hre.artifacts.readArtifact("SeedFactory");
    const seedFactory = await new ethers.Contract(SEED_FACTORY, SeedFactory.abi, account);

    seedFactory.once("OwnershipTransferred", (prev, next) => {
        console.log(`Previous Owner:- ${prev}.\nNew Owner:- ${next}`);
    });
    await seedFactory.connect(account).transferOwnership(Safe);
}

main().then().catch(console.log);