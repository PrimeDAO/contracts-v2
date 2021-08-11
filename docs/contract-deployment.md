# How to deploy contracts

## Deploy Contracts

### For mainnet

to deploy ```SeedFactory```, ```Seed```, ```Signer``` and set mastercopy at ```SeedFactory```
```bash
npm run deploy:contracts:mainnet
```

to transferOwnership of seedFactory contract to Safe
```bash
npx hardhat --network mainnet changeOwner --address 0x011673EFCE3C924D127F22C35CD22D0C01fF41bd
```

to add Signer contract as delegate for Safe
```bash
npx hardhat --network mainnet addDelegate --safe 0x011673EFCE3C924D127F22C35CD22D0C01fF41bd --delegate 0xcE3c03c756cbA0FB24402b481A219df9F71C5581
```

### For rinkeby

to deploy ```SeedFactory```, ```Seed```, ```Signer``` and set mastercopy at ```SeedFactory```
```bash
npm run deploy:contracts:rinkeby
```

to transferOwnership of seedFactory contract to Safe
```bash
npx hardhat --network rinkeby changeOwner --address 0x011673EFCE3C924D127F22C35CD22D0C01fF41bd
```

to add Signer contract as delegate for Safe
```bash
npx hardhat --network rinkeby addDelegate --safe 0x011673EFCE3C924D127F22C35CD22D0C01fF41bd --delegate 0xcE3c03c756cbA0FB24402b481A219df9F71C5581
```