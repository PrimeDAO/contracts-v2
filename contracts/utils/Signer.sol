/*

██████╗░██████╗░██╗███╗░░░███╗███████╗██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██║████╗░████║██╔════╝██╔══██╗██╔══██╗██╔══██╗
██████╔╝██████╔╝██║██╔████╔██║█████╗░░██║░░██║███████║██║░░██║
██╔═══╝░██╔══██╗██║██║╚██╔╝██║██╔══╝░░██║░░██║██╔══██║██║░░██║
██║░░░░░██║░░██║██║██║░╚═╝░██║███████╗██████╔╝██║░░██║╚█████╔╝
╚═╝░░░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝╚══════╝╚═════╝░╚═╝░░╚═╝░╚════╝░

*/

// SPDX-License-Identifier: GPL-3.0-or-later

// solium-disable linebreak-style
pragma solidity ^0.8.0;

import "./interface/ISAFE.sol";


contract Signer {

    bytes4 internal constant EIP1271_MAGIC_VALUE       = 0x20c13b0b;
    bytes4 internal constant SEED_FACTORY_MAGIC_VALUE  = 0x4a7eb3c2;
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = 0x7a9f5b2bf4dbb53eb85e012c6094a3d71d76e5bfe821f44ab63ed59311264e35;
    bytes32 private constant SEED_MSG_TYPEHASH         = 0xa1a7ad659422d5fc08fdc481fd7d8af8daf7993bc4e833452b0268ceaab66e5d;

    mapping(bytes => uint8) public approvedSignatures;

    address safe;
    address seedFactory;

    event SignatureCreated(bytes signature, bytes32 hash);

    constructor (address _safe, address _seedFactory) {
        safe = _safe;
        seedFactory = _seedFactory;
    }

    function isValidSignature(bytes memory _hash, bytes memory _signature) external view returns(bytes4) {
        if (approvedSignatures[_signature] == 1) {
            return EIP1271_MAGIC_VALUE;
        }
        return "0x";
    }

    function generateSignature(
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
        ) external returns(bytes memory signature, bytes32 hash) {

        require(to == seedFactory, "Signer: cannot sign invalid transaction");
        require(getFunctionHashFromData(data) == SEED_FACTORY_MAGIC_VALUE, "Signer: cannot sign invalid function call");

        hash = ISAFE(safe).getTransactionHash(
            to,
            value,
            data,
            operation,
            safeTxGas,
            baseGas,
            gasPrice,
            gasToken,
            refundReceiver,
            _nonce
            );

        bytes memory paddedAddress = bytes.concat(bytes12(0), bytes20(address(this)));
        bytes memory messageHash = getMessageHash(hash);

        signature = bytes.concat(paddedAddress, bytes32(uint256(65)), bytes1(0), bytes32(uint256(messageHash.length)), messageHash);
        approvedSignatures[messageHash] = 1;
        emit SignatureCreated(signature, hash);
    }

    function getFunctionHashFromData(bytes memory _data) internal pure returns(bytes4 _functionHash) {
        assembly {
            _functionHash := mload(add(_data, 32))
        }
    }

    function getMessageHash(bytes32 message) private pure returns (bytes memory) {
        bytes32 safeMessageHash = keccak256(abi.encode(SEED_MSG_TYPEHASH, message));
        return
            abi.encodePacked(bytes1(0x19), bytes1(0x23), keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, safeMessageHash)));
    }
}
