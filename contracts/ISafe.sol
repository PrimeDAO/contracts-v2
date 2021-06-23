// solium-disable linebreak-style
pragma solidity ^0.8.4;

contract Enum {
    enum Operation {
        Call,
        DelegateCall
    }
}

interface ISafe{
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) external view returns (bytes32);
}
