pragma solidity ^0.8.0;

import "../gnosis/GnosisSafe.sol";


contract SigatureHandler {
    //keccak256(
    //    "SafeMessage(bytes message)"
    //);
    bytes32 private constant SAFE_MSG_TYPEHASH = 0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca;


    // bytes4(keccak256("isValidSignature(bytes,bytes)")
    bytes4 internal constant EIP1271_MAGIC_VALUE = 0x20c13b0b;

    GnosisSafe public mothership;

    event SignMsg(bytes32 indexed msgHash);

    mapping(bytes32 => bytes[]) public personallySignedMessages;

    constructor(GnosisSafe addr) {
        mothership = addr;
    }

    function isValidSignature(bytes memory _hash, bytes memory _signature) external view returns(bytes4) {
            return EIP1271_MAGIC_VALUE;

    }

    function generateSignature(bytes memory messageHash) internal returns(bytes memory signature){
        bytes1 v = 0x01;
        bytes12 a;
        bytes memory paddedAddress = bytes.concat(a, bytes20(msg.sender));
        signature = bytes.concat(paddedAddress, bytes32(uint256(65)), v, bytes32(uint256(messageHash.length)), messageHash);
    }

    /// @dev Marks a message as signed, so that it can be used with EIP-1271
    /// @notice Marks a message (`_data`) as signed.
    /// @param _data Arbitrary length data that should be marked as signed on the behalf of address(this)
    function signMessage(bytes calldata _data) external {
        bytes32 msgHash = getMessageHash(_data);

        // Person directly approves transaction hash on the GnosisSafe
        address(mothership).delegatecall(abi.encodeWithSignature("approveHash(bytes32)", msgHash));
        personallySignedMessages[msgHash].push(generateSignature(abi.encodePacked(msgHash)));
        emit SignMsg(msgHash);
    }




/// @dev Returns hash of a message that can be signed by owners.
    /// @param message Message that should be hashed
    /// @return Message hash.
    function getMessageHash(bytes memory message) public view returns (bytes32) {
        bytes32 safeMessageHash = keccak256(abi.encode(SAFE_MSG_TYPEHASH, keccak256(message)));
        return
        keccak256(abi.encodePacked(bytes1(0x19), bytes1(0x01), mothership.domainSeparator(), safeMessageHash));
    }


    function getSignatures(bytes32 msgHash) external view returns(bytes[] memory) {
        return personallySignedMessages[msgHash];
    }
}
