const KEYSTORE_VERSION = 2;

class KeyStore {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open("az7.chat", KEYSTORE_VERSION);
            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                const keyStore = db.createObjectStore("keys", { keyPath: "id" });
                keyStore.createIndex("by_id", "id", { unique: true });

                keyStore.transaction.oncomplete = () => {
                    console.log("[KeyStore] Object store created");
                    resolve(db);
                }

                keyStore.transaction.onerror = (event) => {
                    console.log("[KeyStore] Object store creation failed");
                    reject(event.target.error);
                }
                console.log("[KeyStore] Upgrading IndexedDB");
            };

            request.onsuccess = function(event) {
                console.log("[KeyStore] IndexedDB opened successfully");
                resolve(event.target.result);
            };
            request.onerror = function(event) {
                console.log("[KeyStore] IndexedDB open failed");
                reject(event.target.error);
            };
        });
    }

    async getKeys() {
        const db = await this.promise;

        return await new Promise((resolve, reject) => {
            const transaction = db.transaction("keys", "readonly").objectStore("keys").getAll()
            transaction.onsuccess = (event) => {
                resolve(event.target.result);
            };
            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
        
    }

    async putKey(key) {
        const db = await this.promise;


        return await new Promise((resolve, reject) => {
            const transaction = db.transaction("keys", "readwrite").objectStore("keys").put(key)
            transaction.onsuccess = (event) => {
                resolve(event.target.result);
            };
            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async genKey() {
        return {
            key: await window.crypto.subtle.generateKey(
                {name:"RSA-OAEP", modulusLength:4096, publicExponent:new Uint8Array([0x01, 0x00, 0x01]), hash:"SHA-256"},
                false,
                ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
            ),
            id: crypto.randomUUID()
        };
    }
}

window.keyStore = new KeyStore();
