const { task } = require("hardhat/config");
const { api } = require("./utils/gnosis.js");
const { execute } = require("./utils/gnosis");

const { PK } = process.env;

task("addDelegate", "adds delegate to Gnosis Safe")
  .addParam("safe", "address of safe", undefined)
  .addParam("delegate", "address of delegate", undefined)
  .setAction(
    async ({ safe: safeAddress, delegate: delegateAddress }, { ethers }) => {
      console.log(
        `adding delegate ${delegateAddress} to Gnosis Safe ${safeAddress}`
      );
      const gnosis = api(safeAddress, network.name);
      const { root } = await ethers.getNamedSigners();
      const label = "Signer";
      const totp = Math.floor(Math.floor(Date.now() / 1000) / 3600);
      const signature = await root.signMessage(
        delegateAddress + totp.toString()
      );
      const payload = {
        safe: safeAddress,
        delegate: delegateAddress,
        label,
        signature,
      };
      const result = await gnosis.addDelegate(payload);
      if (result.status == 201) {
        console.log("Successfully added");
        return;
      }
      console.log(result);
      return;
    }
  );

/**
 * @example
 * ```
 *   npx hardhat executeSafeTx --network <> --safe <> --owner <> --pk <>
 *   npx hardhat executeSafeTx --network goerli --safe 0xDb19E145b8Acb878B6410704b05BA4f91231E1F0 --owner 0xB86fa0cfEEA21558DF988AD0ae22F92a8EF69AC1 --pk ""
 *   npx hardhat executeSafeTx --network celo --safe 0x0276a552F424949C934bC74bB623886AAc9Ed807 --owner 0xB86fa0cfEEA21558DF988AD0ae22F92a8EF69AC1 --pk ""
 * ```
 */
task("executeSafeTx", "execute tx in Gnosis Safe")
  .addParam("safe", "address of safe", undefined)
  .addParam("owner", "owner", undefined)
  .addParam("pk", "private key of account", undefined)
  .setAction(async ({ safe, owner, pk }, { ethers }) => {
    if (!pk) pk = PK;

    try {
      const response = await execute(ethers, network.name, safe, owner, pk);
      console.log("Response: ", response);
    } catch (error) {
      console.log("Error: ", error);
    }
  });
