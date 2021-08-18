const { utils, BigNumber } = require("ethers");
const { getReputationParams } = require("./utils/reputation");
const initialRepBalances = require("../inputs/initialRepBalances.json");

const { formatEther } = utils;

task(
  "transferOwnership",
  "Transfers ownership of Reputation to specified address"
)
  .addParam("owner", "address of new owner", undefined, types.string)
  .setAction(async ({ owner }, { ethers }) => {
    console.log(`Transferring ownership to ${owner}`);
    const reputationInstance = await ethers.getContract("Reputation");
    const tx = await reputationInstance.transferOwnership(owner);
    console.log("tx: ", tx.hash);
  });

task("batchMint", "Mints initial REP balances").setAction(
  async (taskArgs, { ethers }) => {
    const { repHolders, repAmounts } = getReputationParams(initialRepBalances);
    const batchMintAmount = formatEther(
      repAmounts.reduce(
        (accumulator, currentValue) => accumulator.add(currentValue),
        BigNumber.from(0)
      )
    );

    console.log(
      `Batch-minting ${batchMintAmount} to ${repHolders.length} addresses`
    );

    const reputationInstance = await ethers.getContract("Reputation");
    const tx = await reputationInstance.batchMint(repHolders, repAmounts);
    console.log("tx: ", tx.hash);
  }
);
