const fs = require('fs');
const path = require('path');
const hre = require("hardhat");
require('dotenv').config({path: './.env'});
const DeployedContracts = require('../contractAddresses.json');

const main = async () => {

    console.log("--------------------------------------------------------------\n")

    console.log("Deploying Seed Factory contract");
    const SFFactory = await hre.ethers.getContractFactory("SeedFactory");
    const SeedFactory = await SFFactory.deploy();

    const seedFactory =  await SeedFactory.deployed();

    console.log(`Seed Factory deployed to: ${seedFactory.address}\n`);

    console.log("--------------------------------------------------------------\n")

    console.log("Deploying Seed Master Copy contract");
    const SeedF = await hre.ethers.getContractFactory("Seed");
    const Seed = await SeedF.deploy();

    const seed =  await Seed.deployed();

    console.log(`Seed Master Copy deployed to: ${seed.address}\n`);

    console.log("--------------------------------------------------------------\n")

    console.log("Initialising Seed Factory with master copy contract");
    
    await seedFactory.setMasterCopy(seed.address);

    console.log(`Seed Factory initialised with master copy\n`);

    console.log("--------------------------------------------------------------\n")

    console.log("Deploying Seed Signature contract");
    const SignatureFactory = await hre.ethers.getContractFactory("Signature");
    const Signature = await SignatureFactory.deploy();

    const signature =  await Signature.deployed();

    console.log(`Signature deployed to: ${signature.address}\n`);

    console.log("--------------------------------------------------------------\n")

    console.log(`Saving contract addresses`);

    let {chainId} = await ethers.provider.getNetwork();

    DeployedContracts[chainId] = DeployedContracts[chainId] || {};
    DeployedContracts[chainId].seedFactory = seedFactory.address;
    DeployedContracts[chainId].seed = seed.address;
    DeployedContracts[chainId].signature = signature.address;

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