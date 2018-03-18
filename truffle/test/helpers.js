const assert = require('chai').assert

export async function assertRevert(promise, message) {
  try {
    await promise
    assert.fail('Expected revert not received')
  } catch (error) {
    const revertFound = error.message.search('revert') >= 0
    assert(revertFound, `Expected "revert", got ${error} instead ${message}`)
  }
}
