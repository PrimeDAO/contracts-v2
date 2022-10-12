// @ts-check
const EIP712Domain = require("eth-typed-data");
const BigNumber = require("bignumber.js");
const ethUtil = require("ethereumjs-util");
const { ethers } = require("ethers");
const axios = require("axios");
const { Blob } = require("buffer");

const parseErrorData = (data) => {
  return Object.values(data).reduce(
    (accumulator, error) =>
      `${accumulator}${accumulator.length == 0 ? "" : " , "}${error}`,
    ""
  );
};

const errorHandler = (error) => {
  let errorMsg = {};
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    errorMsg.message = `HTTP status ${
      error.response.status
    }. Message received: ${parseErrorData(error.response.data)}`;
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
};

/* eslint-disable */
const getUrl = (network) => {
  switch (network) {
    case "mainnet":
      return `https://safe-transaction.gnosis.io/api/v1/safes/`;
    case "rinkeby":
      return `https://safe-transaction.rinkeby.gnosis.io/api/v1/safes/`;
    case "goerli":
      return `https://safe-transaction.goerli.gnosis.io/api/v1/safes/`;
    case "arbitrum":
      return `https://safe-transaction.arbitrum.gnosis.io/api/v1/safes/`;
    case "celo":
      return `https://transaction-service.gnosis-safe-staging.celo-networks-dev.org/api/v1/safes/`;
    default:
      return `${network}, is not supported yet`;
  }
};

/**
 * https://safe-relay.gnosis.io/
 */
const getRelayUrl = (network) => {
  switch (network) {
    case "goerli":
      return `https://safe-relay.${network}.gnosis.io/api`;
    // const resp = await axios.post(`https://safe-relay.rinkeby.gnosis.pm/api/v2/safes/${safe}/transactions/estimate/`, tx)
    // const resp = await axios.post(`https://safe-relay.rinkeby.gnosis.io/api/v2/safes/${safe}/transactions/estimate/`, tx)
    // const resp = await axios.post(`https://safe-relay.rinkeby.gnosis.pm/api/v1/safes/${safe}/transactions/`, tx)
    default:
      return `${network}, is not supported yet`;
  }
};

const NETWORK_CHAIN_ID_MAPPING = {
  goerli: 5,
};

const post = async (method, payload, safe, url) => {
  try {
    const finalUrl = `${url}${safe}${methods[method]}`;
    const res = await axios.post(finalUrl, payload);
    return res;
  } catch (error) {
    throw Error(errorHandler(error).message);
  }
};

const get = async (method, safe, url, address) => {
  try {
    const res = await axios.get(`${url}${safe}${methods[method]}`);
    return res.data;
  } catch (error) {
    throw Error(errorHandler(error).message);
  }
};

const getOne = async (method, safe, url, address) => {
  try {
    const finalUrl = `${url}${safe}${methods[method]}/${address}`;
    const res = await axios.get(finalUrl);
    return res.data;
  } catch (error) {
    throw Error(errorHandler(error).message);
  }
};

const getCurrentNonce = async (safe, url) => {
  const transactions = await get("getNonce", safe, url);
  return transactions.countUniqueNonce;
};

const getEstimate = async (payload, safe, url) =>
  await post("getEstimate", payload, safe, url);

const sendTransaction = async (payload, safe, url) =>
  await post("sendTransaction", payload, safe, url);
const getTransactionHistory = async (safe, url) =>
  await get("getTransactionHistory", safe, url);

const getSafeTransaction = async (safe, url, safeAddress) =>
  await getOne("getSafeTransaction", safe, url, safeAddress);

const addDelegate = async (payload, safe, url) =>
  await post("addDelegate", payload, safe, url);
const getDelegates = async (safe, url) =>
  (await get("getDelegates", safe, url)).results;

const api = (safe, network) => {
  const url = getUrl(network);
  return {
    endpoint: url,
    sendTransaction: async (payload) =>
      await sendTransaction(payload, safe, url),
    addDelegate: async (payload) => await await addDelegate(payload, safe, url),
    getEstimate: async (payload) => await getEstimate(payload, safe, url),
    getTransactionHistory: async () => await getTransactionHistory(safe, url),
    getSafeTransaction: async (safeAddress) =>
      await getSafeTransaction(safe, url, safeAddress),
    getCurrentNonce: async () => await getCurrentNonce(safe, url),
    getDelegates: async () => await getDelegates(safe, url),
  };
};

const methods = {
  sendTransaction: `/multisig-transactions/`,
  addDelegate: `/delegates/`,
  getTransactionHistory: `/multisig-transactions`,
  getSafeTransaction: `/multisig-transactions`,
  getEstimate: `/multisig-transactions/estimations/`,
  getNonce: `/transactions`,
  getDelegates: `/delegates/`,
};

/*
 * Safe relay service example
 * https://gist.github.com/rmeissner/0fa5719dc6b306ba84ee34bebddc860b
 * * * * * * * * * * * * * * * * * * * */

/**
 * @param {string} network
 * @param {string} safe
 * @param {*} tx
 * @returns {Promise<*>}
 */
const gnosisEstimateTransaction = async (network, safe, tx) => {
  safe; /*?*/
  console.log(JSON.stringify(tx));
  try {
    const url = `${getRelayUrl(
      network
    )}/v2/safes/${safe}/transactions/estimate/`;
    url; /*?*/
    const resp = await axios.post(url, tx);
    console.log(resp.data);
    return resp.data;
  } catch (e) {
    console.log(JSON.stringify(e.response.data));
    throw e;
  }
};

/**
 * @param {string} network
 * @param {string} safe
 * @param {*} tx
 * @returns {Promise<*>}
 */
const gnosisSubmitTx = async (network, safe, tx) => {
  try {
    const url = `${getRelayUrl(network)}/v1/safes/${safe}/transactions/`;
    const resp = await axios.post(url, tx);
    console.log(resp.data);
    return resp.data;
  } catch (e) {
    console.log(JSON.stringify(e.response.data));
    throw e;
  }
};

const { utils } = ethers;

/**
 * WIP
 * (note instructions below)
 *
 * There are 2 steps to manually executing a tx from Gnosis
 * 1. Approve the tx
 * 2. Execute the tx
 *
 * ! Assuming Safe needs only one approval.
 *
 * Instructions
 * 0. This instructions are based on Celo
 * 1. Find the tx hash (aka safeTxHash) you want to execute
 *   - eg. by manually calling the Safe api
 *   - GET `https://transaction-service.gnosis-safe-staging.celo-networks-dev.org/api/v1/multisig-transactions/0xb1e7747743982635c3a1fafb953e63dde58bb2cda9b4c2952028a1f972a8a3eb/`
 * 2. Update the args with the response from (1.)
 * 3. Execute following command in the root directory
 * ```
 * # Note, you have to have the PK in the .env file
 * npx hardhat executeSafeTx --network celo --safe 0x0276a552F424949C934bC74bB623886AAc9Ed807 --owner 0xB86fa0cfEEA21558DF988AD0ae22F92a8EF69AC1 --pk ""
 * ```
 * 4. Call (1.) again, now you should see a `signatures` field
 *   - copy that signature
 * 5. Update the signature
 * 6. Uncomment the code and comment out
 *   - Call (3.) again
 * 7. Done.
 *
 *
 * @param {*} hreEthers - the ethers instance from hre when calling Hardhat script
 * @param {string} network
 * @param {string} safe
 * @param {string} owner
 * @param {string} privateKey
 */
const execute = async (hreEthers, network, safe, owner, privateKey) => {
  const gnosis = api(safe, network);
  /** 1. */
  const txHash =
    "0xb1e7747743982635c3a1fafb953e63dde58bb2cda9b4c2952028a1f972a8a3eb";
  const wallet = new ethers.Wallet(privateKey);
  const signature = (await wallet.signMessage(ethers.utils.arrayify(txHash)))
    .replace(/1b$/, "1f")
    .replace(/1c$/, "20");

  /** 2. */
  const args = {
    to: "0xFb59890ec6bb01A2054f397AFAEf78228508D108",
    value: "0",
    data: "0xda235e6e0000000000000000000000000276a552f424949c934bc74bb623886aac9ed807000000000000000000000000b86fa0cfeea21558df988ad0ae22f92a8ef69ac1000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000633f6c00000000000000000000000000000000000000000000000000000000006340bd800000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000280000000000000000000000000000000000000000000000000000000000000000200000000000000000000000067db2ed83cd7f60aa97d84676c10308c4ef14822000000000000000000000000765de816845861e75a25fca122bb6898b8b1282a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000005af3107a400000000000000000000000000000000000000000000000000000005af3107a4000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002e516d614e5564716d58684866534b5264707235743953744c333171597a434441556d4c647358744d375a6f555646000000000000000000000000000000000000",
    operation: 0,
    gasToken: "0x0000000000000000000000000000000000000000",
    safeTxGas: 395394,
    baseGas: 0,
    gasPrice: "0",
    refundReceiver: "0x0000000000000000000000000000000000000000",
    nonce: 0,
    contractTransactionHash: txHash,
    sender: owner,
    signature,
    origin: "Prime Launch Script to accept tx",
  };
  /** 3. */
  const result = await gnosis.sendTransaction(args);

  // const baseTxn = {
  //   to: args.to,
  //   value: args.value,
  //   data: args.data,
  //   operation: args.operation,
  // };
  // console.log(baseTxn);
  // const { safeTxGas } = (await gnosis.getEstimate(baseTxn)).data;
  // const safeTxGas = 395394;

  const safeInstance = await hreEthers.getContract("Safe");

  /** 5. */
  const signatureFromApi =
    "0x16e05ca9ac3e38400a2f60cdfe23cbae6338a059a4cf4e559ee4581f0cb04a7d44463c046c845543cf54f5c339c3d95612ac4427b407fd72dd680f65f88e86a01f";

  /** 6. */
  const response = await safeInstance.execTransaction(
    args.to,
    args.value,
    args.data,
    args.operation,
    args.safeTxGas,
    args.baseGas,
    args.gasPrice,
    args.gasToken,
    args.refundReceiver,
    signatureFromApi
  );

  /* prettier-ignore */ console.log('>>>> _ >>>> ~ file: gnosis.js ~ line 374 ~ response', response)
};

module.exports = { api, execute };

/**
 * npx hardhat executeSafeTx --network1 goerli --safe 0xDb19E145b8Acb878B6410704b05BA4f91231E1F0 --to 0xB86fa0cfEEA21558DF988AD0ae22F92a8EF69AC1 --pk
 */
// async function run() {
//   try {
//     const response = await execute(
//       "goerli",
//       "0xDb19E145b8Acb878B6410704b05BA4f91231E1F0",
//       "0xB86fa0cfEEA21558DF988AD0ae22F92a8EF69AC1",
//       // process.env.PK ?? "no pk provided"
//       "c30dd3b70e3fc40199a97442a1958c020921df0472171295f2561e9d84d4013f"
//     );
//     /* prettier-ignore */ console.log('>>>> _ >>>> ~ file: gnosis.js ~ line 275 ~ response', response)
//   } catch (error) {
//     /* prettier-ignore */ console.log('>>>> _ >>>> ~ file: gnosis.js ~ line 279 ~ error', error)
//   }
// }

// run();

function hexStringToByte(str) {
  if (!str) {
    return new Uint8Array();
  }

  var a = [];
  for (var i = 0, len = str.length; i < len; i += 2) {
    a.push(parseInt(str.substr(i, 2), 16));
  }

  return new Uint8Array(a);
}

/**
 * Part of the answer in
 * https://stackoverflow.com/questions/71866879/how-to-verify-message-in-wallet-connect-with-ethers-primarily-on-ambire-wallet
 */
function encryptForGnosis(rawMessage) {
  const rawMessageLength = new Blob([rawMessage]).size;
  const message = ethers.utils.toUtf8Bytes(
    "\x19Ethereum Signed Message:\n" + rawMessageLength + rawMessage
  );
  const messageHash = ethers.utils.keccak256(message);
  return messageHash;
}
