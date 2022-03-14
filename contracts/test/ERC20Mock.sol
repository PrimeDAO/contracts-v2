// solium-disable linebreak-style
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20MockToken is ERC20 {
    constructor(
        uint256 supply,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        _mint(msg.sender, supply);
    }
}
