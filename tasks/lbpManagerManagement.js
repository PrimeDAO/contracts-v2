const { task } = require("hardhat/config");
const { api } = require("./utils/gnosis.js");
const { LBPManagerArguments } = require("../test/test-сonfig.json");

task(
  "sendTransactionLBP",
  "send transaction for deploying LBPManager to Gnosis Safe"
)
  .addParam("safe", "address of safe")
  .setAction(async ({ safe: safeAddress }, { ethers }) => {
    console.log(
      `Sending LBPManagerFactory.deployLBPManager() transaction to ${safeAddress}`
    );

    const gnosis = api(safeAddress, network.name);
    const { root } = await ethers.getNamedSigners();

    const lbpManagerFactoryInstance = await ethers.getContract(
      "LBPManagerFactory"
    );
    const signerV2Instance = await ethers.getContract("SignerV2");
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 100000;

    const transaction = {};
    transaction.to = lbpManagerFactoryInstance.address;
    transaction.value = 0;
    transaction.operation = 0;

    const LBPManagerArgumentsArray = [
      root.address,
      LBPManagerArguments.BENEFICIARY,
      LBPManagerArguments.name,
      LBPManagerArguments.symbol,
      [LBPManagerArguments.tokenList[0], LBPManagerArguments.tokenList[1]],
      LBPManagerArguments.amounts,
      LBPManagerArguments.startWeights,
      [startTime, endTime],
      LBPManagerArguments.endWeights,
      LBPManagerArguments.fees,
      ethers.utils.hexlify(
        ethers.utils.toUtf8Bytes(LBPManagerArguments.metadata)
      ),
    ];

    transaction.data = (
      await lbpManagerFactoryInstance.populateTransaction.deployLBPManager(
        ...LBPManagerArgumentsArray
      )
    ).data;

    const estimate = await gnosis.getEstimate(transaction);
    transaction.safeTxGas = estimate.data.safeTxGas;

    transaction.safe = safeAddress;
    transaction.baseGas = 0;
    transaction.gasPrice = 0;
    transaction.gasToken = "0x0000000000000000000000000000000000000000";
    transaction.refundReceiver = "0x0000000000000000000000000000000000000000";
    transaction.nonce = await gnosis.getCurrentNonce();

    const { hash, signature } =
      await signerV2Instance.callStatic.generateSignature(
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

    await (
      await signerV2Instance.generateSignature(
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
      )
    )
      .wait()
      .then(async () => {
        const trx = await gnosis.sendTransaction(transaction);
        if (trx) {
          console.log("Transaction request sent to Gnosis Safe");
        }
        return trx;
      });
  });

task(
  "initializeLBP",
  "Initializes the LBP after task sentTransactionLBP has been accepted by Gnosis Safe"
)
  .addParam("lbpmanager", "address of deployed LBPManager")
  .setAction(async ({ lbpmanager: lbpManagerAddress }, { ethers }) => {
    console.log("Executing LBPManager.initializeLBP()");

    const { root } = await ethers.getNamedSigners();

    // The project token is a deployed ERC20Mock that is owned by the dev wallet
    const projectTokenAmount = LBPManagerArguments.amounts[0];
    const daiAmount = LBPManagerArguments.amounts[1];
    const projectTokenAddress = LBPManagerArguments.tokenList[0];
    const daiAddress = LBPManagerArguments.tokenList[1];

    const LBPManagerFactory = await ethers.getContractFactory("LBPManager");
    const ERC20Factory = await ethers.getContractFactory("ERC20Mock");

    const lbpManagerInstance = await LBPManagerFactory.attach(
      lbpManagerAddress
    );
    const projectTokenInstance = await ERC20Factory.attach(projectTokenAddress);

    const daiInstance = await ERC20Factory.attach(daiAddress);

    await (
      await projectTokenInstance
        .connect(root)
        .approve(lbpManagerInstance.address, projectTokenAmount)
    ).wait();
    await (
      await daiInstance
        .connect(root)
        .approve(lbpManagerInstance.address, daiAmount)
    ).wait();

    await lbpManagerInstance.connect(root).initializeLBP(root.address);
    console.log("LBPManager Initialized Successfully");
  });
