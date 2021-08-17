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

task(
  "transferOwnership",
  "Transfers ownership of Reputation to specified address"
)
  .addParam("owner", "address of new owner", undefined, types.string)
  .setAction(async ({ owner }, { run, ethers }) => {
    console.log(`Transferring ownership to ${owner}`);
    const reputationInstance = await ethers.getContract("Reputation");
    const tx = await reputationInstance.transferOwnership(owner);
    console.log("tx: ", tx.hash);
  });
