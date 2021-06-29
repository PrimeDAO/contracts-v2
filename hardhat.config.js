require("@nomiclabs/hardhat-waffle");
require('hardhat-dependency-compiler');
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-web3");
require('dotenv').config

const helpers = require("./test/helpers");


const accounts = {
  mnemonic: process.env.MNEMONIC || "test test test test test test test test test test test junk",
  accountsBalance: "990000000000000000000",
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 100000000,
      gas: 100000000
    },
    ganache: {
      url: "http://127.0.0.1:7545",
      accounts: {
        mnemonic: accounts.mnemonic || "hello darkness my old friend"
      }
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/c77020f1ad294f6a95b4e1203ffbe3ba",
      accounts: {
        mnemonic: accounts.mnemonic || "hello darkness my old friend"
      }
    }
  },
  solidity: {
    compilers: [
      { version: "0.8.4"},
      { version: "0.6.12" },
      { version: "0.5.17" },
    ]
  },
};
