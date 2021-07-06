const {expect} = require('chai');
const {constants} = require('@openzeppelin/test-helpers');
const {BENEFICIARY, ADMIN} = require('../../config.json');
const {
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
} = require('../test-сonfig.json');
const init = require("../test-init.js");

const zero = 0;
const oneMillion = 1000000;
const magicValue = `0x20c13b0b`;
const signaturePosition = 196;
const SIGNATURE_CREATED = 'SignatureCreated';

const deploy = async () => {
    const setup = await init.initialize(await ethers.getSigners());

    setup.gnosisSafe = await init.gnosisSafe(setup);

    setup.proxySafe = await init.gnosisProxy(setup);

    setup.seedFactory = await init.seedFactory(setup);

    setup.seed = await init.seedMasterCopy(setup);

    await setup.seedFactory.connect(setup.roles.prime).setMasterCopy(setup.seed.address);

    setup.data = {};

    return setup;
}

describe("Contract: Signer", async () => {
    let setup;
    let nonce = 0;
    let Signer_Factory;
    before('!! setup', async () => {
        setup = await deploy();
        Signer_Factory = await ethers.getContractFactory(
            "Signer",
            setup.roles.root
        );
    });
    context(">> deploy signer contract", async () => {
        context("invalid constructor parameters", async () => {
            it("reverts when safe address is zero", async () => {
                await expect(Signer_Factory.deploy(constants.ZERO_ADDRESS, setup.seedFactory.address,))
                    .to.revertedWith("Signer: Safe and SeedFactory address cannot be zero");
            });
            it("reverts when seed factory address is zero", async () => {
                await expect(Signer_Factory.deploy(setup.proxySafe.address, constants.ZERO_ADDRESS))
                    .to.revertedWith("Signer: Safe and SeedFactory address cannot be zero");
            });
        });
        context("valid constructor parameters", async () => {
            it("deploys signer contract", async () => {
                setup.signer = await Signer_Factory.deploy(setup.proxySafe.address, setup.seedFactory.address);
                expect(await setup.signer.connect(setup.roles.root).safe()).to.equal(setup.proxySafe.address);
                expect(await setup.signer.connect(setup.roles.root).seedFactory()).to.equal(setup.seedFactory.address);
            });
        });
    });
    context(">> generateSignature", async () => {
        context("invalid arguments", async () => {
            it("reverts on invalid function call", async () => {
                // here we create a transaction object
                nonce++;
                // incorrect function call
                const {data, to} = await setup.seedFactory.populateTransaction.setMasterCopy(
                    BENEFICIARY
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
                    constants.ZERO_ADDRESS
                ];
                // once transaction object is created, we send the transaction data along with nonce to generate safeTrx hash
                // and verify if the transaction is valid or not, and sign the hash.
                await expect(setup.signer.generateSignature(...trx, nonce)).to.be.revertedWith("Signer: cannot sign invalid function call");
            });
            it("reverts on invalid to field", async () => {
                // here we create a transaction object
                nonce++;
                const {data, to} = await setup.seedFactory.populateTransaction.deploySeed(
                    BENEFICIARY,
                    ADMIN,
                    [PRIME,WETH],
                    [softCap,hardCap],
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
                    constants.ZERO_ADDRESS
                ];
                await expect(setup.signer.generateSignature(...trx, nonce)).to.be.revertedWith("Signer: cannot sign invalid transaction");
            });
        });
        context("valid arguments", async () => {
            it("produces valid signature", async () => {
                const {data, to} = await setup.seedFactory.populateTransaction.deploySeed(
                    BENEFICIARY,
                    ADMIN,
                    [PRIME,WETH],
                    [softCap,hardCap],
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
                    constants.ZERO_ADDRESS
                ];
                // once transaction object is created, we send the transaction data along with nonce to generate safeTrx hash
                // and verify if the transaction is valid or not, and sign the hash.
                const transaction = await setup.signer.generateSignature(...trx, nonce);
                const hashData = await setup.proxySafe.encodeTransactionData(...trx, nonce);
                nonce++;
                const receipt = await transaction.wait();
                const {signature, hash} = receipt.events.filter((data) => {return data.event === SIGNATURE_CREATED})[0].args;
                trx.push(signature);
                setup.data.trx = trx;
                setup.data.hash = hash;
                setup.data.hashData = hashData;
                // checking if the signature produced can correctly be verified by signer contract.
                expect(await setup.signer.isValidSignature(hashData,`0x${signature.slice(signaturePosition)}`)).to.equal(magicValue);
            });
        });
    });
    context(">> isValidSignature", async () => {
        context("signature is invalid", async () => {
            it("doesn't returns magic value", async () => {
                expect(await setup.signer.isValidSignature(setup.data.hashData, setup.data.hashData)).to.equal("0x30780000");
            });
        })
    });
});