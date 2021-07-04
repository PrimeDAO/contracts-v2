const axios = require('axios');

/* eslint-disable */
const url = `https://safe-transaction.rinkeby.gnosis.io/api/v1/safes/`

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
    // console.log(res.data);
    return res.data;
}

const getEstimate = async (payload, safe) => {
    const res = await axios.post(
        `https://safe-relay.rinkeby.gnosis.io/api/v2/safes/${safe}/transactions/estimate/`,
        payload
    );
    return res;
}

const getCurrentNonce = async (safe) => {
    const transactions = await get('getNonce', safe);
    // console.log(transactions);
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
    'sendTransaction': `/transactions/`,
    'addDelegate': `/delegates/`,
    'getTransactionHistory': `/transactions`,
    'getEstimate': `/transactions/estimate/`,
    'getNonce': `/transactions`,
    'getDelegates': `/delegates/`
}

module.exports = {api};