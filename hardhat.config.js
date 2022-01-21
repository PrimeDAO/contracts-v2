require("dotenv").config({ path: "./.env" });
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("@nomiclabs/hardhat-web3");
require("solidity-coverage");
require("@nomiclabs/hardhat-etherscan");
// require("hardhat-gas-reporter");

const { INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY, ARBISCAN_API_KEY, PK } =
  process.env;
const DEFAULT_MNEMONIC = "hello darkness my old friend";

const sharedNetworkConfig = {};
if (PK) {
  sharedNetworkConfig.accounts = [PK];
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  };
}

require("./tasks/seedManagement");
require("./tasks/gnosisManagement");
require("./tasks/merkleDropManagement");
require("./tasks/reputationManagement");
require("./tasks/lbpManagerManagement");

module.exports = {
  paths: {
    artifacts: "build/artifacts",
    cache: "build/cache",
    deploy: "deploy",
    sources: "contracts",
    imports: "imports",
  },
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      ...sharedNetworkConfig,
      blockGasLimit: 100000000,
      gas: 2000000,
      saveDeployments: false,
    },
    hardhat: {
      blockGasLimit: 10000000000000,
      gas: 200000000000,
      saveDeployments: false,
      initialBaseFeePerGas: 0,
      hardfork: "london",
    },
    mainnet: {
      ...sharedNetworkConfig,
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
      saveDeployments: true,
    },
    rinkeby: {
      ...sharedNetworkConfig,
      url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
      saveDeployments: true,
    },
    kovan: {
      ...sharedNetworkConfig,
      url: `https://kovan.infura.io/v3/${INFURA_KEY}`,
      saveDeployments: true,
    },
    ganache: {
      ...sharedNetworkConfig,
      url: "http://127.0.0.1:7545",
      saveDeployments: false,
    },
    arbitrumTest: {
      ...sharedNetworkConfig,
      url: "https://rinkeby.arbitrum.io/rpc",
      saveDeployments: true,
    },
    arbitrum: {
      ...sharedNetworkConfig,
      url: "https://arb1.arbitrum.io/rpc",
      saveDeployments: true,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      { version: "0.6.12" },
      { version: "0.5.16" },
    ],
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      arbitrumOne: ARBISCAN_API_KEY,
    },
  },
  namedAccounts: {
    root: 0,
    prime: 1,
    beneficiary: 2,
  },
};
