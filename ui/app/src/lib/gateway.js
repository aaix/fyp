import { decryptB64, digestOf, exportAsPem, importFromPem, RSAWrapRSAwithSym } from "./keyhandler";
import { getCurrentSession } from "./session";
import { keyStore } from "./session";
import { B64toUint8Array, blobToB64, hexFromBuffer } from "./utils";

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
        this.adding_new_device = false;
        this.client_seq = 0;
        this.server_seq = 0;
        socket.addEventListener("close", (event) => {
            this.onClose(event);
        })
        socket.addEventListener("message", (event) => {
            this.onMessage(event);
        })
        
    }

    async reconnect() {
        this.socket.close()
        await new Promise((resolve) => {
            const socket = new WebSocket(GATEWAY_URL);
            socket.addEventListener("open", () => {
                this.socket = socket;
                this.handshake_complete = false;
                this.handshake_started = false;
                socket.addEventListener("message", (event) => {
                    this.onMessage(event);
                })
                resolve();
            })
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
        if (this.errCallback) {
            this.errCallback(e);
        }

        if (e.code == 4003 || e.code == 4005) { // handshake failed or unauthorized
            getCurrentSession().clearSession();
        }
        await this.reconnect();
    }

    async handshake(newdeviceok) {
        if (!newdeviceok && (this.handshake_complete || this.handshake_started)) {
            return
        }

        this.handshake_started = true;
        const session = getCurrentSession();
        let user_id;
        if (newdeviceok) {
            user_id = newdeviceok.user_id;
        } else {
            user_id = session.user_id;
        }
        this.user_id = user_id;
        const device_id = (await keyStore.getDefaultKey()).device_id;
        const clientHello = {
            op:"client_hello",
            user_id,
            device_id: device_id,
        }
        await this.send(clientHello);
    }

    async handler_server_hello(msg) {
        const accKey = (await getCurrentSession().getAccountKey(this.user_id)).privateKey;
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

    async start_new_device_handshake(username, deviceName, otCallback, errCallback, successCallback) {
        if (!username || !deviceName || !otCallback || !errCallback || !successCallback) {
            throw new Error("Insufficient parameters")
        }

        if (this.handshake_complete || this.handshake_started) {
            throw new Error("A handshake has already been started");
        }
        this.handshake_started = true;
        this.newDeviceOTCallback = otCallback;
        this.newDeviceSuccessCallback = successCallback;
        this.errCallback = errCallback;

        const deviceKey = (await keyStore.getDefaultKey()).key;

        const newDeviceHello = {
            op: "new_device_hello",
            username: username,
            device_name: deviceName,
            device_public_key: await exportAsPem(deviceKey.publicKey)
        }

        await this.send(newDeviceHello);

    }

    async handler_new_device_server_hello(msg) {
        const oneTimeCode = msg.code;

        const deviceKey = (await keyStore.getDefaultKey()).key;
        const device_public_key_pem = (await exportAsPem(deviceKey.publicKey)).trim();


        const pub_digest = await digestOf(new TextEncoder().encode(device_public_key_pem).buffer);
        const pub_digest_hex = await hexFromBuffer(pub_digest);

        this.newDeviceOTCallback(oneTimeCode, pub_digest_hex);

    }

    async handler_new_device_ok(msg) {
        if (this.adding_new_device === true) {
            // we are the registering device
            this.registerSuccessCallback(msg.device_name);
            return;
        }
        // we are making a new device

        const currentKey = await keyStore.getDefaultKey();
        await keyStore.putKey({ ...currentKey, device_id: msg.device_id });
        this.newDeviceSuccessCallback();

        await this.handshake(msg);
    }

    async register_new_device(code, confirmCallback, errorCallback, successCallback) {

        this.adding_new_device = true;

        this.registerConfirmCallback = confirmCallback;
        this.registerErrorCallback = errorCallback;
        this.registerSuccessCallback = successCallback;

        const selectdeviceintention = {
            op: "select_device_intention",
            code,
        }
        await this.send(selectdeviceintention)
    }

    async handler_add_device_request(msg) {
        const device_name = msg.device_name;
        const device_public_key_pem = msg.device_public_key.trim();
        const pub_digest = await digestOf(new TextEncoder().encode(device_public_key_pem).buffer);
        const pub_digest_hex = await hexFromBuffer(pub_digest);

        const device_public_key = await importFromPem(device_public_key_pem);


        const confirmed = await this.registerConfirmCallback({
            device_name,
            digest: pub_digest_hex,
        });

        if (!confirmed) {
            this.adding_new_device = false;
            return await this.send({op:"select_device_cancel"})
        }

        const account_private_key = await getCurrentSession().doAccountKeyHandshake(null, true);

        const encrypted_account_key = await blobToB64(
            await RSAWrapRSAwithSym(device_public_key, account_private_key)
        );

        const adddeviceok = {
            op: "add_device_ok",
            encrypted_account_key,
        }

        await this.send(adddeviceok);
                
    }

    async handler_select_device_intention_failure(msg) {
        if (msg.failure_type == "not_found") {
            this.registerErrorCallback("Code does not match")
        } else if (msg.failure_type == "device_limit_reached") {
            this.registerErrorCallback("User already has too many devices")
        } else {
            this.registerErrorCallback("Unknown error occured")
        }
    }


    async handler_event(msg) {
        const event = msg.d;
        console.log(`[Gateway] Recieved event intent ${event.intent}`)
    }
}