const { task } = require("hardhat/config");
const { SeedArguments } = require("../test/test-сonfig.json");
const { api } = require("./utils/gnosis.js");
const REAL_SEED_JSON = require("../test/real-seed.json");
const { BigNumber } = require("ethers");

task("sendTransactionSeed", "send transaction to Gnosis Safe")
  .addParam("safe", "address of safe", undefined)
  .setAction(async ({ safe: safeAddress }, { ethers }) => {
    /* prettier-ignore */ console.log('>>>> _ >>>> ~ file: seedManagement.js ~ line 11 ~ network.name', network.name)
    console.log(
      `Sending SeedFactory.deploySeed() transaction to ${safeAddress}`
    );
    const gnosis = api(safeAddress, network.name);
    gnosis.getEstimate;

    console.log("1");
    const seedFactoryInstance = await ethers.getContract("SeedFactory");
    console.log("2");
    const signerInstance = await ethers.getContract("SignerV2");

    console.log("3");

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

    console.log("to:", to);

    console.log("4");
    const trx = {
      to,
      value: 0,
      data: data,
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      operation: 0,
      safe: safeAddress,
    };
    console.log("5");

    try {
      const arg = {
        safe: safeAddress,
        to: trx.to,
        value: trx.value,
        data: trx.data,
        operation: trx.operation,
      };
      /* prettier-ignore */ console.log('>>>> _ >>>> ~ file: seedManagement.js ~ line 60 ~ arg', arg)
      const { data: estimate } = await gnosis.getEstimate(arg);
      /* prettier-ignore */ console.log('>>>> _ >>>> ~ file: seedManagement.js ~ line 113 ~ estimate', estimate)
    } catch (error) {
      /* prettier-ignore */ console.log('>>>> _ >>>> ~ file: seedManagement.js ~ line 60 ~ error', error)
    }
    console.log("6");

    trx.safeTxGas = estimate.safeTxGas;
    (trx.baseGas = 0),
      (trx.gasPrice = 0),
      (trx.nonce = await gnosis.getCurrentNonce());

    const { hash, signature } =
      await signerInstance.callStatic.generateSignature(
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

    await (
      await signerInstance.generateSignature(
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
      )
    )
      .wait()
      .then(async () => {
        const trx = await gnosis.sendTransaction(options);
        if (trx) {
          console.log("Transaction request sent to Gnosis Safe");
        }
        return trx;
      });

    console.log("Transaction request sent to Gnosis Successfully");
  });

task("createSeed", "Creates a Seed directly, bypassing Gnosis safe").setAction(
  async (_, hre) => {
    try {
      console.log("Creating Seed...");
      const seedFactoryInstance = await hre.ethers.getContract("SeedFactory");
      // 1. deploy SeedFactory, then new Seed through SeedFactory

      seedFactoryInstance.address;
      /* prettier-ignore */ console.log('>>>> _ >>>> ~ file: seedManagement.js ~ line 116 ~ seedFactoryInstance.address', seedFactoryInstance.address)
      let args;

      args = getDeploySeedArguments();
      /* prettier-ignore */ console.log('>>>> _ >>>> ~ file: seedManagement.js ~ line 118 ~ args', args)
      // args = [
      //   SeedArguments.BENEFICIARY,
      //   SeedArguments.ADMIN,
      //   [SeedArguments.TD2D, SeedArguments.TUSDC],
      //   [SeedArguments.softCap, SeedArguments.hardCap],
      //   SeedArguments.price,
      //   SeedArguments.startTime,
      //   SeedArguments.endTime,
      //   [SeedArguments.vestingDuration, SeedArguments.vestingCliff],
      //   SeedArguments.isPermissioned,
      //   SeedArguments.fee,
      //   SeedArguments.metadata,
      // ];
      return;

      const tx = await seedFactoryInstance.deploySeed(...args);
      console.log(`Seed created through tx ${tx.hash}`);
      await tx.wait();
      console.log("Seed deployed");
    } catch (error) {
      console.log(error);
    }
  }
);

function getDeploySeedArguments(config = REAL_SEED_JSON) {
  return [
    "0x0276a552F424949C934bC74bB623886AAc9Ed807", // Celo Safe
    config.launchDetails.adminAddress,
    [
      config.tokenDetails.projectTokenInfo.address,
      config.launchDetails.fundingTokenInfo.address,
    ],
    [config.launchDetails.fundingTarget, config.launchDetails.fundingMax],
    BigNumber.from(1.0),
    // convert from ISO string to Unix epoch seconds
    Date.parse(config.launchDetails.startDate) / 1000,
    // convert from ISO string to Unix epoch seconds
    Date.parse(config.launchDetails.endDate) / 1000,
    [config.launchDetails.vestingPeriod, config.launchDetails.vestingCliff],
    config.launchDetails.isPermissoned,
    BigNumber.from(0),
    "0x516d5a7a4a427a5374585363394445797162417a66553173696655374c3350675057395879513168516f31355074",
  ];
}

task("changeOwner", "changes owner of SeedFactory")
  .addParam("address", "new owner address", undefined)
  .setAction(async ({ address }, { ethers }) => {
    console.log(`changing owner of SeedFactory to ${address}`);
    const seedFactoryInstance = await ethers.getContract("SeedFactory");
    const tx = await seedFactoryInstance.transferOwnership(address);
    console.log("Transaction:", tx.hash);
  });
