// @ts-check
// Importing Gnosis Safe SDK library
const {
  SafeFactory,
  SafeAccountConfig,
  ContractNetworksConfig,
} = require("@gnosis.pm/safe-core-sdk");
const Safe = require("@gnosis.pm/safe-core-sdk");
const { SafeTransactionDataPartial } = require("@gnosis.pm/safe-core-sdk");
const { utils } = require("ethers");
const EthersAdapter = require("@gnosis.pm/safe-ethers-lib").default;

// Addresses
const ceo = "0xB86fa0cfEEA21558DF988AD0ae22F92a8EF69AC1";
const safeAddress = "0xDb19E145b8Acb878B6410704b05BA4f91231E1F0";

// Importing ethers.js library
const { ethers } = require("ethers");
const url = `https://e761db8d40ea4f95a10923da3ffa47a3.goerli.rpc.rivet.cloud/`;

async function main() {
  // const provider = await ethers.providers.getDefaultProvider(url);
  const provider = new ethers.providers.JsonRpcProvider(url);
  const res = await provider.getNetwork();
  res; /*?*/

  // Creating three signers
  const ceo_signer = provider.getSigner(ceo);

  // Creating three adapters
  //@ts-ignore
  const ethAdapter_ceo = new EthersAdapter({ ethers, signer: ceo_signer });
  const id = await ethAdapter_ceo.getChainId();
  const contractNetworks = {
    [id]: {
      /** https://github.com/safe-global/safe-deployments/blob/main/src/assets/v1.3.0/multi_send.json */
      multiSendAddress: "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761",
      /** https://github.com/safe-global/safe-deployments/blob/main/src/assets/v1.3.0/multi_send_call_only.json */
      multiSendCallOnlyAddress: "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D",
      safeMasterCopyAddress: "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
      safeProxyFactoryAddress: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
    },
  };

  const safe = await Safe.default.create({
    safeAddress,
    ethAdapter: ethAdapter_ceo,
    contractNetworks: contractNetworks,
  });

  const addr = safe.getAddress();
  addr; /*?*/

  const {
    to,
    data,
    value,
    nonce,
    safeTxGas,
    baseGas,
    gasPrice,
    gasToken,
    refundReceiver,
  } = createTxArgs();
  const safeTx = await safe.createTransaction({
    safeTransactionData: {
      data,
      to,
      value,
      nonce,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken,
      refundReceiver,
    },
  });

  // get tx hash
  // sign it
  // send to api

  // safe.approveTransactionHash()
  safe.executeTransaction("");
}

function createTxArgs() {
  return {
    to: ceo,
    value: "0",
    data: "0x",
    operation: "0",
    gasToken: "0x0000000000000000000000000000000000000000",
    safeTxGas: 38977,
    baseGas: 0,
    gasPrice: 0,
    refundReceiver: "0x0000000000000000000000000000000000000000",
    nonce: 3,
    contractTransactionHash:
      "0x4400d55da7e213ca0a68647c69fc857530b3a0095e8dbc92cd5cd40b5576a74c",
    sender: ceo,
    signature:
      "0xba7dce7fe1dcc1b3fba19b609605fa8652080df2a20fa6e1eee26284531361bb1130163623e766c02661944582a92989835d7fa9721a3538fd255232515d0bbd1b",
    origin: "Prime Launch Script to accept tx",
  };
}

async function run() {
  try {
    await main();
  } catch (error) {
    /* prettier-ignore */ console.log('>>>> _ >>>> ~ file: gnosis-execute-test.js ~ line 110 ~ error', error)
  }
}
run();

/**
 * Convert string of individual UTF-8 bytes into a regular UTF-8 string
 * @param str1 individual UTF-8 bytes as a string
 * @returns
 */
function toAscii(str1) {
  const hex = str1.toString();
  let str = "";
  for (let n = 0; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }
  return str;
}
