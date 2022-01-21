/*

██████╗░██████╗░██╗███╗░░░███╗███████╗██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██║████╗░████║██╔════╝██╔══██╗██╔══██╗██╔══██╗
██████╔╝██████╔╝██║██╔████╔██║█████╗░░██║░░██║███████║██║░░██║
██╔═══╝░██╔══██╗██║██║╚██╔╝██║██╔══╝░░██║░░██║██╔══██║██║░░██║
██║░░░░░██║░░██║██║██║░╚═╝░██║███████╗██████╔╝██║░░██║╚█████╔╝
╚═╝░░░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝╚══════╝╚═════╝░╚═╝░░╚═╝░╚════╝░

*/
// SPDX-License-Identifier: GPL-3.0-or-later
// solium-disable linebreak-style

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

contract PrimeToken is ERC20Capped {
    constructor(
        uint256 initialSupply,
        uint256 cap,
        address genesisMultisig
    ) public ERC20("PrimeDAO Token", "PRIME") ERC20Capped(cap) {
        require(initialSupply <= cap); // _mint from ERC20 is not protected
        ERC20._mint(genesisMultisig, initialSupply);
    }
}
