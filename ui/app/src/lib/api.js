const BASE_URI = '/api'

/**
 * @class APIResponse
 * @property {number} status_code - HTTP status code.
 * @property {boolean} success - Indicates if the api call was successful.
 * @property {Headers} headers - Response HTTP headers.
 * @property {Object|null} data - Success response body.
 * @property {Object|null} error - Error response body.
 */
class APIResponse {
  constructor(status, body, headers) {
    this.status_code = status
    this.success = body.success ?? status < 300
    this.headers = headers

    this.data = this.success ? body.data : null
    this.error = !this.success ? body.data : null
  }
}

const defaultOptions = {
  useSession: true,
}

async function _api(uri, method, body = undefined, options = {}) {
  body =
    method !== 'GET' && method !== 'HEAD' ? JSON.stringify(body) : undefined

  const authorization = localStorage.getItem("session_key");
  options = { ...defaultOptions, ...options }

  const headers = {
    'content-type': 'application/json',
  }

  if (authorization && options.useSession) {
    headers['authorization'] = authorization
  }

  const response = await fetch(`${BASE_URI}/${uri}`, {
    method: method,
    body: body,
    headers: headers,
  })

  if (response.status === 401 && options.useSession) {
    localStorage.removeItem('session');
  }

  try {
    return new APIResponse(response.status, await response.json(), response.headers)
  } catch (e) {
    console.error(`[API] Failed to parse response body for ${method} ${uri}:`, e)
    return new APIResponse(response.status, {}, response.headers)
  }
}

const API = {
  async GET(uri, options) {
    return await _api(uri, 'GET', undefined, options)
  },

  async PATCH(uri, body, options) {
    return await _api(uri, 'PATCH', body, options)
  },

  async POST(uri, body, options) {
    return await _api(uri, 'POST', body, options)
  },

  async DELETE(uri, body, options) {
    return await _api(uri, 'DELETE', body, options)
  },

  async PUT(uri, body, options) {
    return await _api(uri, 'PUT', body, options)
  },
}

export default API
