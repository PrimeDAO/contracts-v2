const fs = require("fs").promises;
const path = require("path");
const sharedAbiConfig = require("./sharedAbiConfig");

const networks = ["rinkeby", "mainnet", "kovan", "arbitrum"];

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
const exportAbiFunction = async ({ run, network, deployments }) => {
  const { name } = network;
  if (!networks.includes(name)) return;

  // export ABIs of deployed contracts via hardhat
  const targetExportPath = path.resolve(__dirname, `../exports/${name}.json`);
  await run("export", { export: targetExportPath });

  // compress ABIs according to sharedAbiConfig
  const exportedAbis = JSON.parse(await fs.readFile(targetExportPath));
  const compressedAbis = compressAbis(exportedAbis, sharedAbiConfig, name);
  await fs.writeFile(targetExportPath, JSON.stringify(compressedAbis, null, 2));

  // inject ABI from externally embedded artifacts into exported sharedAbis.json
  // IF they exist in external sources AND do not yet exist in sharedAbis.json
  const sharedAbisPath = path.resolve(__dirname, `../exports/sharedAbis.json`);
  const sharedAbis = JSON.parse(await fs.readFile(sharedAbisPath));
  const sharedAbiNames = Array.from(
    new Set(
      networks.reduce((array, networkName) => {
        const networkAbiNames = Object.values(sharedAbiConfig[networkName]).map(
          (contract) => contract.abi
        );
        return array.concat([...networkAbiNames]);
      }, [])
    )
  );
  let updateSharedAbis = false;
  for (const abiName of sharedAbiNames) {
    const artifact = await deployments.getArtifact(abiName);
    if (artifact && !sharedAbis[abiName]) {
      sharedAbis[abiName] = artifact.abi;
      updateSharedAbis = true;
    }
  }
  if (updateSharedAbis) {
    await fs.writeFile(sharedAbisPath, JSON.stringify(sharedAbis, null, 2));
    console.log(`exported deployed contract information to ${name}.json`);
  }
};

module.exports = exportAbiFunction;
module.exports.tags = ["Export"];
module.exports.runAtTheEnd = true;
