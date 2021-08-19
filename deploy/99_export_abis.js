const path = require("path");
const fs = require("fs");

const sharedAbis = {
  PrimeToken: "ERC20",
};

const exportAbiFunction = async ({ run, network }) => {
  console.log(network);
  await run("export", { export: "kek.json" });
};

module.exports = exportAbiFunction;
module.exports.tags = ["Export"];
module.exports.runAtTheEnd = true;
