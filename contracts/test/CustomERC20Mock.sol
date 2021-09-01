// solium-disable linebreak-style
pragma solidity 0.8.6;

import "openzeppelin-contracts-sol8/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract CustomERC20Mock is ERC20 {
    mapping(address => uint256) private _balances;

    mapping(address => mapping(address => uint256)) private _allowances;

    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
    {
        _balances[msg.sender] += 20000000000000000000000;
    }

    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        bool success = _customTransfer(_msgSender(), recipient, amount);
        return success;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        uint256 currentAllowance = _allowances[sender][_msgSender()];
        if (currentAllowance < amount) {
            return false;
        }

        bool success = _customTransfer(sender, recipient, amount);
        if (success) {
            /* solium-disable */
            unchecked {
                _approve(sender, _msgSender(), currentAllowance - amount);
            }
            /* solium-enable */
        }
        return true;
    }

    function approve(address spender, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function balanceOf(address account)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _balances[account];
    }

    function burn(address account) public {
        _balances[account] = 0;
    }

    function _customTransfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual returns (bool) {
        uint256 senderBalance = _balances[sender];
        if (
            sender == address(0) ||
            recipient == address(0) ||
            senderBalance < amount
        ) {
            return false;
        }
        unchecked {
            _balances[sender] = senderBalance - amount;
        }
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual override {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}
