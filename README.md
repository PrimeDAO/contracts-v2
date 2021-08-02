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
NETWORK = network-name
PROVIDER = infura-provider-key
MNEMONIC = private-key-or-mnemonic
```



Note:```.env``` should be created in root directory.

## Rinkeby Deployment

to deploy contracts

```
npm run deploy:contracts:rinkeby
```

to change seed factory owner to gnosis safe

```
npm run change:factoryOwner:rinkeby
```

to add signer contract as delegate

```
npm run add:delegate:rinkeby
```

to send a test transaction to safe

```
npm run send:safeTrx:rinkeby
```


## Contributing to PrimeDAO
If you wish to contribute to PrimeDAO, check out our [Contributor Onboarding documentation](https://docs.primedao.io/primedao/call-for-contributors).

## License
```
Copyright 2020 Prime Foundation

Licensed under the GNU General Public License v3.0.
You may obtain a copy of this license at:

https://www.gnu.org/licenses/gpl-3.0.en.html

```
