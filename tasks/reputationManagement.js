const { getReputationParams } = require("./utils/reputation");
const initialRepBalances = require("../inputs/initialRepBalances.json");

task("verifyReputation", "Verifies the contract on etherscan").setAction(
  async (taskArgs, { run, ethers }) => {
    const { repHolders, repAmounts } = getReputationParams(initialRepBalances);
    const reputationInstance = await ethers.getContract("Reputation");

    await run("verify:verify", {
      address: reputationInstance.address,
      constructorArguments: [repHolders, repAmounts],
    });
  }
);
