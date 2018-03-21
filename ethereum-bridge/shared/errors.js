
export class UserError extends Error {
  constructor(message, code, sourceErr) {
    super(message)

    Object.defineProperties(this, {
      name: {value: 'UserError'},
      code: {value: code},
      source: {value: sourceErr},
    })

    Error.captureStackTrace(this, this.constructor)
  }

  static from(err, prependMessage, code) {
    return new UserError(
      prependMessage + ': ' + (err instanceof UserError ? err.message : err.stack),
      code || err.code,
      err,
    )
  }
}
