const { utils } = require("ethers");
const { task, types } = require("hardhat/config");
const { api } = require("./utils/gnosis.js");
const {
  ADMIN,
  BENEFICIARY,
  WETH,
  PRIME,
  softCap,
  hardCap,
  price,
  startTime,
  endTime,
  vestingDuration,
  vestingCliff,
  isPermissioned,
  fee,
  metadata,
} = require("../test/test-сonfig.json");
const DeployedContracts = require("../contractAddresses.json");

task("changeOwner", "changes owner of seed factory")
  .addParam("address", "new owner address", undefined)
  .setAction(async ({ address }, { ethers }) => {
    console.log(`changing owner of SeedFactory to ${address}`);
    const seedFactoryInstance = await ethers.getContract("SeedFactory");
    const tx = await seedFactoryInstance.transferOwnership(address);
    console.log("Transaction:", tx.hash);
  });

task("addTransaction", "adds transaction to Gnosis Safe").setAction(
  async (_, { ethers }) => {
    const { Safe } = DeployedContracts[network.name];
    const gnosis = api(Safe);
    const seedFactoryInstance = await ethers.getContract("SeedFactory");
    const signerInstance = await ethers.getContract("Signer");

    const { data, to } =
      await seedFactoryInstance.populateTransaction.deploySeed(
        BENEFICIARY,
        ADMIN,
        [PRIME, WETH],
        [softCap, hardCap],
        price,
        startTime,
        endTime,
        [vestingDuration, vestingCliff],
        isPermissioned,
        fee,
        metadata
      );

    const trx = {
      to,
      value: 0,
      data: data,
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      operation: 0,
      safe: Safe,
    };

    const { data: estimate } = await gnosis.getEstimate({
      safe: Safe,
      to: trx.to,
      value: trx.value,
      data: trx.data,
      operation: trx.operation,
    });

    trx.safeTxGas = estimate.safeTxGas;
    trx.baseGas = 0;
    trx.gasPrice = 0;
    trx.nonce = await gnosis.getCurrentNonce();

    signerInstance.once("SignatureCreated", async (signature, hash) => {
      const options = {
        safe: trx.safe,
        to: trx.to,
        value: trx.value,
        data: trx.data,
        operation: trx.operation,
        safeTxGas: trx.safeTxGas,
        baseGas: trx.baseGas,
        gasPrice: trx.gasPrice,
        gasToken: trx.gasToken,
        refundReceiver: trx.refundReceiver,
        nonce: trx.nonce,
        contractTransactionHash: hash,
        sender: signerInstance.address,
        signature: signature,
      };

      await gnosis.sendTransaction(options);
    });

    await signer.generateSignature(
      trx.to,
      trx.value,
      trx.data,
      trx.operation,
      trx.safeTxGas,
      trx.baseGas,
      trx.gasPrice,
      trx.gasToken,
      trx.refundReceiver,
      trx.nonce
    );
  }
);
