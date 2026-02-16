function lengthPrefixedBlob(version, parts) {
    console.log(`[lengthPrefixedBlob] version is ${version}`)
    let prefixed = [new Uint8Array([version])];

    for (const part of parts) {
        let length = part.byteLength;
        if (!length) {
            throw new Error("no part length")
        }
        if (part.length > 65535) {
            throw new Error("part is too long");
        }
        console.log(`[lengthPrefixedBlob] writing part of length ${length}`);
        prefixed.push(new Uint16Array([length]));
        prefixed.push(part);
    }

    return new Blob(prefixed);
}

function unwrapLengthPrefixed(buffer) {

    const view = new DataView(buffer);
    let offset = 0;

    // version (1 byte)
    const version = view.getUint8(offset);
    offset += 1;

    console.log(`[unwrapLengthPrefixed] version is ${version}`);

    const parts = [];

    while (offset < buffer.byteLength) {
        // read the 2-byte length prefix
        const partLength = view.getUint16(offset, true); // little endian
        offset += 2;
        console.log(`[unwrapLengthPrefixed] part of length ${partLength}`);

        // extract the part using subarray to avoid memory copying
        const part = new Uint8Array(buffer, offset, partLength);
        parts.push(part);

        // increment pointer by part length
        offset += partLength;
    }

    return { version, parts };
}


export async function genRSAKey(features=["encrypt", "decrypt"], exportable=false) {
    return await window.crypto.subtle.generateKey(
        {name:"RSA-OAEP", modulusLength:4096, publicExponent:new Uint8Array([0x01, 0x00, 0x01]), hash:"SHA-256"},
        exportable,
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

// gemini generated
export async function importFromPem(pem) {
    const b64 = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----|\s/g, "");
    const binaryDer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

    // not gemini generated
    return await window.crypto.subtle.importKey(
        "spki",
        binaryDer.buffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt", "wrapKey"]
    );
}


export async function RSAWrapRSAwithSym(wrapper_key, private_key) {
    const version = 1;

    const sym = await window.crypto.subtle.generateKey({name:"AES-GCM", length:256}, true, ["wrapKey"]);

    // wrap sym in wrapper key
    const sym_wrapped = await window.crypto.subtle.wrapKey("raw", sym, wrapper_key, {name:"RSA-OAEP"})


    const iv = window.crypto.getRandomValues(new Uint8Array(16));

    // wrap private in sym key
    const private_wrapped = await window.crypto.subtle.wrapKey(
        "pkcs8", private_key, sym, {name:"AES-GCM", iv: iv}
    );

    const combined = lengthPrefixedBlob(version, [sym_wrapped, iv, private_wrapped]);

    return combined;

}

export async function RSAunwrapRSAwithSym(wrapper_private, buffer) {

    const {version, parts} = unwrapLengthPrefixed(buffer);

    const [sym_wrapped, iv, private_wrapped ] = parts;



    const sym = await window.crypto.subtle.unwrapKey(
        "raw",
        sym_wrapped,
        wrapper_private,
        {name:"RSA-OAEP"},
        {name:"AES-GCM", length:256, iv: iv},
        false,
        ["unwrapKey"]
    )

    const pk = await window.crypto.subtle.unwrapKey(
        "pkcs8",
        private_wrapped,
        sym,
        {name:"AES-GCM", length:256, iv: iv},
        {name:"RSA-OAEP", hash:"SHA-256"},
        true,
        ["decrypt", "unwrapKey"]
    )

    return pk;
}
