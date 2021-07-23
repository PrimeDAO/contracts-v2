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
pragma solidity ^0.8.4;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ILBPFactory.sol";
import "./interface/ILBP.sol";
import "./interface/Safe.sol";


contract LBPDeployer {

    // EIP1271 magic value - should be returned to validate the signature
    bytes4 internal constant EIP1271_MAGIC_VALUE       = 0x20c13b0b;
    // LBPDeployer.deployLbpFromFactory() byte hash
    bytes4 internal constant LBP_DEPLOYER_MAGIC_VALUE  = 0x318a22e5;
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
    0x7a9f5b2bf4dbb53eb85e012c6094a3d71d76e5bfe821f44ab63ed59311264e35;
    bytes32 private constant LBP_MSG_TYPEHASH         =
    0x09ceeeaec91efc3c49cc42ea9a732317a249581d788726e9f24a71fd2ce43a5e;

    address public safe;
    address public LBPFactory;
    uint256 public swapFeePercentage;
    bool isInitialized;
    
    mapping(bytes32 => uint8) public approvedSignatures;

    event SignatureCreated(bytes signature, bytes32 hash);


    modifier onlySafe {
        require(
            msg.sender == safe,
            "Deployer: only safe function"
            );
        _;
    }

    // I don't think we need this one because we set initialized in constructor
    // modifier initialized {
    //     require(
    //         isInitialized,
    //         "Deployer: contract not initialized"
    //         );
    //     _;
    // }

    constructor (
            address _safe,
            address _LBPFactory,
            uint256 _swapFeePercentage
        ) {

        LBPFactory = _LBPFactory;
        swapFeePercentage = _swapFeePercentage;
        safe = _safe;
        isInitialized = true;
    }

    function deployLbpFromFactory(
            string memory _name,
            string memory _symbol,
            IERC20[] memory _tokens,
            uint256[] memory _weights,
            bool _swapEnabledOnStart,
            uint256 _startTime,
            uint256 _endTime,
            uint256[] memory _endWeights
        ) public onlySafe {
        address lbp = ILBPFactory(LBPFactory).create(
                _name,
                _symbol,
                _tokens,
                _weights,
                swapFeePercentage,
                safe,
                _swapEnabledOnStart
            );
        ILBP(lbp).updateWeightsGradually(
                _startTime,
                _endTime,
                _endWeights
            );
    }

    function setSwapFeePercentage(uint256 _swapFeePercentage) public onlySafe {
        swapFeePercentage = _swapFeePercentage;
    }

    function setLBPFactory(address _LBPFactory) public onlySafe {
        LBPFactory = _LBPFactory;
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
        require(_getFunctionHashFromData(_data) == LBP_DEPLOYER_MAGIC_VALUE, "Signer: cannot sign invalid function call");

        // get contractTransactionHash from gnosis safe
        hash = Safe(safe).getTransactionHash(
            address(this),
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
        bytes32 safeMessageHash = keccak256(abi.encode(LBP_MSG_TYPEHASH, message));
        return
            abi.encodePacked(
                bytes1(0x19), bytes1(0x23), keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, safeMessageHash)));
    }

}