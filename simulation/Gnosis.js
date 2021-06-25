// to be used in front-end

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

const getCurrentNonce = async (safe) => {
    console.log(safe);
    const res = await fetch(
        `https://safe-transaction.rinkeby.gnosis.io/api/v1/safes/${safe}/transactions`
    );
    const transactions = await res.json();
    const previousNonce = transactions.results.find(
        trx => {
            return trx.confirmations.length !== 0 ;
        }
    ).nonce;
    return previousNonce+1;
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

const api = (safe) => async (type, params) => {
    switch (type) {
        case option.sendTransaction:
            return await sendTransaction(params, safe);
        case option.getHistory:
            return await getTransactionHistory(safe);
        case option.getEstimate:
            return await getEstimate(params, safe);
        case option.getNonce:
            return await getCurrentNonce(safe);
        default:
            console.log("Invalid case");
    }
};

const option = {
    sendTransaction: 'sendTransaction',
    getHistory: 'getTransactionHistory',
    getEstimate: 'getEstimate',
    getNonce: 'getNonce'
}

export {option, api};