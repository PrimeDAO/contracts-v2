const signTransaction = async (ethereum, account, trxHash) => 
        await ethereum.request({method: 'eth_sign', params: [account, trxHash]});

const getTransactionHash = async (moduleManager, trx) => 
        await moduleManager.methods.getTransactionHash(
            trx.to,
            trx.value,
            trx.data,
            trx.operation,
            trx.safeTxGas,
            trx.baseGas,
            trx.gasPrice,
            trx.gasToken,
            trx.refundReceiver,
            trx.nonce).call();

const getEstimate = async (options, safe) => {
    const res = await fetch(
        `https://safe-relay.rinkeby.gnosis.io/api/v2/safes/${safe}/transactions/estimate/`,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(options)
        }
    );
    return await res.json();
}

const sendTransaction = async (options, safe) => {
    const res = await fetch(
        `https://safe-transaction.rinkeby.gnosis.io/api/v1/safes/${safe}/transactions/`,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(options)
        }
    );
    return await res.json();
}

const getTransactionHistory = async (safe) => {
    const res = await fetch(
        `https://safe-transaction.rinkeby.gnosis.io/api/v1/safes/${safe}/transactions`
    );
    return await res.json();
}

const generateUrlFor = (safe) => (type) => {
    switch(type){
        case api.sendTransaction:
            return `https://safe-transaction.rinkeby.gnosis.io/api/v1/safes/${safe}/transactions/`;
        case api.getHistory:
            return `https://safe-transaction.rinkeby.gnosis.io/api/v1/safes/${safe}/transactions`;
        case api.getEstimate:
            return `https://safe-relay.rinkeby.gnosis.io/api/v2/safes/${safe}/transactions/estimate/`;
    }
}

const api = {
    sendTransaction: 'sendTransaction',
    getHistory: 'getTransactionHistory',
    getEstimate: 'getEstimate'
}

module.exports = {generateUrlFor, api};