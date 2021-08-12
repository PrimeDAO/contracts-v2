pragma solidity 0.8.6;

import "openzeppelin-contracts-sol8/token/ERC20/extensions/ERC20Snapshot.sol";

contract Reputation is ERC20 {

    constructor(
        address[] memory repHolders,
        uint256[] memory repAmouts
    )
    ERC20("PrimeDAO Reputation", "REP")
    {
        require(repAmouts.length == repHolders.length,
            "Reputation: number of reputation holders doesn't match number of reputation amounts");

        // mint rep to holders 
        for (uint64 j = 0; j < repAmouts.length; j++) { 
            ERC20._mint(repHolders[j], repAmouts[j]);
        } 
    }

    function transfer(
        address recipient,
        uint256 amount
    ) public override pure returns(bool) {
        return false;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override pure returns(bool) {
        return false;
    }

    function batchMint(
        address[] memory _repRecipients,
        uint[] memory _repAmounts
    ) public {

    }
}
