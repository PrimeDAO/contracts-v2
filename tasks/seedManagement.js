const { task } = require("hardhat/config");
const { SeedArguments } = require("../test/test-сonfig.json");

task("sendTransactionSeed", "send transaction to Gnosis Safe")
  .addParam("safe", "address of safe", undefined)
  .setAction(async ({ safe: safeAddress }, { ethers }) => {
    console.log(
      `Sending SeedFactory.deploySeed() transaction to ${safeAddress}`
    );
    const gnosis = api(safeAddress, network.name);
    const { root } = await ethers.getNamedSigners();
    const seedFactoryInstance = await ethers.getContract("SeedFactory");
    const signerInstance = await ethers.getContract("Signer");
    const { data, to } =
      await seedFactoryInstance.populateTransaction.deploySeed(
        SeedArguments.BENEFICIARY,
        SeedArguments.ADMIN,
        [SeedArguments.PRIME, SeedArguments.WETH],
        [SeedArguments.softCap, SeedArguments.hardCap],
        SeedArguments.price,
        SeedArguments.startTime,
        SeedArguments.endTime,
        [SeedArguments.vestingDuration, SeedArguments.vestingCliff],
        SeedArguments.isPermissioned,
        SeedArguments.fee,
        SeedArguments.metadata
      );
    const trx = {
      to,
      value: 0,
      data: data,
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      operation: 0,
      safe: safeAddress,
    };

    const { data: estimate } = await gnosis.getEstimate({
      safe: safeAddress,
      to: trx.to,
      value: trx.value,
      data: trx.data,
      operation: trx.operation,
    });
    trx.safeTxGas = estimate.safeTxGas;
    (trx.baseGas = 0),
      (trx.gasPrice = 0),
      (trx.nonce = await gnosis.getCurrentNonce());

    await signerInstance.once("SignatureCreated", async (signature, hash) => {
      trx.signature = signature;
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
        signature: trx.signature,
      };
      await gnosis.sendTransaction(options);
      console.log("Transaction request sent to Gnosis Successfully");
    });

    await signerInstance
      .connect(root)
      .generateSignature(
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
  });

task("changeOwner", "changes owner of SeedFactory")
  .addParam("address", "new owner address", undefined)
  .setAction(async ({ address }, { ethers }) => {
    console.log(`changing owner of SeedFactory to ${address}`);
    const seedFactoryInstance = await ethers.getContract("SeedFactory");
    const tx = await seedFactoryInstance.transferOwnership(address);
    console.log("Transaction:", tx.hash);
  });
