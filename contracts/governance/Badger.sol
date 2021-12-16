//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../libraries/Strings.sol";

struct TokenTier {
    string uriId;
    bool transferable;
}

contract Badger is Ownable, ERC1155 {
    using Strings for string;

    /*
        State variables
    */

    mapping(uint256 => TokenTier) public tokenTiers; // tokenId => TokenTier

    /*
        Modifiers
    */

    modifier isSameLength(
        address[] calldata accounts,
        uint256[] calldata tokenIds,
        uint256[] memory amounts
    ) {
        require(
            accounts.length == tokenIds.length &&
                tokenIds.length == amounts.length,
            "Input array mismatch"
        );
        _;
    }

    modifier isTier(uint256 tokenId) {
        require(
            _isNonEmptyString(tokenTiers[tokenId].uriId),
            "Tier does not exist"
        );
        _;
    }

    modifier isValidString(string calldata uriId) {
        require(_isNonEmptyString(uriId), "URI identifier required");
        _;
    }

    modifier isValidTransfer(uint256 tokenId, address from) {
        require(
            tokenTiers[tokenId].transferable,
            "Transfer disabled for this tier"
        );
        require(
            msg.sender == owner() ||
                from == _msgSender() ||
                isApprovedForAll(from, _msgSender()),
            "Unauthorized"
        );
        _;
    }

    /*
        Constructor
    */

    constructor(string memory _newBaseUri) ERC1155(_newBaseUri) {}

    /*
        Minting & burning
    */

    function mint(
        address account,
        uint256 id,
        uint256 amount
    ) public onlyOwner {
        bytes memory data;

        _mint(account, id, amount, data);
    }

    function burn(
        address account,
        uint256 id,
        uint256 amount
    ) public onlyOwner isTier(id) {
        _burn(account, id, amount);
    }

    function mintToMultiple(
        address[] calldata accounts,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) public onlyOwner isSameLength(accounts, tokenIds, amounts) {
        bytes memory data;

        for (uint256 i = 0; i < accounts.length; i++) {
            _mint(accounts[i], tokenIds[i], amounts[i], data);
        }
    }

    function burnFromMultiple(
        address[] calldata accounts,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) public onlyOwner isSameLength(accounts, tokenIds, amounts) {
        for (uint256 i = 0; i < accounts.length; i++) {
            _burn(accounts[i], tokenIds[i], amounts[i]);
        }
    }

    function mintMultipleToMultiple(
        address[] calldata accounts,
        uint256[][] calldata tokenIds,
        uint256[][] calldata amounts
    ) public onlyOwner {
        require(
            accounts.length == tokenIds.length &&
                tokenIds.length == amounts.length,
            "Input array mismatch"
        );

        bytes memory data;
        for (uint256 i = 0; i < accounts.length; i++) {
            require(
                tokenIds[i].length == amounts[i].length,
                "Input array mismatch"
            );

            for (uint8 j = 0; j < tokenIds[i].length; j++) {
                _mint(accounts[i], tokenIds[i][j], amounts[i][j], data);
            }
        }
    }

    /*
        Transferring
    */

    function transferFromWithoutData(
        address from,
        address to,
        uint256 id,
        uint256 amount
    ) public isValidTransfer(id, from) {
        bytes memory data;

        _safeTransferFrom(from, to, id, amount, data);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public override isValidTransfer(id, from) {
        _safeTransferFrom(from, to, id, amount, data);
    }

    /*
        Configuration
    */

    function changeBaseUri(string memory _newBaseUri) public onlyOwner {
        _setURI(_newBaseUri);
    }

    function createTokenTier(
        uint256 tokenId,
        string calldata uriId,
        bool transferable
    ) public onlyOwner isValidString(uriId) {
        tokenTiers[tokenId] = TokenTier(uriId, transferable);
    }

    function updateUriIdentifier(uint256 tokenId, string calldata uriId)
        public
        onlyOwner
    {
        _updateUriIdentifier(tokenId, uriId);
    }

    function updateMultipleUriIdentifiers(
        uint256[] calldata tokenIds,
        string[] calldata uriIds
    ) public onlyOwner {
        require(tokenIds.length == uriIds.length, "Input array mismatch");

        for (uint8 i = 0; i < tokenIds.length; i++) {
            _updateUriIdentifier(tokenIds[i], uriIds[i]);
        }
    }

    function updateTransferableStatus(uint256 tokenId, bool transferable)
        public
        onlyOwner
        isTier(tokenId)
    {
        tokenTiers[tokenId].transferable = transferable;
    }

    /*
        Queries
    */

    function uri(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        string memory baseUri = super.uri(tokenId);
        return baseUri.append(tokenTiers[tokenId].uriId);
    }

    /*
        Internal functions
    */

    function _updateUriIdentifier(uint256 tokenId, string calldata uriId)
        private
        isTier(tokenId)
        isValidString(uriId)
    {
        tokenTiers[tokenId].uriId = uriId;
    }

    function _isNonEmptyString(string memory uriId)
        internal
        pure
        returns (bool)
    {
        return bytes(uriId).length != 0;
    }

    function _mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal override isTier(id) {
        super._mint(account, id, amount, data);
    }

    function _burn(
        address account,
        uint256 id,
        uint256 amount
    ) internal override isTier(id) {
        super._burn(account, id, amount);
    }
}
