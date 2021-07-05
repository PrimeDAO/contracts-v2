const fs = require('fs');
const hre = require("hardhat");
require('dotenv').config({path: './.env'});
const DeployedContracts = require('../contract-addresses.json');

const main = async () => {

    console.log("--------------------------------------------------------------\n")

    console.log("Deploying Prime Token V2 contract");
    const PrimeTokenV2_Factory = await hre.ethers.getContractFactory("PrimeTokenV2");
    const primeTokenV2 = await PrimeTokenV2_Factory.deploy(process.env.GENESIS_MULTISIG);

    console.log(`Prime Token V2 deployed to: ${primeTokenV2.address}\n`);

    console.log("--------------------------------------------------------------\n")

    console.log("Deploying Merkle Drop contract");
    const MerkleDrop_Factory = await hre.ethers.getContractFactory("MerkleDrop");
    const merkleDrop = await MerkleDrop_Factory.deploy();

    console.log(`Merkle Drop deployed to: ${merkleDrop.address}\n`);

    console.log("--------------------------------------------------------------\n")

    console.log(`Saving contract addresses`);

    let {chainId} = await ethers.provider.getNetwork();

    DeployedContracts[chainId] = DeployedContracts[chainId] || {};
    DeployedContracts[chainId].PRIME_TOKEN_V2 = primeTokenV2.address;
    DeployedContracts[chainId].MERKLE_DROP = merkleDrop.address;

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