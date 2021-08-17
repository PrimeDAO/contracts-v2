require("dotenv").config({ path: "./.env" });
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("@nomiclabs/hardhat-web3");
require("@nomiclabs/hardhat-solhint");
require("solidity-coverage");
require("@nomiclabs/hardhat-etherscan");
// require("hardhat-gas-reporter");

const { INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY, PK } = process.env;
const DEFAULT_MNEMONIC = "hello darkness my old friend";

const sharedNetworkConfig = {};
if (PK) {
  sharedNetworkConfig.accounts = [PK];
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC
  };
}

require("./tasks/seedManagement");
require("./tasks/gnosisManagement");
require("./tasks/merkleDropManagement");
require("./tasks/reputationManagement");

module.exports = {
  paths: {
    artifacts: "build/artifacts",
    cache: "build/cache",
    deploy: "deploy",
    sources: "contracts",
    imports: 'imports'
  },
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      ...sharedNetworkConfig,
      blockGasLimit: 100000000,
      gas: 2000000,
      saveDeployments: true,
      initialBaseFeePerGas: 0
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 10000000000000,
      gas: 200000000000,
      saveDeployments: true,
    },
    mainnet: {
      ...sharedNetworkConfig,
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
      saveDeployments: true
    },
    rinkeby: {
      ...sharedNetworkConfig,
      url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
      saveDeployments: true
    },
    ganache: {
      ...sharedNetworkConfig,
      url: "http://127.0.0.1:7545",
      saveDeployments: true
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.8.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      { version: "0.6.12" },
      // { version: "0.5.17" },
      { version: "0.5.16" }
    ]
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  namedAccounts: {
    root: 0,
    prime: 1,
    beneficiary: 2
  }
};

