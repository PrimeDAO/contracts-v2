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