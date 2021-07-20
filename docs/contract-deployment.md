# How to deploy contracts

## Deploy Contracts

### For mainnet

to deploy ```SeedFactory```, ```Seed```, ```Signer``` and set mastercopy at ```SeedFactory```
```bash
npm run deploy:contracts:mainnet
```

to transferOwnership to Safe
```bash
npm run change:factoryOwner:mainnet
```

to add Signer contract as delegate for Safe
```bash
npm run add:delegate:mainnet
```

### For rinkeby

to deploy ```SeedFactory```, ```Seed```, ```Signer``` and set mastercopy at ```SeedFactory```
```bash
npm run deploy:contracts:rinkeby
```

to transferOwnership to Safe
```bash
npm run change:factoryOwner:rinkeby
```

to add Signer contract as delegate for Safe
```bash
npm run add:delegate:rinkeby
```