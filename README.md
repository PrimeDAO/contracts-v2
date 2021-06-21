# contracts-v2
new experimental version of PrimeDAO contracts

## To Run
Please add the following details in `.env. file.
1. PROVIDER_KEY - Infura api key for rinkeby test network
2. SAFE - Gnosis Safe Address at rinkeby
3. SEED_SIGNATURE - Contract which generates signature and also is the owner of safe.
4. SEED_FACTORY - Seed Factory address to call deploySeed()
5. ADMIN - Address of project admin, for simulation
6. BENEFICIARY - Address of beneficiary for simulation 
7. MNEMONIC - To generate wallet, so the transactions can be signed.

## For Front-end

0. Import Gnosis file created in-house
```js
import {api, option} from './Gnosis';
```

1. Setup gnosis api for a SAFE:-
```js
const SAFE = 'Address of gnosis safe';
const gnosis = api(SAFE);
```

2. Start populating transaction object:-
```js
const transaction = {};

transaction.to = this.seedFactory.options.address;
transaction.value = 0;
transaction.operation = 0;
transaction.safe = this.safe.options.address;
transaction.data = this.seedFactory.methods.deploySeed(...seedArguments).encodeABI();
```

3. Get transaction estimate:-
```js
const estimate = await gnosis(option.getEstimate, transaction);
transaction.safeTxGas      = estimate.safeTxGas;
```

4. Add payment related details
```js
transaction.baseGas        = 0;
transaction.gasPrice       = 0;
transaction.gasToken       = '0x0000000000000000000000000000000000000000';
transaction.refundReceiver = '0x0000000000000000000000000000000000000000';
```

5. Get Nonce
```js
transaction.nonce = await gnosis(option.getNonce);
```

6. Get transaction hash from the safe contract
```js
transaction.contractTransactionHash = await this.safe.methods.getTransactionHash(
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.operation,
            transaction.safeTxGas,
            transaction.baseGas,
            transaction.gasPrice,
            transaction.gasToken,
            transaction.refundReceiver,
            transaction.nonce
        ).call();
```

7. Call signatureContract.generateSignature() to get signature
```js
transaction.signature = await signatureContract.methods.generateSignature(transaction.contractTransactionHash).call();
```

8. Send signatureContract.generateSignature() to do a transaction and store signature in contract
```js
await signatureContract.methods.generateSignature(transaction.contractTransactionHash).send(options));
```

9. Add sender to the transaction object
```js
transaction.sender = signatureContract.options.address;
```

10. Send the transaction object to Gnosis Safe Transaction service
```js
const response = await gnosis(option.sendTransaction, transaction);
```

## Things to remember:-
1. Works with only safe whose threshold is 1.
2. Need to resolve the issue with signatures when threshold is more than 1.