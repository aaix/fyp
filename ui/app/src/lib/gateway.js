const GATEWAY_URL = "/gateway";


export function gatewayFactory() {
    new Promise((resolve, reject) => {
        let socket = new WebSocket(GATEWAY_URL);

        socket.addEventListener("open", () => {
            resolve(new Gateway(socket))
        })

    })
}
 
/**
 * Gateway class for managing WebSocket communication.
 * Handles incoming messages from a WebSocket connection.
 * 
 * @class Gateway
 * @param {WebSocket} socket - The WebSocket instance to manage
 */
class Gateway {
    constructor(socket) {
        this.socket = socket;
        this.client_seq = 0;
        this.server_seq = 0;
        socket.addEventListener("message", (event) => {
            this.onMessage(e)
        })
        
    }

    async onMessage(e) {
        const msg = JSON.parse(data);
        console.log(msg);
        const op = msg.op;
        this.server_seq = msg.seq;

        this[`handler_${op}`](msg);
    }
}