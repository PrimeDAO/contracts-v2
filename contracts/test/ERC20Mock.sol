// solium-disable linebreak-style
pragma solidity 0.8.6;

import "openzeppelin-contracts-sol8/token/ERC20/ERC20.sol";


contract ERC20Mock is ERC20 {

    constructor(string memory _name, string memory _symbol) public ERC20(_name, _symbol) {
        _mint(msg.sender, uint256(200000000000000000000000000));
    }
}