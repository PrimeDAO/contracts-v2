const fs = require("fs").promises;
const path = require("path");
const compressAbis = require("../helperscript");

const networks = ["rinkeby", "mainnet"];

const sharedAbiConfig = {
  PrimeToken: "ERC20",
};

const exportAbiFunction = async ({ run, network }) => {
  const { name } = network;

  // if (!networks.includes(name)) return;

  const targetPath = path.resolve(__dirname, `../exports/${name}.json`);
  await run("export", { export: targetPath });

  const exportedAbis = JSON.parse(await fs.readFile(targetPath));
  const compressedAbis = compressAbis(exportedAbis, sharedAbiConfig);

  await fs.writeFile(targetPath, JSON.stringify(compressedAbis, null, 2));
};

module.exports = exportAbiFunction;
module.exports.tags = ["Export"];
module.exports.runAtTheEnd = true;
