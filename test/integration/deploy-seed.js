// const {expect} = require('chai');
// const {constants} = require('@openzeppelin/test-helpers');
// const {BENEFICIARY, ADMIN} = require('../../config.json');
// const {
//     WETH,
//     PRIME,
//     softCap,
//     hardCap,
//     price,
//     startTime,
//     endTime,
//     vestingDuration,
//     vestingCliff,
//     isPermissioned,
//     fee,
//     metadata,
// } = require('../test-сonfig.json');

// const init = require("../test-init.js");

// const zero = 0;
// const oneMillion = 1000000;
// const magicValue = `0x20c13b0b`;
// const signaturePosition = 196;
// const EXECUTION_SUCCESS = 'ExecutionSuccess';
// const SIGNATURE_CREATED = 'SignatureCreated';


// const deploy = async () => {
//     const setup = await init.initialize(await ethers.getSigners());

//     setup.gnosisSafe = await init.gnosisSafe(setup);

//     setup.proxySafe = await init.gnosisProxy(setup);

//     setup.seedFactory = await init.seedFactory(setup);

//     setup.seed = await init.seedMasterCopy(setup);

//     await setup.seedFactory.connect(setup.roles.prime).setMasterCopy(setup.seed.address);

//     setup.data = {};

//     return setup;
// }

// describe('>> Deploy new seed with gnosis safe', async () => {
//     let setup;
//     let nonce = 0;
//     before('!! setup', async () => {
//         setup = await deploy();
//     });
//     context('$ prequesities', async () => {
//         it('seed factory should have correct mastercopy', async () => {
//             // checking if the mastercopy is set correct
//             expect(await setup.seedFactory.masterCopy()).to.equal(setup.seed.address);
//         });
//         it('transfer seed factory ownership to safe', async () => {
//             // transfering ownership to safe, as seedFactory.deploySeed() should be called by safe only
//             await setup.seedFactory.connect(setup.roles.prime).transferOwnership(setup.proxySafe.address);
//             expect(await setup.seedFactory.connect(setup.roles.prime).owner()).to.equal(setup.proxySafe.address);
//         });
//         it("deploys signer contract with correct safe and seedFactory addresses", async () => {
//             const Signer_Factory = await ethers.getContractFactory(
//                 "Signer",
//                 setup.roles.prime
//             );
//             setup.signer = await Signer_Factory.deploy(setup.proxySafe.address, setup.seedFactory.address);
//         });
//         it('setup gnosis proxy', async () => {
//             // setting up safe with two owners, 1) prime 2) signer contract
//             expect(await setup.proxySafe.isOwner(setup.roles.prime.address)).to.equal(false);
//             await setup.proxySafe.connect(setup.roles.prime).setup(
//                 [setup.roles.prime.address],
//                 1,
//                 setup.proxySafe.address,
//                 '0x',
//                 constants.ZERO_ADDRESS,
//                 constants.ZERO_ADDRESS,
//                 0,
//                 setup.roles.prime.address
//             );
//             expect(await setup.proxySafe.isOwner(setup.roles.prime.address)).to.equal(true);
//         });
//     });
//     context('$ Signer cannot create and execute transaction to deploy new seed using safe contract', async () => {
//         it('produce valid signature for a transaction', async () => {
//             // here we create a transaction object
//             const {data, to} = await setup.seedFactory.populateTransaction.deploySeed(
//                 BENEFICIARY,
//                 ADMIN,
//                 [PRIME,WETH],
//                 [softCap,hardCap],
//                 price,
//                 startTime,
//                 endTime,
//                 [vestingDuration, vestingCliff],
//                 isPermissioned,
//                 fee,
//                 metadata
//             );
//             const trx = [
//                 to,
//                 zero,
//                 data,
//                 zero,
//                 oneMillion,
//                 oneMillion,
//                 zero,
//                 constants.ZERO_ADDRESS,
//                 constants.ZERO_ADDRESS
//             ];
//             // once transaction object is created, we send the transaction data along with nonce to generate safeTrx hash
//             // and verify if the transaction is valid or not, and sign the hash.
//             const transaction = await setup.signer.generateSignature(...trx, nonce);
//             const hashData = await setup.proxySafe.encodeTransactionData(...trx, nonce);
//             nonce++;
//             const receipt = await transaction.wait();
//             const {signature, hash} = receipt.events.filter((data) => {return data.event === SIGNATURE_CREATED})[0].args;
//             trx.push(signature);
//             setup.data.trx = trx;
//             setup.data.hash = hash;
//             // checking if the signature produced can correctly be verified by signer contract.
//             expect(await setup.signer.isValidSignature(hashData,`0x${signature.slice(signaturePosition)}`)).to.equal(magicValue);
//         });
//         it('cannot executes transaction in safe contract successfully', async () => {
//             // once the transaction is signed, we use safe.execTransaction() to execute this transaction using safe.
//             // this is where the seedFactory.deploySeed() will be invoked and new seed will be created.
//             await expect(setup.proxySafe.connect(setup.roles.prime).execTransaction(...(setup.data.trx))).to.revertedWith("GS026");
//         });
//     });
//     context('$ create and execute transaction other than to deploy new seed using safe', async () => {
//         it('reverts', async () => {
//             // here we create a transaction object
//             nonce++;
//             // incorrect function call
//             const {data, to} = await setup.seedFactory.populateTransaction.setMasterCopy(
//                 BENEFICIARY
//             );
//             const trx = [
//                 to,
//                 zero,
//                 data,
//                 zero,
//                 oneMillion,
//                 oneMillion,
//                 zero,
//                 constants.ZERO_ADDRESS,
//                 constants.ZERO_ADDRESS
//             ];
//             // once transaction object is created, we send the transaction data along with nonce to generate safeTrx hash
//             // and verify if the transaction is valid or not, and sign the hash.
//             await expect(setup.signer.generateSignature(...trx, nonce)).to.be.revertedWith("Signer: cannot sign invalid function call");
//         });
//     });
//     context('$ create and execute transaction to deploy new seed using safe from other seedFactory', async () => {
//         it('reverts', async () => {
//             // here we create a transaction object
//             nonce++;
//             const {data, to} = await setup.seedFactory.populateTransaction.deploySeed(
//                 BENEFICIARY,
//                 ADMIN,
//                 [PRIME,WETH],
//                 [softCap,hardCap],
//                 price,
//                 startTime,
//                 endTime,
//                 [vestingDuration, vestingCliff],
//                 isPermissioned,
//                 fee,
//                 metadata
//             );
//             // incorrect seedFactory address
//             const trx = [
//                 BENEFICIARY,
//                 zero,
//                 data,
//                 zero,
//                 oneMillion,
//                 oneMillion,
//                 zero,
//                 constants.ZERO_ADDRESS,
//                 constants.ZERO_ADDRESS
//             ];
//             await expect(setup.signer.generateSignature(...trx, nonce)).to.be.revertedWith("Signer: cannot sign invalid transaction");
//         });
//     });
// });
