const fs = require('fs');
const hre = require("hardhat");
require('dotenv').config({path: './.env'});
const DeployedContracts = require('../contractAddresses.json');
const {getNetwork} = require('./utils/helpers');

const main = async () => {

	const network = await getNetwork();
	const SAFE = DeployedContracts[network].Safe;

    console.log("--------------------------------------------------------------\n")

    console.log("Deploying Seed Factory contract");
    const SeedFactory_Factory = await hre.ethers.getContractFactory("SeedFactory");
    const seedFactory = await SeedFactory_Factory.deploy();

    console.log(`Seed Factory deployed to: ${seedFactory.address}\n`);

    console.log("--------------------------------------------------------------\n")

    console.log("Deploying Seed Master Copy contract");
    const Seed_Factory = await hre.ethers.getContractFactory("Seed");
    const seed = await Seed_Factory.deploy();

    console.log(`Seed Master Copy deployed to: ${seed.address}\n`);

    console.log("--------------------------------------------------------------\n")

    console.log("Initialising Seed Factory with master copy contract");
    
    await seedFactory.setMasterCopy(seed.address);

    console.log(`Seed Factory initialised with master copy\n`);

    console.log("--------------------------------------------------------------\n")

    console.log("Deploying Signer contract");
    const Signer_Factory = await hre.ethers.getContractFactory("Signer");
    const signer = await Signer_Factory.deploy(SAFE, seedFactory.address);

    console.log(`Signer deployed to: ${signer.address}\n`);

    console.log("--------------------------------------------------------------\n")

    console.log(`Saving contract addresses`);

    DeployedContracts[network] = DeployedContracts[network] || {};
    DeployedContracts[network].SeedFactory = seedFactory.address;
    DeployedContracts[network].Seed = seed.address;
    DeployedContracts[network].Signer = signer.address;

    fs.writeFileSync(
      `./contractAddresses.json`,
      JSON.stringify(DeployedContracts), 
      (err) => {
      if(err) throw err;
    });

    console.log(`Contract Addresses saved`);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });