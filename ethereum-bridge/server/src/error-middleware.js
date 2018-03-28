export default async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    ctx.status = err.code ? 400 : 500
    const jsonError = {
      message: err.message,
      code: err.code,
    }
    ctx.body = jsonError
    ctx.log.error({response: jsonError, status: ctx.status}, 'error response')
  }
}
