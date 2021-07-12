const axios = require('axios');

/* eslint-disable */
const getUrl = (network) => {
    switch(network){
        case 'mainnet': return `https://safe-transaction.gnosis.io/api/v1/safes/`;
        case 'rinkeby': return `https://safe-transaction.rinkeby.gnosis.io/api/v1/safes/`;
        default: return `${network}, is not supported yet`;
    }
}

const getRelayUrl = (network) => {
    switch(network) {
        case 'mainnet': return `https://safe-relay.gnosis.io/api/v2/safes/`;
        case 'rinkeby': return `https://safe-relay.rinkeby.gnosis.io/api/v2/safes/`;
        default:  `${network}, is not supported yet`;
    }
}

const post = async (method, payload, safe, url) => {
    console.log("Post",url);
    const res = await axios.post(
        `${url}${safe}${methods[method]}`,
        payload
    );
    return res;
}

const get = async (method, safe, url) => {
    console.log("Get",url);
    const res = await axios.get(
        `${url}${safe}${methods[method]}`
    );
    return res.data;
}

const getEstimate = async (payload, safe, url) => {
    console.log(url);
    const res = await axios.post(
        `${url}${safe}/transactions/estimate/`,
        payload
    );
    return res;
}

const getCurrentNonce = async (safe, url) => {
    const transactions = await get('getNonce', safe, url);
    return transactions.countUniqueNonce;
}

const sendTransaction = async (payload, safe, url) => await post('sendTransaction', payload, safe, url);
const getTransactionHistory = async (safe, url) => await get('getTransactionHistory', safe, url);

const addDelegate = async (payload, safe, url) => await post('addDelegate', payload, safe, url);
const getDelegates = async (safe, url) => (await get('getDelegates', safe, url)).results;

const api = (safe, network) => {
    const url = getUrl(network);
    const relayUrl = getRelayUrl(network);
    return {
        sendTransaction: async (payload) => await sendTransaction(payload, safe, url),
        addDelegate: async (payload) => await await addDelegate(payload, safe, url),
        getEstimate: async (payload) => await getEstimate(payload, safe, relayUrl),
        getTransactionHistory: async () => await getTransactionHistory(safe, url),
        getCurrentNonce: async () => await getCurrentNonce(safe, url),
        getDelegates: async () => await getDelegates(safe, url)
    }
};

const methods = {
    'sendTransaction': `/multisig-transactions/`,
    'addDelegate': `/delegates/`,
    'getTransactionHistory': `/multisig-transactions`,
    'getEstimate': `/transactions/estimate/`,
    'getNonce': `/transactions`,
    'getDelegates': `/delegates/`
}

module.exports = {api};