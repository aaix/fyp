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
  async doAccountKeyHandshake(username) {
    const device_key = await keyStore.getDefaultKey()
    const device_id = device_key.device_id

    if (!device_id || !username) {
      throw new Error('Insufficient params for handshake')
    }

    const res = await API.GET(
      `account/devicehandshake/${username}/${device_id}`
    )

    if (!res.success) {
      return res.error
    }
    const encrypted_account_key = res.data.encrypted_account_key
    const public_key = await importFromPem(res.data.account_public_key)

    const key = await RSAunwrapRSAwithSym(
      device_key.key.privateKey,
      (await B64toUint8Array(encrypted_account_key)).buffer
    )

    this.accKey = { privateKey: key, publicKey: public_key }
  }

  async login(username) {
    const key = this.accKey
    if (!key) {
      throw new Error('Account key handshake incomplete')
    }

    localStorage.removeItem('session')

    const res = await API.POST('session/login', { username })

    if (!res.success) {
      return res.error.code
    }

    const encrypted_session = res.data.encrypted_session

    const decrypted_session = await decryptB64(
      encrypted_session,
      key.privateKey
    )
    const session_str = new TextDecoder().decode(decrypted_session)

    localStorage.setItem('session', session_str)
    return true
  }

  async signup(username, email) {
    localStorage.removeItem('session')

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
}
