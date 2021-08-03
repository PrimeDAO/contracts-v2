const fs = require("fs");
const { task } = require("hardhat/config");
const { utils, BigNumber } = require("ethers");
const { createMerkleProofs, createMerkleRoot } = require("./utils/merkle");
const { formatEther } = require("ethers/lib/utils");
const { parseEther } = utils;

task("initializeMerkle", "initializes MerkleDrop contract")
  .addParam("nexus", "sort of administrator address", undefined, types.string)
  .addParam(
    "funder",
    "funding address (in theory could be several)",
    undefined,
    types.string
  )
  .addParam("token", "address of token", undefined, types.string)
  .addParam(
    "threshold",
    "block number after which users can claim",
    undefined,
    types.string
  )
  .setAction(async ({ nexus, funder, token, threshold }, { ethers }) => {
    console.log(
      `Initialize MerkleDrop w/ nexus=${nexus}, funder=${funder}, token=${token}, threshold=${threshold}`
    );
    const merkleDropInstance = await ethers.getContract("MerkleDrop");
    const blockNumber = BigNumber.from(threshold);
    const tx = await merkleDropInstance.initialize(
      nexus,
      [funder],
      token,
      blockNumber
    );
    console.log("Transaction:", tx.hash);
  });

task("seedMerkle", "seeds new allocation").setAction(
  async ({ token }, { ethers }) => {
    const allocations = JSON.parse(fs.readFileSync("allocations.json"));
    const totalAllocation = Object.values(allocations).reduce(
      (accumulator, currentValue) => {
        return accumulator.add(parseEther(currentValue));
      },
      BigNumber.from(0)
    );

    console.log(
      `seed new allocation with total volume ${formatEther(totalAllocation)}`
    );

    const merkleDropInstance = await ethers.getContract("MerkleDrop");
    const merkleRoot = createMerkleRoot(allocations);
    const merkleProofs = await createMerkleProofs(allocations);
    const tx = await merkleDropInstance.seedNewAllocations(
      merkleRoot,
      totalAllocation
    );

    fs.writeFileSync("merkleProofs.json", JSON.stringify(merkleProofs));
    console.log("saved merkle proofs: merkleProofs.json");
    console.log("seedNewAllocations tx:", tx.hash);
  }
);

task("approveMerkle", "approves token spending for MerkleContract")
  .addParam("token", "address of token", undefined, types.string)
  .setAction(async ({ token }, { ethers }) => {
    const allocations = JSON.parse(fs.readFileSync("allocations.json"));
    const totalAllocation = Object.values(allocations).reduce(
      (accumulator, currentValue) => {
        return accumulator.add(parseEther(currentValue));
      },
      BigNumber.from(0)
    );

    console.log(
      `approve MerkleDrop to spend ${formatEther(
        totalAllocation
      )} tokens with address ${token}`
    );
    const merkleDropInstance = await ethers.getContract("MerkleDrop");
    const tokenInstance = await ethers.getContractAt("PrimeToken", token);
    const approveSpendingTx = await tokenInstance.approve(
      merkleDropInstance.address,
      totalAllocation
    );
    console.log("tx: ", approveSpendingTx.hash);
  });
