// const { network, deployments } = require("hardhat");
const { task } = require("hardhat/config");
const { api } = require("./utils/gnosis.js");
const { LBPManagerArguments } = require("../test/test-сonfig.json");


task(
  "sendTransactionLBP",
  "send transaction for deploying LBPManager to Gnosis Safe"
)
  .addParam("safe", "address of safe", undefined)
  .setAction(async ({ safe: safeAddress }, { ethers }) => {
    console.log(
      `Sending LBPManagerFactory.deployLBPManager() transaction to ${safeAddress}`
    );

    const gnosis = api(safeAddress, network.name);
    const { root } = await ethers.getNamedSigners();
    const { deploy } = deployments;
    const lbpManagerFactoryInstance = await ethers.getContract("LBPManagerFactory");
    const signerV2Instance = await ethers.getContract("SignerV2");
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 1000;

    // This can be changed to DAI token afterwards
    await deploy("FundingToken", {
      contract: "ERC20Mock",
      from: root.address,
      args: ["FUNDTOKEN", "FT"],
      log: true,
    });
    const fundingToken = await ethers.getContract("FundingToken");

    const transaction = {};
    transaction.to = lbpManagerFactoryInstance.address;
    transaction.value = 0;
    transaction.operation = 0;
    
    const LBPManagerArgumentsArray = [
      LBPManagerArguments.ADMIN,
      LBPManagerArguments.BENEFICIARY,
      LBPManagerArguments.name,
      LBPManagerArguments.symbol,
      [LBPManagerArguments.tokenList[0], fundingToken.address],
      LBPManagerArguments.amounts,
      LBPManagerArguments.startWeights,
      [startTime, endTime],
      LBPManagerArguments.endWeights,
      LBPManagerArguments.fees,
      LBPManagerArguments.metadata
    ]
    transaction.data = (await lbpManagerFactoryInstance.populateTransaction.deployLBPManager(...LBPManagerArgumentsArray)).data;
    
    const estimate = await gnosis.getEstimate(transaction);
    transaction.safeTxGas = estimate.data.safeTxGas;
    
    transaction.safe = safeAddress;
    transaction.baseGas        = 0;
    transaction.gasPrice       = 0;
    transaction.gasToken       = '0x0000000000000000000000000000000000000000';
    transaction.refundReceiver = '0x0000000000000000000000000000000000000000';
    transaction.nonce = await gnosis.getCurrentNonce();

    const {hash, signature} = await signerV2Instance.callStatic.generateSignature(
			transaction.to,
			transaction.value,
			transaction.data,
			transaction.operation,
			transaction.safeTxGas,
			transaction.baseGas,
			transaction.gasPrice,
			transaction.gasToken,
			transaction.refundReceiver,
			transaction.nonce
		);
    transaction.contractTransactionHash = hash;
    transaction.signature = signature;

    transaction.sender = signerV2Instance.address;

    (await signerV2Instance.generateSignature(
      transaction.to,
      transaction.value,
      transaction.data,
      transaction.operation,
      transaction.safeTxGas,
      transaction.baseGas,
      transaction.gasPrice,
      transaction.gasToken,
      transaction.refundReceiver,
      transaction.nonce)).wait()
      .then(
          async () => await gnosis.sendTransaction(transaction)
      );
  });

  // task("initializeLBP", "Initializes the LBP after task sentTransactionLBP has been accepted")
  // .addParam("sender", "address of liquidity provider")
  // .setAction(async ({sender: senderAddress}, {ethers}) => {
  //   console.log("deploy")
  // })
