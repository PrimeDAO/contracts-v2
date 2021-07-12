const axios = require('axios');

const parseErrorData = (data) => {
    return Object.values(data).reduce(
        (accumulator, error) => `${accumulator}${accumulator.length == 0?'':' , '}${error}`, ''
    );
}

const errorHandler = (error) => {
    let errorMsg = {};
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMsg.message = 
            `HTTP status ${error.response.status}. Message received: ${parseErrorData(error.response.data)}`
        errorMsg.data = error.response.data;
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        errorMsg.message = `No response: ${error.message}`;
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMsg.message = `Unknown error: ${error.message}`;
      }
      return errorMsg;
}

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
    try{
        const res = await axios.post(
            `${url}${safe}${methods[method]}`,
            payload
        );
        return res;
    } catch (error) {
        throw Error(errorHandler(error).message);
    }
}

const get = async (method, safe, url) => {
    try{
        const res = await axios.get(
            `${url}${safe}${methods[method]}`
        );
        return res.data;
    } catch (error) {
        throw Error(errorHandler(error).message);
    }
}

const getEstimate = async (payload, safe, url) => {
    try {
        const res = await axios.post(
            `${url}${safe}/transactions/estimate/`,
            payload
        );
        return res;
    } catch (error) {
        throw Error(errorHandler(error).message);
    }
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