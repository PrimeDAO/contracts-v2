// solium-disable linebreak-style
pragma solidity 0.8.6;

import "openzeppelin-contracts-sol8/token/ERC20/ERC20.sol";


contract ERC20Mock is ERC20 {

    uint256 constant public initialSupply = 200000000000000000000000000;

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _mint(msg.sender, initialSupply);
    }
}