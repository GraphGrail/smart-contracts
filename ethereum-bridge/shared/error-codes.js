/**
 * The Ether balance is insufficient.
 */
export const INSUFFICIENT_ETHER_BALANCE = 'INSUFFICIENT_ETHER_BALANCE'

/**
 * The token balance is insufficient.
 */
export const INSUFFICIENT_TOKEN_BALANCE = 'INSUFFICIENT_TOKEN_BALANCE'

/**
 * The contract with specified address is not found in blockchain.
 */
export const CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND'

/**
 * The caller is not authorized to perform this action.
 */
export const UNAUTHORIZED = 'UNAUTHORIZED'

/**
 * The attempted action cannot be performed on contract in this state.
 */
export const INVALID_CONTRACT_STATE = 'INVALID_CONTRACT_STATE'

/**
 * The passed data is invalid, e.g. is not in expected format
 * or inconsistent.
 */
export const INVALID_DATA = 'INVALID_DATA'

/**
 * Transaction failed because some pre-condition is not met,
 * or there's an error in code.
 */
export const TRANSACTION_FAILED = 'TRANSACTION_FAILED'

/**
 * The library is already initialized or being initialized.
 */
export const ALREADY_INITIALIZED = 'ALREADY_INITIALIZED'

/**
 * The library is not initialized.
 */
export const NOT_INITIALIZED = 'NOT_INITIALIZED'

/**
 * No ethereum client.
 */
export const NO_ETHEREUM_CLIENT = 'NO_ETHEREUM_CLIENT'

/**
 * Ethereum client has no accounts set.
 */
export const NO_ACCOUNTS = 'NO_ACCOUNTS'

/**
 * The active Ethereum network differs from the expected one.
 */
export const WRONG_NETWORK = 'WRONG_NETWORK'

/**
 * Couldn't add transactions while one is already in flight
 */
export const TRANSACTION_ALREADY_RUNNING = 'TRANSACTION_ALREADY_RUNNING'

/**
 * The ethereum address passed is invalid.
 */
export const INVALID_ETHEREUM_ADDRESS = 'INVALID_ETHEREUM_ADDRESS'
