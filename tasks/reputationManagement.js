const { getReputationParams } = require("./utils/reputation");

task("verifyReputation", "Verifies the contract on etherscan").setAction(
  async (taskArgs, { run, ethers }) => {
    const { repHolders, repAmounts } = getReputationParams();
    const reputationInstance = await ethers.getContract("Reputation");

    await run("verify:verify", {
      address: reputationInstance.address,
      constructorArguments: [repHolders, repAmounts],
    });
  }
);
