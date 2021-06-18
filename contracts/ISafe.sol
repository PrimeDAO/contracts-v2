pragma solidity ^0.8.4;

contract Enum {
    enum Operation {
        Call,
        DelegateCall
    }
}

interface ISafe{
    function execTransactionFromModule(address to, uint256 value, bytes memory data, Enum.Operation operation)
        external
        returns (bool success);
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes calldata signatures)
        external returns (bool success);
}
