const fs = require("fs").promises;
const path = require("path");

const networks = ["rinkeby", "mainnet"];

const sharedAbiConfig = {
  PrimeToken: "ERC20",
  Dai: "ERC20",
  Weth: "ERC20",
};

const compressAbis = (abisObject, sharedAbiConfig) => {
  const compressedAbiObject = { ...abisObject };
  const { contracts } = compressedAbiObject;

  for (const contractName in contracts) {
    if (sharedAbiConfig[contractName]) {
      contracts[contractName].abi = sharedAbiConfig[contractName];
    }
  }

  return compressedAbiObject;
};

// this function runs after a new deployment if the tag "Export" is specified
// it generates the abis and addresses for the frontend and compresses the resulting file
// by saving just one abi representation for contracts that share the same ABI (e.g. ERC20)
const exportAbiFunction = async ({ run, network }) => {
  const { name } = network;

  if (!networks.includes(name)) return;

  const targetPath = path.resolve(__dirname, `../exports/${name}.json`);
  await run("export", { export: targetPath });

  const exportedAbis = JSON.parse(await fs.readFile(targetPath));
  const compressedAbis = compressAbis(exportedAbis, sharedAbiConfig);

  await fs.writeFile(targetPath, JSON.stringify(compressedAbis, null, 2));
};

module.exports = exportAbiFunction;
module.exports.tags = ["Export"];
module.exports.runAtTheEnd = true;
