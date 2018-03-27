import Pino from 'pino'
const pino = Pino()

import BigNumber from 'bignumber.js'
import nanoid from 'nanoid'

import request from 'superagent'
import verboseErrors from 'superagent-verbose-errors'

BigNumber.config({EXPONENTIAL_AT: [-7, 30]})

function requestLogger(taskId) {
  return (request) => {
    pino.info({taskId, request}, 'outgoing request')
    return request
  }
}

function logResponseData(resp, taskId) {
  const logData = {
    type: resp.type,
    charset: resp.charset,
    statusCode: resp.statusCode,
    headers: resp.headers,
    body: resp.body,
    taskId: taskId,
  }
  pino.info(logData, 'response to outgoing request')
}

function logErrorData(err, taskId) {
  const response = err.response
  const logData = {
    type: response.type,
    charset: response.charset,
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
    text: response.text,
    error: response.error,
    taskId: taskId,
  }
  pino.error(err, logData, 'outgoing request failed')
}

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
    pino.error(err, {taskId}, 'task failed')
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

  promise.then(onSuccess).catch(onError)

  return taskId
}

function postToCallback(httpCallback, body) {
  const taskId = body.taskId
  return request
    .post(httpCallback)
    .set('Content-Type', 'application/json')
    .send(body)
    .use(verboseErrors)
    .use(requestLogger(body.taskId))
    .then((resp) => {
      logResponseData(resp, taskId)
    })
    .catch(err => {
      logErrorData(err, taskId)
    })
}
