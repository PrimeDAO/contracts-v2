[![banner](https://i.ibb.co/BqjcRGG/Prime-DAO-Github-Contracts-Banner.png)](https://www.prime.xyz/)

#  [![codecov](https://codecov.io/gh/PrimeDAO/contracts-v2/branch/main/graph/badge.svg?token=XNGL2Z8CBE)](https://codecov.io/gh/PrimeDAO/contracts-v2)  ![build&tests](https://github.com/PrimeDAO/contracts-v2/actions/workflows/ci-config.yml/badge.svg) [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

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
````

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

please prepare ```.env``` file

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

Note:```.env``` should be created in root directory.

## Deployment

This project uses the hardhat-deploy plugin to deploy contracts. To deploy contracts in general you can run `npx hardhat deploy --network <network_name>`. This will deploy all contracts in the `deploy` directory. The deployed contracts will then be saved within the `deployments` directory. To deploy run the following command:

`npx hardhat deploy --network <network_name>`

You run only specific deploy scripts by using the deployment tags. For instance, if you want to only deploy the MerkleScript contract on mainnet you can use the following command:

`npx hardhat deploy --network mainnet --tags Migration`


## Interacting with contracts

This project uses hardhat tasks to interact with deployed contracts. The associated scripts can be found in the `tasks` directory. To get an overview of all existing tasks you can run `npx hardhat` on your command line.

To get more information on specific tasks (e.g. what they do, which parameters they require etc.) you can run `npx hardhat help <task_name>`.

Here's an example of a command to execute a task on rinkeby: 
`npx hardhat --network rinkeby changeOwner --address <0xsome_address>`

## Verify Contracts

to verify contracts, the enviornment variable should contain `ETHERSCAN_API_KEY` set.

`npx hardhat verify --network mainnet <0xsome_address>`

## Contributing to PrimeDAO
If you wish to contribute to PrimeDAO, check out our [Contributor Onboarding documentation](https://docs.primedao.io/primedao/call-for-contributors).

## License
```
Copyright 2020 Prime Foundation

Licensed under the GNU General Public License v3.0.
You may obtain a copy of this license at:

https://www.gnu.org/licenses/gpl-3.0.en.html

```
