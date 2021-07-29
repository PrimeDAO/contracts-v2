require("@nomiclabs/hardhat-waffle");
require("dotenv").config({ path: "./.env" });
require("hardhat-deploy");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-web3");
require("@nomiclabs/hardhat-solhint");
require("solidity-coverage");
// require("hardhat-gas-reporter");

let { MNEMONIC, PROVIDER } = process.env;
MNEMONIC = MNEMONIC || "hello darkness my old friend";
PROVIDER = PROVIDER || "https://rinkeby.infura.io";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 100000000000000,
      gas: 20000000000,
    },
    mainnet: {
      url: PROVIDER,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    ganache: {
      url: "http://127.0.0.1:7545",
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    rinkeby: {
      url: PROVIDER,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
  },
  solidity: {
    compilers: [
      { version: "0.8.6" },
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      { version: "0.5.16" },
    ],
  },
  paths: {
        imports: 'imports'
    }
};
