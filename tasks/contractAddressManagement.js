const { task } = require("hardhat/config");
const fs = require('fs');
const contracts = require("../contractAddresses.json");
const path = require("path");
const deploymentsDirectory = "../deployments";

task("exportAddress", "exsport contract addresses to contractAddresses.json file")
  .setAction(async ({ ethers }) => {
    console.log(
      `exporting contract addresses to contractAddresses.json`
    );
    const directory = path.resolve(__dirname, deploymentsDirectory);
    fs.readdirSync(directory).forEach(
        folder => {
            contracts[folder] = getContractsAddresses(contracts, directory, folder);
        }
    );
    fs.writeFileSync(
        path.resolve(__dirname,"../contractAddresses.json"),
        JSON.stringify(contracts)
        );
  });

const getContractsAddresses = (contracts, directory, folder) => {
    const network = contracts[folder];
    const regex = /.*\.json/;
    fs.readdirSync(`${directory}/${folder}`).map(
        fileName => {
            if(regex.test(fileName)){
                const rawFile = fs.readFileSync(`${directory}/${folder}/${fileName}`);
                const file = JSON.parse(rawFile);
                network[fileName.split('.')[0]] = file.address;
            }
        }
    );
    return network;
}