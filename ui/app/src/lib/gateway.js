import { decryptB64 } from "./keyhandler";
import { getCurrentSession } from "./session";
import { keyStore } from "./session";
import { B64toUint8Array, blobToB64 } from "./utils";

const GATEWAY_URL = "/gateway";


export function gatewayFactory() {
    if (gatewayFactory._gatewayPromise !== undefined) {
        return gatewayFactory._gatewayPromise;
    }
    gatewayFactory._gatewayPromise = new Promise((resolve, reject) => {
        let socket = new WebSocket(GATEWAY_URL);

        socket.addEventListener("open", () => {
            resolve(new Gateway(socket))
        })

    })
    return gatewayFactory._gatewayPromise;
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
        this.handshake_complete = false;
        this.handshake_started = false;
        this.client_seq = 0;
        this.server_seq = 0;
        socket.addEventListener("close", (event) => {
            this.onClose(event);
        })
        socket.addEventListener("message", (event) => {
            this.onMessage(event);
        })
        
    }

    async send(data) {
        data.seq = ++this.client_seq;
        data.ack = this.server_seq;
        this.socket.send(JSON.stringify(data))
        
    }

    async onMessage(e) {
        const msg = JSON.parse(e.data);
        console.log(msg);
        const op = msg.op;
        this.server_seq = msg.seq;

        this[`handler_${op}`](msg);
    }

    async onClose(e) {
        console.log(`[Gateway] closed with ${e.code}: ${e.reason}`)
    }

    async handshake() {
        if (this.handshake_complete || this.handshake_started) {
            return
        }

        this.handshake_started = true;
        const session = getCurrentSession();
        const device_id = (await keyStore.getDefaultKey()).device_id;
        const clientHello = {
            op:"client_hello",
            user_id: session.user_id,
            device_id: device_id,
        }
        await this.send(clientHello);
    }

    async handler_server_hello(msg) {
        const accKey = (await getCurrentSession().getAccountKey()).privateKey;
        const deviceKey = (await keyStore.getDefaultKey()).key.privateKey;


        const [acc_sign, device_sign] = await Promise.all([
            decryptB64(msg.account_challenge, accKey),
            decryptB64(msg.device_challenge, deviceKey),
        ]);

        const clientAuth = {
            op: "client_auth",
            solved_device_challenge: await blobToB64(new Blob([device_sign])),
            solved_account_challenge: await blobToB64(new Blob([acc_sign])),
        }

        await this.send(clientAuth);

    }

    async handler_session_complete(msg) {
        this.handshake_complete = true;
    }

    async handler_event(msg) {
        const event = msg.d;
        console.log(`[Gateway] Recieved event intent ${event.intent}`)
    }
}