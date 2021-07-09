const axios = require('axios');

/* eslint-disable */
const url = process.env.NODE_ENV === "development"?
    `https://safe-transaction.rinkeby.gnosis.io/api/v1/safes/`
    :
    `https://safe-transaction.gnosis.io/api/v1/safes/`;

const relayUrl = process.env.NODE_ENV === "development"?
    `https://safe-relay.rinkeby.gnosis.io/api/v2/safes/`
    :
    `https://safe-relay.gnosis.io/api/v2/safes/`;

const post = async (method, payload, safe) => {
    const res = await axios.post(
        `${url}${safe}${methods[method]}`,
        payload
    );
    return res;
}

const get = async (method, safe) => {
    const res = await axios.get(
        `${url}${safe}${methods[method]}`
    );
    return res.data;
}

const getEstimate = async (payload, safe) => {
    const res = await axios.post(
        `${relayUrl}${safe}/transactions/estimate/`,
        payload
    );
    return res;
}

const getCurrentNonce = async (safe) => {
    const transactions = await get('getNonce', safe);
    return transactions.countUniqueNonce;
}

const sendTransaction = async (payload, safe) => await post('sendTransaction', payload, safe);
const getTransactionHistory = async (safe) => await get('getTransactionHistory', safe);

const addDelegate = async (payload, safe) => await post('addDelegate', payload, safe);
const getDelegates = async (safe) => (await get('getDelegates', safe)).results;

const api = (safe) => ({
    sendTransaction: async (payload) => await sendTransaction(payload, safe),
    addDelegate: async (payload) => await await addDelegate(payload, safe),
    getEstimate: async (payload) => await getEstimate(payload, safe),
    getTransactionHistory: async () => await getTransactionHistory(safe),
    getCurrentNonce: async () => await getCurrentNonce(safe),
    getDelegates: async () => await getDelegates(safe)
});

const methods = {
    'sendTransaction': `/multisig-transactions/`,
    'addDelegate': `/delegates/`,
    'getTransactionHistory': `/multisig-transactions`,
    'getEstimate': `/transactions/estimate/`,
    'getNonce': `/transactions`,
    'getDelegates': `/delegates/`
}

module.exports = {api};