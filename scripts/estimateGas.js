const { ethers } = require("hardhat");
const { utils } = require("ethers");

const { parseEther, formatEther, parseUnits } = utils;

const blockGasLimit = 12450000;
const lowGasPrice10 = parseUnits("10.0", "gwei");
const mediumGasPrice50 = parseUnits("50.0", "gwei");
const highGasPrice100 = parseUnits("100.0", "gwei");
const veryHighGasPrice300 = parseUnits("300.0", "gwei");

const runSimulation = async () => {
  const MAX_LEN = 400;

  const [root, alice] = await ethers.getSigners();
  const reputationFactory = await ethers.getContractFactory("Reputation", root);
  const dummyAddress = alice.address;
  const dummyAmount = parseEther("12");

  const repHolders = [];
  const repAmounts = [];

  const resultTable = [];

  for (let i = 0; i < MAX_LEN; i += 5) {
    for (let j = 0; j < 5; j++) {
      repHolders.push(dummyAddress);
      repAmounts.push(dummyAmount);
    }

    const deployTransaction = reputationFactory.getDeployTransaction(
      repHolders,
      repAmounts
    );

    const estimatedGas = await ethers.provider.estimateGas(deployTransaction);

    const gasCostsInEth_gasPrice10 = estimatedGas.mul(lowGasPrice10);
    const gasCostsInEth_gasPrice50 = estimatedGas.mul(mediumGasPrice50);
    const gasCostsInEth_gasPrice100 = estimatedGas.mul(highGasPrice100);
    const gasCostsInEth_gasPrice300 = estimatedGas.mul(veryHighGasPrice300);

    resultTable.push({
      arrayLength: repHolders.length,
      estimatedGas: estimatedGas.toNumber(),
      gasCostsInEth_gasPrice10Gwei: formatEther(gasCostsInEth_gasPrice10),
      gasCostsInEth_gasPrice50Gwei: formatEther(gasCostsInEth_gasPrice50),
      gasCostsInEth_gasPrice100Gwei: formatEther(gasCostsInEth_gasPrice100),
      gasCostsInEth_gasPrice300Gwei: formatEther(gasCostsInEth_gasPrice300),
    });
  }

  console.table(resultTable);
};

runSimulation();
