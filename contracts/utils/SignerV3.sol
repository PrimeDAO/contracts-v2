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
pragma solidity 0.8.6;

import "./interface/Safe.sol";
import "@gnosis.pm/safe-contracts/contracts/interfaces/ISignatureValidator.sol";

/**
 * @title PrimeDAO Signer Contract
 * @dev   Enables signing SeedFactory.deploySeed() transaction before sending it to Gnosis Safe.
 */
contract SignerV2 is ISignatureValidator {
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        0x7a9f5b2bf4dbb53eb85e012c6094a3d71d76e5bfe821f44ab63ed59311264e35;
    bytes32 private constant MSG_TYPEHASH =
        0xa1a7ad659422d5fc08fdc481fd7d8af8daf7993bc4e833452b0268ceaab66e5d; // mapping for msg typehash

    mapping(bytes32 => bytes32) public approvedSignatures;

    /* solium-disable */
    mapping(bytes32 => address) public registeredSafe;
    /* solium-enable */

    event SignatureCreated(bytes signature, bytes32 indexed hash);
    event NewDaoRegistered(bytes32 indexed botId, address indexed safe);

    /**
     * @dev this will be used to register a safe for new telegram bot created by user
     * @param _safe address of newly deployed gnosis safe for the telegram bot
     */
    function registerNewDao(address _safe) public {
        bytes32 botId = keccak256(abi.encode(_safe));
        registeredSafe[botId] = _safe;
        emit NewDaoRegistered(botId, _safe);
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
     * @param _nonce          gnosis safe contract nonce.
     */
    function generateSignature(
        bytes32 _botId,
        address _to,
        uint256 _value,
        bytes calldata _data,
        Enum.Operation _operation,
        uint256 _safeTxGas,
        uint256 _baseGas,
        uint256 _gasPrice,
        uint256 _nonce
    ) external returns (bytes memory signature, bytes32 hash) {
        // check if transaction parameters are correct
        address currentSafe = registeredSafe[_botId];

        // get contractTransactionHash from gnosis safe
        hash = Safe(currentSafe).getTransactionHash(
            _to,
            0,
            _data,
            _operation,
            _safeTxGas,
            _baseGas,
            _gasPrice,
            address(0),
            address(0),
            _nonce
        );

        bytes memory paddedAddress = bytes.concat(
            bytes12(0),
            bytes20(address(this))
        );
        bytes memory messageHash = _encodeMessageHash(hash);
        // check if transaction is not signed before
        require(
            approvedSignatures[hash] != keccak256(messageHash),
            "Signer: transaction already signed"
        );

        // generate signature and add it to approvedSignatures mapping
        signature = bytes.concat(
            paddedAddress,
            bytes32(uint256(65)),
            bytes1(0),
            bytes32(uint256(messageHash.length)),
            messageHash
        );
        approvedSignatures[hash] = keccak256(messageHash);
        emit SignatureCreated(signature, hash);
    }

    /**
     * @dev                Validate signature using EIP1271
     * @param _data        Encoded transaction hash supplied to verify signature.
     * @param _signature   Signature that needs to be verified.
     */
    function isValidSignature(bytes memory _data, bytes memory _signature)
        public
        view
        override
        returns (bytes4)
    {
        if (_data.length == 32) {
            bytes32 hash;
            assembly {
                hash := mload(add(_data, 32))
            }
            if (approvedSignatures[hash] == keccak256(_signature)) {
                return EIP1271_MAGIC_VALUE;
            }
        } else {
            if (approvedSignatures[keccak256(_data)] == keccak256(_signature)) {
                return EIP1271_MAGIC_VALUE;
            }
        }
        return "0x";
    }

    /**
     * @dev               Get the byte hash of function call i.e. first four bytes of data
     * @param data        encoded transaction data.
     */
    function _getFunctionHashFromData(bytes memory data)
        private
        pure
        returns (bytes4 functionHash)
    {
        assembly {
            functionHash := mload(add(data, 32))
        }
    }

    /**
     * @dev                encode message with contants
     * @param message      the message that needs to be encoded
     */
    function _encodeMessageHash(bytes32 message)
        private
        pure
        returns (bytes memory)
    {
        bytes32 safeMessageHash = keccak256(abi.encode(MSG_TYPEHASH, message));
        return
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x23),
                keccak256(
                    abi.encode(DOMAIN_SEPARATOR_TYPEHASH, safeMessageHash)
                )
            );
    }

    /**
     * @dev                set new safe
     * @param _safe        safe address
     */
    function setSafe(address _safe, bytes32 _botId) public {
        require(
            msg.sender == registeredSafe[_botId],
            "Signer: only safe functionality"
        );
        require(_safe != address(0), "Signer: new safe cannot be zero address");
        registeredSafe[_botId] = _safe;
    }
}
