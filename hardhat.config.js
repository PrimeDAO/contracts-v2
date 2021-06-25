require("@nomiclabs/hardhat-waffle");
require('hardhat-dependency-compiler');
require("@nomiclabs/hardhat-ethers");
require('dotenv').config

// const { artifacts } = require("hardhat");
const helpers = require("./test/helpers");


const accounts = {
  mnemonic: process.env.MNEMONIC || "test test test test test test test test test test test junk",
  accountsBalance: "990000000000000000000",
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    hardhat: {
      // accounts: accounts
    },
    // mainnet: {
    //   url: InfuraProvider.url,
    //   accounts: {
    //     mnemonic : [process.env.KEY],
    //   },
    //   // provider: () => new HDWalletProvider(process.env.KEY, process.env.PROVIDER),
    //   chainId: 1, // mainnet
    //   gas: 2000000,
    //   gasPrice: 65000000000, // check https://ethgasstation.info/
    //   // confirmations: 2, // # of confs to wait between deployments. (default: 0)
    //   // timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
    //   // skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
    // },
    // rinkeby: {
    //   // provider: function() {
    //   //     return new HDWalletProvider(process.env.MNEMONIC, process.env.PROVIDER);
    //   // },
    //   chainId: 4,
    //   gas: 10000000,
    //   timeout: 100000000,
    //   // timeoutBlocks: 200
    // },
    // kovan: {
    //   // provider: function() {
    //   //     return new HDWalletProvider(process.env.MNEMONIC, process.env.PROVIDER);
    //   // },
    //   chainId: 42,
    //   timeout: 100000000,
    // },
  //   coverage: {
  //     host: "127.0.0.1",
  //     port: 8555,
  //     chainId: "*",
  //   },
  //   ganache: {
  //     host: '127.0.0.1',
  //     port: 7545,
  //     chainId: 5777
  //   }
  },
  solidity: {
    compilers: [
      {
          version: "0.5.13"
        },
        {
        version: "0.8.4",
        evmVersion: "solc",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ],
    dependencyCompiler: {
      paths: [
        "@openzeppelin-solidity/contracts/token/ERC20/ERC20.sol",
        "@daostack/arc/contracts/universalSchemes/DaoCreator.sol"
      ]
    }
  }
}

