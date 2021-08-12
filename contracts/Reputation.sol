pragma solidity 0.8.6;

import "openzeppelin-contracts-sol8/token/ERC20/extensions/ERC20Snapshot.sol";
import "openzeppelin-contracts-sol8/access/Ownable.sol";

contract Reputation is ERC20, Ownable {

    modifier validInput(
        address[] memory _repRecipients,
        uint[] memory _repAmounts
    ){
        // TODO: implement length restriction
        require(
            _repRecipients.length == _repAmounts.length,
            "Reputation: number of reputation holders doesn't match number of reputation amounts"
        );
        _;
    }

    constructor(
        address[] memory _repRecipients,
        uint256[] memory _repAmounts
    )
    validInput(_repRecipients, _repAmounts)
    ERC20("PrimeDAO Reputation", "REP")
    {
        // mint rep to holders 
        for (uint64 j = 0; j < _repAmounts.length; j++) { 
            ERC20._mint(_repRecipients[j], _repAmounts[j]);
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
    ) public onlyOwner validInput(
        _repRecipients,
        _repAmounts
    ) {
        
    }
}
