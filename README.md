[![banner](https://i.ibb.co/BqjcRGG/Prime-DAO-Github-Contracts-Banner.png)](https://www.prime.xyz/)

# [![codecov](https://codecov.io/gh/PrimeDAO/contracts-v2/branch/main/graph/badge.svg?token=XNGL2Z8CBE)](https://codecov.io/gh/PrimeDAO/contracts-v2) ![build&tests](https://github.com/PrimeDAO/contracts-v2/actions/workflows/ci-config.yml/badge.svg) [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

# PrimeDAO Smart Contracts v2

This repo contains the smart contracts making up PrimeDAO.

Repository is organized as follows:

- `/contracts/test/`- contracts used for tests.
- `/contracts/seed/`- Prime Launch seed module contracts.
- `/contracts/utils/`- utility contracts.
- `/docs/`- additional documentation.

## Development

requires

```
node >= 12.0
```

to install node modules

```
npm i
```

to compile run

```
npm run compile
```

to test

```
npm run test
```

to run coverage

```
npm run coverage
```

## Environment setup

please prepare `.env` file

```bash
touch .env
```

and add the following

```
INFURA_KEY = infura key
MNEMONIC = mnemonic (choose our development mnemonic to be able to interact with the deployed contracts with the deployer address)
PK = private-key
ETHERSCAN_API_KEY = etherscan key
```

Note:`.env` should be created in root directory.

## Deployment

This project uses the hardhat-deploy plugin to deploy contracts. When a contract has been deployed, it is saved as JSON to the `deployments` directory, including its _address_ as well as its _abi_.

Since this is a project that is continuously being extended, it is generally not desirable to always deploy all contracts. Therefore, this project makes use of [deployment tags](https://hardhat.org/plugins/hardhat-deploy.html#deploy-scripts-tags-and-dependencies). These are specified at the end of each deploy script.

There are two **npm scripts** that facilitate the deployment to _mainnet_ and _rinkeby_. Both require the specification of **tags**. When using these scripts, at the end of the deployment, it automatically exports the addresses & artifacts in one file per network. These files can be found in the `exports` directory and, for example, can be used for dApp development.

If multiple contracts share the same ABI (e.g. multiple instances of an ERC20 token) this should be specified in `deploy/sharedAbiConfig.js`. If not yet available, you should manually add the shared ABI (e.g. the ERC20 ABI) to `exports/sharedAbis.json`. As a result, the deployment information is exported, the exports for contracts that share the same ABI will point to this shared ABI. This keeps file exports slim, which is beneficial for dApp performance. If this is still unclear, you could for example take a look at `exports/rinkeby.json` and look at the ABIs of the _Dai_ and _Weth_ contracts.

### Deployment to rinkeby

General (one tag):
`npm run deploy:contracts:rinkeby --tags=<YOUR_TAG_NAME>`

General (multiple tags):
`npm run deploy:contracts:rinkeby --tags=<YOUR_TAG_NAME1>,<YOUR_TAG_NAME2>`

Example (deploys Migration contracts):
`npm run deploy:contracts:rinkeby --tags=Migration`

### Deployment to kovan

General (one tag):
`npm run deploy:contracts:kovan --tags=<YOUR_TAG_NAME>`

General (multiple tags):
`npm run deploy:contracts:kovan --tags=<YOUR_TAG_NAME1>,<YOUR_TAG_NAME2>`

Example (deploys Migration contracts):
`npm run deploy:contracts:kovan --tags=Migration`

### Deployment to mainnet

General (one tag):
`npm run deploy:contracts:mainnet --tags=<YOUR_TAG_NAME>`

General (multiple tags):
`npm run deploy:contracts:mainnet --tags=<YOUR_TAG_NAME1>,<YOUR_TAG_NAME2>`

Example (deploys Seed and Migration contracts):
`npm run deploy:contracts:mainnet --tags=Seed,Migration`

## Interacting with contracts

This project uses hardhat tasks to interact with deployed contracts. The associated scripts can be found in the `tasks` directory. To get an **overview of all existing tasks** you can run `npx hardhat` on your command line.

To get more information on specific tasks (e.g. what they do, which parameters they require etc.) you can run `npx hardhat help <task_name>`.

Here's an example of a command to execute a task on rinkeby:
`npx hardhat --network rinkeby changeOwner --address <0xsome_address>`

## Verify Contracts

to verify contracts, the enviornment variable should contain `ETHERSCAN_API_KEY` set.

`npx hardhat verify --network mainnet <0xsome_contract_address>`

single constructor argument can be passed as follows:
`npx hardhat verify --network mainnet <0xsome_contract_address> "Constructor argument 1"`

multiple constructor arguments can be passed as follows:
`npx hardhat verify --network rinkeby 0xa1C2eab7286dB99F481682e8165d2F1F61C4D7Ad "PrimeDAO Rating Reputation" "PRR"`

find more information in the documentation of [hardhat-etherscan](https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html)

## Code formatting

To format JS and Solidity code, run the following command:

`npm run format`

## Contributing to PrimeDAO

If you wish to contribute to PrimeDAO, check out our [Contributor Onboarding documentation](https://docs.primedao.io/primedao/call-for-contributors).

## License

```
Copyright 2020 Prime Foundation

Licensed under the GNU General Public License v3.0.
You may obtain a copy of this license at:

https://www.gnu.org/licenses/gpl-3.0.en.html

```
