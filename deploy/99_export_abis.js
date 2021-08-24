const fs = require("fs").promises;
const path = require("path");
const sharedAbiConfig = require("./sharedAbiConfig");

const networks = ["rinkeby", "mainnet"];

const compressAbis = (abisObject, sharedAbiConfig, networkName) => {
  const networkContracts = { ...sharedAbiConfig[networkName] };

  const compressedAbiObject = { ...abisObject };
  const { contracts } = compressedAbiObject;

  for (const contractName in networkContracts) {
    const { abi, address } = sharedAbiConfig[networkName][contractName];

    if (contracts[contractName]) {
      contracts[contractName].abi = abi;
    } else {
      contracts[contractName] = {
        abi: abi,
        address: address,
      };
    }
  }

  return compressedAbiObject;
};

// this function runs after a new deployment if the tag "Export" is used
// it generates the abis and addresses for the frontend and compresses the resulting file
// by saving just one abi representation for contracts that share the same ABI (e.g. ERC20)
const exportAbiFunction = async ({ run, network }) => {
  const { name } = network;

  if (!networks.includes(name)) return;

  const targetPath = path.resolve(__dirname, `../exports/${name}.json`);
  await run("export", { export: targetPath });

  const exportedAbis = JSON.parse(await fs.readFile(targetPath));
  const compressedAbis = compressAbis(exportedAbis, sharedAbiConfig, name);

  await fs.writeFile(targetPath, JSON.stringify(compressedAbis, null, 2));
};

module.exports = exportAbiFunction;
module.exports.tags = ["Export"];
module.exports.runAtTheEnd = true;
