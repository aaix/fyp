const KEYSTORE_VERSION = 2

import {
  genRSAKey,
  decryptB64,
  exportAsPem,
  RSAWrapRSAwithSym,
  RSAunwrapRSAwithSym,
  importFromPem,
} from './keyhandler.js'
import API from './api.js'
import { blobToB64, B64toUint8Array } from './utils.js'

class KeyStore {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open('az7.chat', KEYSTORE_VERSION)
      request.onupgradeneeded = function (event) {
        const db = event.target.result
        const keyStore = db.createObjectStore('keys', { keyPath: 'id' })
        keyStore.createIndex('by_id', 'id', { unique: true })

        keyStore.transaction.oncomplete = () => {
          resolve(db)
        }

        keyStore.transaction.onerror = (event) => {
          reject(event.target.error)
        }
      }

      request.onsuccess = function (event) {
        resolve(event.target.result)
      }
      request.onerror = function (event) {
        reject(event.target.error)
      }
    })
  }

  async getKeys() {
    const db = await this.promise

    return await new Promise((resolve, reject) => {
      const transaction = db
        .transaction('keys', 'readonly')
        .objectStore('keys')
        .getAll()
      transaction.onsuccess = (event) => {
        resolve(event.target.result)
      }
      transaction.onerror = (event) => {
        reject(event.target.error)
      }
    })
  }

  async putKey(key) {
    const db = await this.promise

    return await new Promise((resolve, reject) => {
      const transaction = db
        .transaction('keys', 'readwrite')
        .objectStore('keys')
        .put(key)
      transaction.onsuccess = (event) => {
        resolve(event.target.result)
      }
      transaction.onerror = (event) => {
        reject(event.target.error)
      }
    })
  }

  async genKey() {
    return {
      key: await genRSAKey([
        'encrypt',
        'decrypt',
        'wrapKey',
        'unwrapKey',
      ]),
      id: crypto.randomUUID(),
      device_id: null,
    }
  }

  async getDefaultKey() {
    let key = (await this.getKeys())[0]
    if (key) {
      return key
    }
    key = await this.genKey()
    await this.putKey(key)

    return key
  }
}

export const keyStore = new KeyStore()



export class Session {
  constructor() {
    this.session_key = localStorage.getItem("session_key");
    this.user_id = localStorage.getItem("user_id");
    this.accKey = null;
    
  }

  clearSession() {
    console.error(`[Session] clearing session`);
    this.session_key = null;
    this.user_id = null;
    localStorage.removeItem("session_key");
    localStorage.removeItem("user_id");
  }


  async setMyAvatar(data) {
    let form = new FormData();
    form.append('icon', data);

    return await API.PUT("account/@me/icon", form, {useForm : true})
  }

  
  async doAccountKeyHandshake(username_or_id, extractable = false) {
    // if extractable is set then an extractable key is returned 
    let resolve;
    this._handshaking = new Promise((r) => resolve=r);
    const device_key = await keyStore.getDefaultKey()
    const device_id = device_key.device_id

    if (!device_id) {
      resolve();
      throw new Error("This device is not tied to any account");
    }


    if (!username_or_id && !this.user_id) {
      resolve();
      throw new Error("Unable to determine user for handshake")
    }

    const user_identifier = username_or_id ?? this.user_id;

    const res = await API.GET(
      `account/devicehandshake/${user_identifier}/${device_id}`,
      {useSession: false}
    )

    if (!res.success) {
      resolve();
      return res.error
    }
    const encrypted_account_key = res.data.encrypted_account_key
    const public_key = await importFromPem(res.data.account_public_key)

    const key = await RSAunwrapRSAwithSym(
      device_key.key.privateKey,
      (await B64toUint8Array(encrypted_account_key)).buffer,
      extractable
    )

    if (extractable) {
      return key
    }
    

    this.accKey = { privateKey: key, publicKey: public_key }
    resolve();
  }

  getAccountKey() {
    if (!this.accKeyPromise) {
      this.accKeyPromise = new Promise((resolve, reject) => {this._getAccountKey().then(resolve).catch(reject)})
    }
    return this.accKeyPromise;
    
  }
  
  async _getAccountKey() {
    if (this.accKey === null) {
      await this.doAccountKeyHandshake();
    }
    return this.accKey;
  }

  async login(username) {
    const key = await this.getAccountKey();
    if (!key) {
      throw new Error('Account key handshake incomplete')
    }

    this.clearSession();

    const res = await API.POST('session/login', { username }, {useSession: false})

    if (!res.success) {
      return res.error.code
    }

    const encrypted_session = res.data.encrypted_session

    const decrypted_session = await decryptB64(
      encrypted_session,
      key.privateKey
    )
    const session_str = new TextDecoder().decode(decrypted_session)

    localStorage.setItem('session_key', session_str);
    localStorage.setItem('user_id', res.data.user_id);
    this.user_id = res.data.user_id;
    return true
  }

  async signup(username, email) {
    this.clearSession();

    const device_key = await keyStore.getDefaultKey()

    const account_key = await genRSAKey(
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
      true
    )

    const encrypted_account_key = await blobToB64(
      await RSAWrapRSAwithSym(device_key.key.publicKey, account_key.privateKey)
    )

    const dpk = await exportAsPem(device_key.key.publicKey)
    const apk = await exportAsPem(account_key.publicKey)

    const res = await API.POST('account/signup', {
      username,
      email,
      account_public_key: apk,
      device: {
        name: 'device1',
        public_key: dpk,
        encrypted_private_key: encrypted_account_key,
      },
    })

    if (!res.success) {
      return res.error
    }

    const device_id = res.data.device.device_id
    keyStore.putKey({ ...device_key, device_id })

    return res
  }

  async getCurrentAccount() {
    return await API.GET("account/@me");
  }
}


export class DeviceManager {
  async getDevices() {
    const res = await API.GET("account/devices");

    return res;


  }

  async deleteDevice(device_id) {
    const res = await API.DELETE(`account/device/${device_id}`);
    
    return res;
  }

  async updateDevice(device_id, device_name) {
    const res = await API.PATCH(`account/device/${device_id}`, {device_name: device_name});

    return res;
  }
}

export function getCurrentSession() {
  return _session;
}

let _session = new Session();
