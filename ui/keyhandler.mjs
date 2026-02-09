

export async function genRSAKey(features=["encrypt", "decrypt"]) {
    return await window.crypto.subtle.generateKey(
        {name:"RSA-OAEP", modulusLength:4096, publicExponent:new Uint8Array([0x01, 0x00, 0x01]), hash:"SHA-256"},
        false,
        features
    );
}

export async function decryptB64(encrypted_b64, key) {
    const encrypted = Uint8Array.from(atob(encrypted_b64), c => c.charCodeAt(0));
    return await window.crypto.subtle.decrypt({name:"RSA-OAEP"}, key, encrypted);
}

// generated with copilot
export async function exportAsPem(key) {
    const spki = await window.crypto.subtle.exportKey("spki", key);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
    const pem = `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----`;
    return pem;
}