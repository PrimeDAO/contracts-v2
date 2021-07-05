/*
██████╗░██████╗░██╗███╗░░░███╗███████╗██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██║████╗░████║██╔════╝██╔══██╗██╔══██╗██╔══██╗
██████╔╝██████╔╝██║██╔████╔██║█████╗░░██║░░██║███████║██║░░██║
██╔═══╝░██╔══██╗██║██║╚██╔╝██║██╔══╝░░██║░░██║██╔══██║██║░░██║
██║░░░░░██║░░██║██║██║░╚═╝░██║███████╗██████╔╝██║░░██║╚█████╔╝
╚═╝░░░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝╚══════╝╚═════╝░╚═╝░░╚═╝░╚════╝░
*/

// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.6;

import "openzeppelin-contracts-sol8/token/ERC20/extensions/ERC20Capped.sol";

contract PrimeTokenV2 is ERC20Capped {

    constructor(
    	uint256 initialSupply,
    	address genesisMultisig
    )
    ERC20("PrimeDAO Token V2", "PRIMEv2")
    ERC20Capped(100000000*10**18)
    {
        ERC20._mint(genesisMultisig, initialSupply);
    }

}