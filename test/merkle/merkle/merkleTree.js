// Shamelessly adapted from OpenZeppelin-contracts test utils

const { bufferToHex, keccak256, keccakFromString } = require("ethereumjs-util");
const { hexToBytes, soliditySha3 } = require("web3-utils");
const BN = require("bn.js");

// Merkle tree called with 32 byte hex values
class MerkleTree {
  bufArrToHexArr(arr) {
    if (arr.some((el) => !Buffer.isBuffer(el))) {
      throw new Error("Array is not an array of buffers");
    }
    return arr.map((el) => `0x${el.toString("hex")}`);
  }

  sortAndConcat(...args) {
    return Buffer.concat([...args].sort(Buffer.compare));
  }

  getPairElement(idx, layer) {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;

    if (pairIdx < layer.length) {
      return layer[pairIdx];
    }
    return null;
  }

  bufIndexOf(el, arr) {
    let hash;

    // Convert element to 32 byte hash if it is not one already
    if (el.length !== 32 || !Buffer.isBuffer(el)) {
      hash = keccakFromString(el);
    } else {
      hash = el;
    }

    for (let i = 0; i < arr.length; i++) {
      if (hash.equals(arr[i])) {
        return i;
      }
    }

    return -1;
  }

  getNextLayer(elements) {
    return elements.reduce((layer, el, idx, arr) => {
      if (idx % 2 === 0) {
        // Hash the current element with its pair element
        layer.push(this.combinedHash(el, arr[idx + 1]));
      }

      return layer;
    }, []);
  }

  combinedHash(first, second) {
    if (!first) {
      return second;
    }
    if (!second) {
      return first;
    }

    return keccak256(this.sortAndConcat(first, second));
  }

  getLayers() {
    if (this.elements.length === 0) {
      return [[""]];
    }

    const layers = [];
    layers.push(this.elements);

    // Get next layer until we reach the root
    while (layers[layers.length - 1].length > 1) {
      layers.push(this.getNextLayer(layers[layers.length - 1]));
    }

    return layers;
  }

  bufDedup() {
    return this.elements.filter((el, idx) => {
      return idx === 0 || !this.elements[idx - 1].equals(el);
    });
  }

  constructor(elements) {
    this.elements = elements
      .filter((el) => el)
      .map((el) => Buffer.from(hexToBytes(el)));

    // Sort elements
    this.elements.sort(Buffer.compare);

    // Deduplicate elements
    this.elements = this.bufDedup();

    // Create layers
    this.layers = this.getLayers();
  }

  get root() {
    return this.layers[this.layers.length - 1][0];
  }

  get hexRoot() {
    return bufferToHex(this.root);
  }

  getProof(el) {
    let idx = this.bufIndexOf(el, this.elements);

    if (idx === -1) {
      throw new Error("Element does not exist in Merkle tree");
    }

    return this.layers.reduce((proof, layer) => {
      const pairElement = this.getPairElement(idx, layer);

      if (pairElement) {
        proof.push(pairElement);
      }

      idx = Math.floor(idx / 2);

      return proof;
    }, []);
  }

  // external call - convert to buffer
  getHexProof(_el) {
    const el = Buffer.from(hexToBytes(_el));

    const proof = this.getProof(el);

    return this.bufArrToHexArr(proof);
  }
}

const createTreeWithAccounts = (accounts) => {
  const elements = Object.entries(accounts).map(([account, { balance }]) =>
    soliditySha3(account, balance.toString())
  );
  return new MerkleTree(elements);
};

const getAccountBalanceProof = (tree, account, balance) => {
  const element = soliditySha3(account, balance.toString());
  return tree.getHexProof(element);
};

module.exports = {
  createTreeWithAccounts,
  getAccountBalanceProof,
};
