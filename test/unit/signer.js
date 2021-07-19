const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { constants } = require("@openzeppelin/test-helpers");
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
} = require("../test-сonfig.json");
const { setupSignerTest } = require("../helpers");

use(solidity);

const zero = 0;
const oneMillion = 1000000;
const magicValue = `0x20c13b0b`;
const signaturePosition = 196;
const SIGNATURE_CREATED = "SignatureCreated";
const PROXY_CREATION = "ProxyCreation";

describe.only("Contract: Signer", async () => {
  let setup, Signer_Factory, seedFactory, prime, signer, proxySafe;
  let nonce = 0;
  const dataStore = {};

  before("!! setup", async () => {
    ({
      signerInstance: signer,
      seedFactoryInstance: seedFactory,
      proxySafeInstance: proxySafe,
      root,
      prime,
    } = await setupSignerTest());
  });

  context(">> deploy signer contract", async () => {
    context("invalid constructor parameters", async () => {
      it("reverts when safe address is zero", async () => {
        Signer_Factory = await ethers.getContractFactory("Signer", root);
        await expect(
          Signer_Factory.deploy(constants.ZERO_ADDRESS, seedFactory.address)
        ).to.revertedWith(
          "Signer: Safe and SeedFactory address cannot be zero"
        );
      });
      it("reverts when seed factory address is zero", async () => {
        await expect(
          Signer_Factory.deploy(proxySafe.address, constants.ZERO_ADDRESS)
        ).to.revertedWith(
          "Signer: Safe and SeedFactory address cannot be zero"
        );
      });
    });

    context("valid constructor parameters", async () => {
      it("deploys signer contract", async () => {
        expect(await signer.safe()).to.equal(proxySafe.address);
        expect(await signer.seedFactory()).to.equal(seedFactory.address);
      });
    });
  });

  context(">> generateSignature", async () => {
    context("invalid arguments", async () => {
      it("reverts on invalid function call", async () => {
        // here we create a transaction object
        nonce++;
        // incorrect function call
        const { data, to } =
          await seedFactory.populateTransaction.setMasterCopy(BENEFICIARY);
        const trx = [
          to,
          zero,
          data,
          zero,
          oneMillion,
          oneMillion,
          zero,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS,
        ];
        // once transaction object is created, we send the transaction data along with nonce to generate safeTrx hash
        // and verify if the transaction is valid or not, and sign the hash.
        await expect(
          signer.generateSignature(...trx, nonce)
        ).to.be.revertedWith("Signer: cannot sign invalid function call");
      });
      it("reverts on invalid to field", async () => {
        // here we create a transaction object
        nonce++;
        const { data, to } = await seedFactory.populateTransaction.deploySeed(
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
        // incorrect seedFactory address
        const trx = [
          BENEFICIARY,
          zero,
          data,
          zero,
          oneMillion,
          oneMillion,
          zero,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS,
        ];
        await expect(
          signer.generateSignature(...trx, nonce)
        ).to.be.revertedWith("Signer: cannot sign invalid transaction");
      });
    });
    context("valid arguments", async () => {
      it("produces valid signature", async () => {
        const { data, to } = await seedFactory.populateTransaction.deploySeed(
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
        const trx = [
          to,
          zero,
          data,
          zero,
          oneMillion,
          oneMillion,
          zero,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS,
        ];
        // once transaction object is created, we send the transaction data along with nonce to generate safeTrx hash
        // and verify if the transaction is valid or not, and sign the hash.
        const transaction = await signer.generateSignature(...trx, nonce);
        const hashData = await proxySafe.encodeTransactionData(...trx, nonce);
        nonce++;
        const receipt = await transaction.wait();
        const { signature, hash } = receipt.events.filter((data) => {
          return data.event === SIGNATURE_CREATED;
        })[0].args;
        trx.push(signature);
        dataStore.trx = trx;
        dataStore.hash = hash;
        dataStore.hashData = hashData;
        // checking if the signature produced can correctly be verified by signer contract.
        expect(
          await signer.isValidSignature(
            hashData,
            `0x${signature.slice(signaturePosition)}`
          )
        ).to.equal(magicValue);
      });
    });
  });

  context(">> isValidSignature", async () => {
    context("signature is invalid", async () => {
      it("doesn't returns magic value", async () => {
        expect(
          await signer.isValidSignature(dataStore.hashData, dataStore.hashData)
        ).to.equal("0x30780000");
      });
    });
  });
});
