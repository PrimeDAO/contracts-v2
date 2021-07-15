require("dotenv").config({ path: "./.env" });
require("@nomiclabs/hardhat-ethers");
require("hardhat-deploy");
require("@nomiclabs/hardhat-web3");
require("@nomiclabs/hardhat-solhint");
require("solidity-coverage");
// require("hardhat-gas-reporter");

const { INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY, PK } = process.env;
const DEFAULT_MNEMONIC = "hello darkness my old friend";

const sharedNetworkConfig = {};
if (PK) {
  sharedNetworkConfig.accounts = [PK];
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  };
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  paths: {
    artifacts: "build/artifacts",
    cache: "build/cache",
    deploy: "deploy",
    sources: "contracts",
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      ...sharedNetworkConfig,
      blockGasLimit: 100000000,
      gas: 2000000,
    },
    mainnet: {
      ...sharedNetworkConfig,
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    },
    rinkeby: {
      ...sharedNetworkConfig,
      url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
    },
    ganache: {
      ...sharedNetworkConfig,
      url: "http://127.0.0.1:7545",
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      { version: "0.6.12" },
      { version: "0.5.17" },
      { version: "0.5.16" },
    ],
  },
  namedAccounts: {
    root: 0,
    prime: 1,
    beneficiary: 2,
  },
};
