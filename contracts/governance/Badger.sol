//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../libraries/Strings.sol";

contract Badger is Ownable, ERC1155 {
    using Strings for string;

    /*
        Structs
    */

    struct TokenTier {
        string uriId;
        bool transferable;
    }

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
            owner() == _msgSender() ||
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

    /**
     * @dev                 mints specified amount token(s) of specific id to specified account
     * @param account       beneficiary address
     * @param id            id of token, aka. tier
     * @param amount        units of token to be minted to beneficiary
     */
    function mint(
        address account,
        uint256 id,
        uint256 amount
    ) public onlyOwner {
        bytes memory data;

        _mint(account, id, amount, data);
    }

    /**
     * @dev                 burns specified amount token(s) of specific id from specified account
     * @param account       address of token holder
     * @param id            id of token, aka. tier
     * @param amount        units of token to be burnt from beneficiary
     */
    function burn(
        address account,
        uint256 id,
        uint256 amount
    ) public onlyOwner {
        _burn(account, id, amount);
    }

    /**
     * @dev                 mints to multiple addresses arbitrary units of tokens of ONE token id per address
     * @notice              example: mint 3 units of tokenId 1 to alice and 4 units of tokenId 2 to bob
     * @param accounts      list of beneficiary addresses
     * @param tokenIds      list of token ids (aka tiers)
     * @param amounts       list of mint amounts
     */
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

    /**
     * @dev                 burns from multiple addresses arbitrary units of tokens of ONE token id per address
     *                      example: burn 3 units of tokenId 1 from alice and 4 units of tokenId 2 froms bob
     * @param accounts      list of token holder addresses
     * @param tokenIds      list of token ids (aka tiers)
     * @param amounts       list of burn amounts
     */
    function burnFromMultiple(
        address[] calldata accounts,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) public onlyOwner isSameLength(accounts, tokenIds, amounts) {
        for (uint256 i = 0; i < accounts.length; i++) {
            _burn(accounts[i], tokenIds[i], amounts[i]);
        }
    }

    /**
     * @dev                 burns from multiple addresses arbitrary units of tokens of ONE token id per address
     *                      example: mint 3 units of tokenId 1 as well as 4 units of tokenId 2 to Alice
     *                      and mint 4 units of tokenId 2 as well as 5 units of tokenId 1 to Bob
     * @param accounts      list of token holder addresses
     * @param tokenIds      list of lists of token ids -> order must match with amounts
     * @param amounts       list of lists of burn amounts -> order must match with tokenIds
     */
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

    /**
     * @dev                 transfers tokens from one address to another and uses 0x0 as default data parameter
     * @notice              this is mainly used for manual contract interactions via etherscan
     * @param from          address from which token will be transferred
     * @param to            recipient of address
     * @param id            id of token to be transferred
     * @param amount        amount of token to be transferred
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

    /**
     * @dev                 transfers tokens from one address to another allowing custom data parameter
     * @notice              this is the standard transfer interface for ERC1155 tokens which contracts expect
     * @param from          address from which token will be transferred
     * @param to            recipient of address
     * @param id            id of token to be transferred
     * @param amount        amount of token to be transferred
     */
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

    /**
     * @dev                 sets a base uri, that is the first part of the url where the metadata for a tokenId is stored
     * @param _newBaseUri   baseUrl (e.g. www.filestoring.com/)
     */
    function changeBaseUri(string memory _newBaseUri) public onlyOwner {
        _setURI(_newBaseUri);
    }

    /**
     * @dev                 creates a new token tier
     * @param tokenId       identifier for the new token tier
     * @param uriId         identifier that is appended to the baseUri together forming the uri where the metadata lives
     * @param transferable  determines if tokens from specific tier should be transferable or not
     */
    function createTokenTier(
        uint256 tokenId,
        string calldata uriId,
        bool transferable
    ) public onlyOwner isValidString(uriId) {
        tokenTiers[tokenId] = TokenTier(uriId, transferable);
    }

    /**
     * @dev                 updates the identifier that is appended to the baseUri for a specific tokenId (tier)
     * @param tokenId       tokenId for which the uri should be updated
     * @param uriId         identifier that is appended to the baseUri together forming the uri where the metadata lives
     */
    function updateUriIdentifier(uint256 tokenId, string calldata uriId)
        public
        onlyOwner
    {
        _updateUriIdentifier(tokenId, uriId);
    }

    /**
     * @dev                 update uri identifiers for multiple token ids (tiers)
     * @param tokenIds      tokenIds for which the uri should be updated (must be in same order as uriIds)
     * @param uriIds        identifiers that are appended to the baseUri together forming the uri where the metadata lives (must be in same order ass tokenIds)
     */
    function updateMultipleUriIdentifiers(
        uint256[] calldata tokenIds,
        string[] calldata uriIds
    ) public onlyOwner {
        require(tokenIds.length == uriIds.length, "Input array mismatch");

        for (uint8 i = 0; i < tokenIds.length; i++) {
            _updateUriIdentifier(tokenIds[i], uriIds[i]);
        }
    }

    /**
     * @dev                 updates transferability for a given token id (tier)
     * @param tokenId       tokenId for which transferability should be updated
     * @param transferable  determines whether tokens from tier should be transferable or not
     */
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

    /**
     * @dev                 returns the uri for a given token
     * @notice              consists of a concatenation of baseUri and uriId
     * @param tokenId       tokenId for which the uri should be retrieved
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
