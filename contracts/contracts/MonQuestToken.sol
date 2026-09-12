// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MonQuestToken
 * @notice A minimal, self-contained ERC-20 implementation used as a demo
 *         token in the Mon-E-Heist bounty platform.
 *
 *  • Owner can mint new tokens at any time.
 *  • No external dependencies (no OpenZeppelin import) to keep the Hardhat
 *    project fully self-contained and fast to compile.
 */
contract MonQuestToken {
    string public name;
    string public symbol;
    uint8  public decimals;
    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner, "MonQuestToken: caller is not the owner");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply
    ) {
        name     = _name;
        symbol   = _symbol;
        decimals = _decimals;
        owner    = msg.sender;
        if (_initialSupply > 0) {
            uint256 supply = _initialSupply * (10 ** _decimals);
            balanceOf[msg.sender] = supply;
            totalSupply = supply;
            emit Transfer(address(0), msg.sender, supply);
        }
    }

    /* ---- mint (only owner) ---- */

    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "MonQuestToken: mint to the zero address");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Mint(to, amount);
        emit Transfer(address(0), to, amount);
    }

    /* ---- ERC-20 core ---- */

    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "MonQuestToken: transfer to the zero address");
        return _transfer(msg.sender, to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(from != address(0), "MonQuestToken: transfer from the zero address");
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "MonQuestToken: insufficient allowance");
        allowance[from][msg.sender] = currentAllowance - amount;
        return _transfer(from, to, amount);
    }

    /* ---- internal ---- */

    function _transfer(address from, address to, uint256 amount) private returns (bool) {
        require(balanceOf[from] >= amount, "MonQuestToken: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}