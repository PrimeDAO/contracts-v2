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

/**
 * @title PrimeDAO Signer Contract
 * @dev   Enables signing SeedFactory.deploySeed() transaction before sending it to Gnosis Safe.
 */
contract Signer {

    // EIP1271 magic value - should be returned to validate the signature
    bytes4 internal constant EIP1271_MAGIC_VALUE       = 0x20c13b0b;
    // SeedFactory.deploySeed() byte hash
    bytes4 internal constant SEED_FACTORY_MAGIC_VALUE  = 0x4a7eb3c2;
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
    0x7a9f5b2bf4dbb53eb85e012c6094a3d71d76e5bfe821f44ab63ed59311264e35;
    bytes32 private constant SEED_MSG_TYPEHASH         =
    0xa1a7ad659422d5fc08fdc481fd7d8af8daf7993bc4e833452b0268ceaab66e5d;

    mapping(bytes32 => uint8) public approvedSignatures;

    address public safe;
    address public seedFactory;

    event SignatureCreated(bytes signature, bytes32 hash);

    /**
     * @dev                Signer Constructor
     * @param _safe        Gnosis Safe address.
     * @param _seedFactory Seed Factory address.
     */
    constructor (address _safe, address _seedFactory) {
        require(
            _safe != address(0) && _seedFactory != address(0),
            "Signer: Safe and SeedFactory address cannot be zero"
            );
        safe = _safe;
        seedFactory = _seedFactory;
    }

    /**
     * @dev                Validate signature using EIP1271
     * @param _hash        Encoded transaction hash supplied to verify signature.
     * @param _signature   Signature that needs to be verified.
     */
    function isValidSignature(bytes memory _hash, bytes memory _signature) external view returns(bytes4) {
        if (approvedSignatures[keccak256(_signature)] == 1) {
            return EIP1271_MAGIC_VALUE;
        }
        return "0x";
    }

    /**
     * @dev                   Signature generator
     * @param _to             receiver address.
     * @param _value          value in wei.
     * @param _data           encoded transaction data.
     * @param _operation      type of operation call.
     * @param _safeTxGas      safe transaction gas for gnosis safe.
     * @param _baseGas        base gas for gnosis safe.
     * @param _gasPrice       gas price for gnosis safe transaction.
     * @param _gasToken       token which gas needs to paid for gnosis safe transaction.
     * @param _refundReceiver address account to receive refund for remaining gas.
     * @param _nonce          gnosis safe contract nonce.
     */
    function generateSignature(
        address _to,
        uint256 _value,
        bytes calldata _data,
        Enum.Operation _operation,
        uint256 _safeTxGas,
        uint256 _baseGas,
        uint256 _gasPrice,
        address _gasToken,
        address _refundReceiver,
        uint256 _nonce
        ) external returns(bytes memory signature, bytes32 hash) {

        // check if transaction parameters are correct
        require(_to == seedFactory, "Signer: cannot sign invalid transaction");
        require(_getFunctionHashFromData(_data) == SEED_FACTORY_MAGIC_VALUE, "Signer: cannot sign invalid function call");

        // get contractTransactionHash from gnosis safe
        hash = ISAFE(safe).getTransactionHash(
            _to,
            _value,
            _data,
            _operation,
            _safeTxGas,
            _baseGas,
            _gasPrice,
            _gasToken,
            _refundReceiver,
            _nonce
            );

        bytes memory paddedAddress = bytes.concat(bytes12(0), bytes20(address(this)));
        bytes memory messageHash = _encodeMessageHash(hash);

        // generate signature and add it to approvedSignatures mapping
        signature = bytes.concat(paddedAddress, bytes32(uint256(65)), bytes1(0), bytes32(uint256(messageHash.length)), messageHash);
        approvedSignatures[keccak256(messageHash)] = 1;
        emit SignatureCreated(signature, hash);
    }

    /**
     * @dev               Get the byte hash of function call i.e. first four bytes of data
     * @param data        encoded transaction data.
     */
    function _getFunctionHashFromData(bytes memory data) private pure returns(bytes4 functionHash) {
        assembly {
            functionHash := mload(add(data, 32))
        }
    }

    /**
     * @dev                encode message with contants
     * @param message      the message that needs to be encoded
     */
    function _encodeMessageHash(bytes32 message) private pure returns (bytes memory) {
        bytes32 safeMessageHash = keccak256(abi.encode(SEED_MSG_TYPEHASH, message));
        return
            abi.encodePacked(
                bytes1(0x19), bytes1(0x23), keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, safeMessageHash)));
    }
}
