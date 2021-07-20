const { task } = require("hardhat/config");

task("changeOwner", "changes owner of SeedFactory")
  .addParam("address", "new owner address", undefined)
  .setAction(async ({ address }, { ethers }) => {
    console.log(`changing owner of SeedFactory to ${address}`);
    const seedFactoryInstance = await ethers.getContract("SeedFactory");
    const tx = await seedFactoryInstance.transferOwnership(address);
    console.log("Transaction:", tx.hash);
  });
