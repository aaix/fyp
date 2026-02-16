//const BASE_URI = "http://172.31.0.20:8000";
const BASE_URI = "/api";



/**
 * @class APIResponse
 *
 * @property {number} status_code - HTTP status code.
 * @property {boolean} success - Indicates if the api call was successful.
 * @property {Headers} headers - Response HTTP headers.
 * @property {Object|null} data - Success response body.
 * @property {Object|null} error - Error response body.
 */
class APIResponse {
    constructor(status, body, headers) {
        this.status_code = status;
        this.success = body.success ?? status < 300;
        this.headers = headers

        this.data = this.success ? body.data : null;
        this.error = !this.success ? body : null;
    }
}

const defaultOptions = {
    useSession: true,
}


async function _api (uri, method, body=undefined, options={}) {

    body = (method != "GET" && method != "HEAD") ?  JSON.stringify(body) : undefined;

    const authorization = localStorage.getItem("session");
    const options = {...defaultOptions, ...options};

    const headers = {
        "content-type":"application/json"
    };

    if (authorization && options.useSession) {
        headers["authorization"] = authorization;
    };

    const response = await fetch(
        `${BASE_URI}/${uri}`,
        {
            method:method,
            body: body,
            headers: headers
        }
    )

    try {
        return new APIResponse(response.status, await response.json(), response.headers);
    } catch (e) {
        return new APIResponse(response.status, await response.text(), response.headers);
    }

}


const API = {
    async GET(uri) {
        return await _api(uri, "GET", undefined);
    },

    async PATCH(uri, body) {
        return await _api(uri, "PATCH", body);
    },

    async POST(uri, body) {
        return await _api(uri, "POST", body);
    },

    async DELETE(uri, body) {
        return await _api(uri, "DELETE", body);
    },

    async PUT(uri, body) {
        return await _api(uri, "PUT", body);
    },
}

export default API;