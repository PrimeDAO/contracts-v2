# How to deploy contracts

## Deploy Contracts

### For mainnet

to deploy ```SeedFactory```, ```Seed```, ```Signer``` and set mastercopy at ```SeedFactory```
```bash
npm run deploy:contracts:mainnet
```

to transferOwnership of seedFactory contract to Safe
```bash
npm run change:factoryOwnerToSafe:mainnet
```

to add Signer contract as delegate for Safe
```bash
npm run add:safeDelegate:mainnet
```

### For rinkeby

to deploy ```SeedFactory```, ```Seed```, ```Signer``` and set mastercopy at ```SeedFactory```
```bash
npm run deploy:contracts:rinkeby
```

to transferOwnership of seedFactory contract to Safe
```bash
npm run change:factoryOwnerToSafe:rinkeby
```

to add Signer contract as delegate for Safe
```bash
npm run add:safeDelegate:rinkeby
```