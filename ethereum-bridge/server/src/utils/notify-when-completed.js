import BigNumber from 'bignumber.js'
import nanoid from 'nanoid'
import needle from 'needle'

BigNumber.config({EXPONENTIAL_AT: [-7, 30]})

export default function notifyWhenCompleted(httpCallback, promise) {
  const taskId = nanoid()

  const onSuccess = result =>
    postToCallback(httpCallback, {
      taskId: taskId,
      success: true,
      error: null,
      payload: result,
    })

  const onError = err => {
    console.log(err.stack)
    return postToCallback(httpCallback, {
      taskId: taskId,
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
      payload: null,
    })
  }

  promise.then(onSuccess).catch(onError).catch(err => {
    console.error(`Failed to POST to callback ${httpCallback}: ${err.stack}`)
  })

  return taskId
}

function postToCallback(httpCallback, body) {
  return needle('post', httpCallback, body, {json: true})
}
