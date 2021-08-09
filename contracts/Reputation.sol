pragma solidity 0.8.6;

import "openzeppelin-contracts-sol8/token/ERC20/extensions/ERC20Snapshot.sol";
// import "openzeppelin-contracts-sol8/token/ERC20/extensions/ERC20Burnable.sol";
// import "openzeppelin-contracts-sol8/token/ERC20/IERC20.sol";
// import "openzeppelin-contracts-sol8/token/ERC20/ERC20.sol";


contract Reputation is ERC20Snapshot {

    constructor(
        uint256[] memory repAmouts,
        address[] memory repHolders
    )
    public
    ERC20("PrimeDAO Reputation", "REP")// ERC20Capped(cap)
    {
        require(repAmouts.length == repHolders.length);

        // mint rep to holders 
        for(uint64 j = 0; j < repAmouts.length; j++){ 
            ERC20._mint(repHolders[j], repAmouts[j]);
        }
    }

    function transfer(address recipient, uint256 amount) public override returns(bool) {
        return false;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    )
    public override returns(bool) {
        return false;
    }

}
