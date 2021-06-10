pragma solidity ^0.8.4;

/**
 * @dev Interface of the ERC1271 standard signature validation method for
 * contracts as defined in https://eips.ethereum.org/EIPS/eip-1271[ERC-1271].
 *
 * _Available since v4.1._
 */
interface IERC1271 {
    /**
     * @dev Should return whether the signature provided is valid for the provided data
     * @param hash      Hash of the data to be signed
     * @param signature Signature byte array associated with _data
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4 magicValue);
}


contract SeedSignature{
    
    function isValidSignature(bytes32 _hash, bytes memory _signature) external pure returns(bytes4) {
        bytes32 add = _readBytes32(_signature, 0);
        bytes32 pos = uint(_readBytes32(_signature, 32));
        bytes1 v = uint8(_signature[65]);
        uint l = uint(_readBytes32(_signature, 65));
        bytes32 s = _readBytes32(_signature, 65+l);
        require(_hash == s, "Invalid Hash");
        return (add, pos, v, bytes4(keccak256("isValidSignature(bytes,bytes)")),l, s);
    }
    
    function _readBytes32(bytes memory b, uint256 index) private pure returns (bytes32 result) {
        require(
            b.length >= index + 32,
            "META_TX: Invalid index for given bytes"
        );
        
        index += 32;
        
        assembly {
            result := mload(add(b, index))
        }
        return result;
    }
    function generateSignature(bytes20 addres) external view returns(bytes memory hash,bytes memory signature){
        hash = "Gnosis Safe Transaction";
        bytes1 v;
        bytes12 a;
        bytes memory paddedAddress = bytes.concat(a, addres);
        signature = bytes.concat(paddedAddress, bytes32(uint256(65)), v, bytes32(uint256(hash.length)), hash);
    }
}