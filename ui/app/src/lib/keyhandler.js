import { B64toUint8Array, blobToB64 } from "./utils"

function lengthPrefixedBlob(version, parts) {
  let prefixed = [new Uint8Array([version])]

  for (const part of parts) {
    let length = part.byteLength
    if (!length) {
      throw new Error('no part length')
    }
    if (part.length > 65535) {
      throw new Error('part is too long')
    }
    prefixed.push(new Uint16Array([length]))
    prefixed.push(part)
  }

  return new Blob(prefixed)
}

function unwrapLengthPrefixed(buffer) {
  const view = new DataView(buffer)
  let offset = 0

  const version = view.getUint8(offset)
  offset += 1

  const parts = []

  while (offset < buffer.byteLength) {
    const partLength = view.getUint16(offset, true);
    offset += 2
    const part = new Uint8Array(buffer, offset, partLength);
    // slice so that we dont end up with the same shared buffer
    parts.push(part.slice().buffer)
    offset += partLength
  }

  return { version, parts }
}

export async function genRSAKey(
  features = ['encrypt', 'decrypt'],
  exportable = false
) {
  return await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-256',
    },
    exportable,
    features
  )
}

export async function decryptB64(encrypted_b64, key) {
  const encrypted = Uint8Array.from(atob(encrypted_b64), (c) => c.charCodeAt(0))
  return await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, encrypted)
}

export async function encryptSymB64(plaintext, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(16))
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      length:256,
      iv: iv,
      additionalData: iv
    },
    key,
    plaintext,
  );
  const parts = lengthPrefixedBlob(1, [iv, ciphertext]);
  return await blobToB64(parts);
}

export async function decryptB64Sym(encrypted_b64, key) {
  const buff = await B64toUint8Array(encrypted_b64);
  const {parts} = unwrapLengthPrefixed(buff.buffer);

  const [iv, ciphertext] = parts;
  return await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      length:256,
      iv: iv,
      additionalData: iv,
    },
    key,
    ciphertext,
  )
}

export async function exportAsPem(key) {
  const spki = await window.crypto.subtle.exportKey('spki', key)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)))
  const pem = `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`
  return pem
}

export async function importFromPem(pem) {
  const b64 = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----|\s/g, '')
  const binaryDer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

  return await window.crypto.subtle.importKey(
    'spki',
    binaryDer.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt', 'wrapKey']
  )
}

export async function genSymKey(extractable = false) {
  return await window.crypto.subtle.generateKey(
    {name: 'AES-GCM', length: 256},
    extractable,
    ['encrypt', 'decrypt']
  )
}


export async function RSAWrapSym(pub_wrapper_key, sym_private_key) {
  const wrapped = await window.crypto.subtle.wrapKey(
    'raw',
    sym_private_key,
    pub_wrapper_key,
    { name: 'RSA-OAEP'}
  );

  return wrapped;
}

export async function RSAUnwrapSym(private_wrapper_key, ciphertext, extractable=false) {
  const unwrapped = await window.crypto.subtle.unwrapKey(
    'raw',
    ciphertext,
    private_wrapper_key,
    {name: 'RSA-OAEP'},
    {name: 'AES-GCM', length: 256},
    extractable,
    ['encrypt', 'decrypt']
  );

  return unwrapped;
}


export async function RSAWrapRSAwithSym(wrapper_key, private_key) {

  const sym = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['wrapKey']
  )

  const sym_wrapped = await window.crypto.subtle.wrapKey(
    'raw',
    sym,
    wrapper_key,
    { name: 'RSA-OAEP' }
  )

  const iv = window.crypto.getRandomValues(new Uint8Array(16))

  const private_wrapped = await window.crypto.subtle.wrapKey(
    'pkcs8',
    private_key,
    sym,
    { name: 'AES-GCM', iv: iv, additionalData: iv}
  )

  const combined = lengthPrefixedBlob(2, [
    sym_wrapped,
    iv,
    private_wrapped,
  ])

  return combined
}

export async function RSAunwrapRSAwithSym(wrapper_private, buffer, extractable = false) {
  const { version, parts } = unwrapLengthPrefixed(buffer);

  const [sym_wrapped, iv, private_wrapped] = parts

  const sym = await window.crypto.subtle.unwrapKey(
    'raw',
    sym_wrapped,
    wrapper_private,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256, iv: iv},
    false,
    ['unwrapKey']
  )

  let algo;
  if (version > 1) {
    algo = { name: 'AES-GCM', length: 256, iv: iv, additionalData: iv};
  } else {
    algo = { name: 'AES-GCM', length: 256, iv: iv }
  }


  const pk = await window.crypto.subtle.unwrapKey(
    'pkcs8',
    private_wrapped,
    sym,
    algo,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    extractable,
    ['decrypt', 'unwrapKey']
  )

  return pk
}

export async function digestOf(buffer) {
  return await crypto.subtle.digest(
    "SHA-256",
    buffer
  )
}