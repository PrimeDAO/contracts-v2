pragma solidity 0.8.4;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract ERC20Mock is ERC20 {
    
    uint8  internal _decimal;

    function decimals() public view override returns(uint8) {
        return _decimal;
    }

    constructor(string memory _name, string memory _symbol, uint8 _decimals) public ERC20(_name, _symbol) {
        
        _decimal = _decimals;
        _mint(msg.sender, uint256(20000000000000000000000));
    }
}