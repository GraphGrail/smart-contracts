import chai from 'chai'
import generate from 'nanoid/generate'

const assert = chai.assert

export async function assertRevert(promise, message) {
  try {
    await promise
    assert.fail('Expected revert not received')
  } catch (error) {
    const revertFound = error.message.search('revert') >= 0
    assert(revertFound, `Expected "revert", got ${error} instead ${message}`)
  }
}

assert.bignumEqual = function assertBignumEqual(bal1, bal2, message) {
  assert.equal(bal1.toString(), bal2.toString(), message)
}

const APLHABET = '0123456789abcdef'

export function generateRandomAddress() {
  return '0x' + generate(APLHABET, 40)
}
