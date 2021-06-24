// solium-disable linebreak-style
pragma solidity ^0.8.0;


contract Signer {

    bytes4 internal constant EIP1271_MAGIC_VALUE = 0x20c13b0b;
    
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = keccak256("EIP1271Domain(uint256 chainId,address veryfingContract ");
    
    mapping(bytes => uint8) public approvedSignatures;
    
    bytes32 private constant SEED_MSG_TYPEHASH = keccak256("SeedHash(bytes hash");
    
    event SignatureCreated(bytes signature, bytes message);
    
    function isValidSignature(bytes memory _hash, bytes memory _signature) external view returns(bytes4) {
        if (approvedSignatures[_signature] == 1) {
            return EIP1271_MAGIC_VALUE;
        }
        return "0x";
    }
    
    function generateSignature(bytes memory _message) external returns(bytes memory signature){
        bytes memory paddedAddress = bytes.concat(bytes12(0), bytes20(address(this)));
        bytes memory messageHash = getMessageHash(_message);
        signature = bytes.concat(paddedAddress, bytes32(uint256(65)), bytes1(0), bytes32(uint256(messageHash.length)), messageHash);
        approvedSignatures[messageHash] = 1;
        emit SignatureCreated(signature, _message);
    }
    
    function getMessageHash(bytes memory message) private pure returns (bytes memory) {
        bytes32 safeMessageHash = keccak256(abi.encode(SEED_MSG_TYPEHASH, keccak256(message)));
        return
            abi.encodePacked(bytes1(0x19), bytes1(0x23), keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, safeMessageHash)));
    }
}