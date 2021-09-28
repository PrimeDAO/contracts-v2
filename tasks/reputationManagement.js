const fs = require("fs").promises;
const path = require("path");
const { utils, BigNumber } = require("ethers");
const { getReputationParams } = require("./utils/reputation");
const initialRepBalances = require("../inputs/initialRepBalances.json");

const { formatEther } = utils;

task(
  "transferOwnership",
  "Transfers ownership of Reputation to specified address"
)
  .addParam(
    "contractname",
    "name of the Reputation token: Reputation or RatingReputation",
    undefined,
    types.string
  )
  .addParam("owner", "address of new owner", undefined, types.string)
  .setAction(async ({ owner, contractname }, { ethers }) => {
    console.log(`Transferring ownership of ${contractname} to ${owner}`);
    const reputationInstance = await ethers.getContract(contractname);
    const tx = await reputationInstance.transferOwnership(owner);
    console.log("tx: ", tx.hash);
  });

task("batchMint", "Mints initial REP balances")
  .addParam(
    "contractname",
    "name of the Reputation token: Reputation or RatingReputation",
    undefined,
    types.string
  )
  .addParam(
    "filename",
    "name of the file that specifies balances",
    undefined,
    types.string
  )
  .setAction(async ({ filename, contractname }, { ethers }) => {
    const filePath = path.resolve(__dirname, `../inputs/${filename}`);
    const balances = JSON.parse(await fs.readFile(filePath));

    const { repHolders, repAmounts } = getReputationParams(balances);
    const batchMintAmount = formatEther(
      repAmounts.reduce(
        (accumulator, currentValue) => accumulator.add(currentValue),
        BigNumber.from(0)
      )
    );

    console.log(
      `Batch-minting ${batchMintAmount} to ${repHolders.length} addresses`
    );

    const reputationInstance = await ethers.getContract(contractname);
    const tx = await reputationInstance.batchMint(repHolders, repAmounts);
    console.log("tx: ", tx.hash);
  });
