
export class UserError extends Error {
  constructor(message, code, sourceErr) {
    super(message)

    Object.defineProperties(this, {
      name: {value: 'UserError'},
      code: {value: code},
      source: {value: sourceErr},
    })

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error()).stack;
    }
  }

  static from(err, prependMessage, code) {
    return new UserError(
      prependMessage + ': ' + (err instanceof UserError ? err.message : err.stack),
      code || err.code,
      err,
    )
  }
}
