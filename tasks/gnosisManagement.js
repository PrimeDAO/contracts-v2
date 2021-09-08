const { task } = require("hardhat/config");
const { api } = require("./utils/gnosis.js");
const seedArguments = require("../test/test-сonfig.json");

task("addDelegate", "adds delegate to Gnosis Safe")
  .addParam("safe", "address of safe", undefined)
  .addParam("delegate", "address of delegate", undefined)
  .setAction(
    async ({ safe: safeAddress, delegate: delegateAddress }, { ethers }) => {
      console.log(
        `adding delegate ${delegateAddress} to Gnosis Safe ${safeAddress}`
      );
      const gnosis = api(safeAddress, network.name);
      const { root } = await ethers.getNamedSigners();
      const label = "Signer";
      const totp = Math.floor(Math.floor(Date.now() / 1000) / 3600);
      const signature = await root.signMessage(
        delegateAddress + totp.toString()
      );
      const payload = {
        safe: safeAddress,
        delegate: delegateAddress,
        label,
        signature,
      };
      const result = await gnosis.addDelegate(payload);
      if (result.status == 201) {
        console.log("Successfully added");
        return;
      }
      console.log(result);
      return;
    }
  );

task("sendTransaction", "send transaction to Gnosis Safe")
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
        seedArguments.BENEFICIARY,
        seedArguments.ADMIN,
        [seedArguments.PRIME, seedArguments.WETH],
        [seedArguments.softCap, seedArguments.hardCap],
        seedArguments.price,
        seedArguments.startTime,
        seedArguments.endTime,
        [seedArguments.vestingDuration, seedArguments.vestingCliff],
        seedArguments.isPermissioned,
        seedArguments.fee,
        seedArguments.metadata
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
