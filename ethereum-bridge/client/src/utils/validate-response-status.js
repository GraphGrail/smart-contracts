import UserError from '../../../shared/errors'

export default function validateResponseStatus(resp) {
  if (resp.status >= 200 && resp.status < 300) {
    return resp
  }
  return resp.text().then(respText => {
    let err

    try {
      const errorData = JSON.parse(respText)
      message = errorData.message
      code = errorData.code
      if (code) {
        err = new UserError(message, code)
      }
    } catch (err) {}

    if (!err) {
      err = new Error(
        `unexpected status ${ resp.status } ${ resp.statusText }, response text: "${respText}"`
      )
    }

    err.status = resp.status
    err.statusText = resp.statusText
    err.responseText = respText

    return Promise.reject(err)
  })
}
