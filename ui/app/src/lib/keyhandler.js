import { B64toUint8Array, blobToB64 } from "./utils"

function lengthPrefixedBlob(version, parts) {
  let prefixed = [new Uint8Array([version])]

  for (const part of parts) {
    let length = part.byteLength
    if (!length) {
      throw new Error('no part length')
    }
    // Use byteLength: ArrayBuffer (e.g. from subtle.encrypt) has no .length — skipping this
    // check used to wrap lengths in Uint16 and corrupt payloads > 64KiB.
    if (part.byteLength > 65535) {
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
    if (partLength < 1 || offset + partLength > buffer.byteLength) {
      throw new RangeError('Malformed encrypted payload')
    }
    const part = new Uint8Array(buffer, offset, partLength);
    // slice so that we dont end up with the same shared buffer
    parts.push(part.slice().buffer)
    offset += partLength
  }

  return { version, parts }
}

/** Wire format version for channel attachments (Uint32 lengths; supports large ciphertext). */
const SYM_ATTACHMENT_FORMAT_VERSION = 3

function partToU8(part) {
  if (part instanceof ArrayBuffer) return new Uint8Array(part)
  return new Uint8Array(part.buffer, part.byteOffset, part.byteLength)
}

function lengthPrefixedBlobU32(version, parts) {
  const chunks = [new Uint8Array([version])]
  for (const part of parts) {
    const len = part.byteLength
    if (!len) {
      throw new Error('no part length')
    }
    if (len > 0xffffffff) {
      throw new Error('part is too long')
    }
    const le = new Uint8Array(4)
    new DataView(le.buffer).setUint32(0, len, true)
    chunks.push(le)
    chunks.push(partToU8(part))
  }
  return new Blob(chunks)
}

function unwrapLengthPrefixedU32(buffer) {
  const view = new DataView(buffer)
  let offset = 0
  const version = view.getUint8(offset)
  offset += 1
  const parts = []
  while (offset < buffer.byteLength) {
    const partLength = view.getUint32(offset, true)
    offset += 4
    if (partLength < 1 || offset + partLength > buffer.byteLength) {
      throw new RangeError('Malformed encrypted attachment')
    }
    const part = new Uint8Array(buffer, offset, partLength)
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

/**
 * 
 * @param {ArrayBuffer} plaintext 
 * @param {CryptoKey} key 
 * @returns {Promise<string>}
 */
export async function encryptSymB64(plaintext, key) {
  const parts = await encryptSym(plaintext, key);
  return await blobToB64(parts);
}

/**
 * 
 * @param {ArrayBuffer} plaintext 
 * @param {CryptoKey} key 
 * @returns {Promise<Blob>}
 */
export async function encryptSym(plaintext, key) {
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
  return parts;
}

/**
 * 
 * @param {string} encrypted_b64 
 * @param {CryptoKey} key 
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptB64Sym(encrypted_b64, key) {
  const buff = await B64toUint8Array(encrypted_b64);
  return await decryptSym(buff.buffer, key)
}

/**
 * 
 * @param {ArrayBuffer} buff 
 * @param {CryptoKey} key 
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptSym(buff, key) {
  const {parts} = unwrapLengthPrefixed(buff);

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

/**
 * AES-GCM encrypt for channel attachments; uses 32-bit part lengths (format v3) so payloads
 * can exceed 64KiB. Use only for attachment upload; not for message `content` blobs.
 */
export async function encryptSymAttachment(plaintext, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(16))
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      length: 256,
      iv,
      additionalData: iv,
    },
    key,
    plaintext,
  )
  return lengthPrefixedBlobU32(SYM_ATTACHMENT_FORMAT_VERSION, [iv, ciphertext])
}

/**
 * Decrypt attachment ciphertext from S3. Supports format v3 (Uint32 lengths) and v1
 * (Uint16, legacy small attachments).
 */
export async function decryptSymAttachment(buff, key) {
  if (!buff || buff.byteLength < 1) {
    throw new RangeError('Empty encrypted attachment')
  }
  const wireVersion = new DataView(buff).getUint8(0)
  if (wireVersion === SYM_ATTACHMENT_FORMAT_VERSION) {
    const { parts } = unwrapLengthPrefixedU32(buff)
    const [iv, ciphertext] = parts
    return await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        length: 256,
        iv,
        additionalData: iv,
      },
      key,
      ciphertext,
    )
  }
  if (wireVersion === 1) {
    return decryptSym(buff, key)
  }
  throw new Error(`Unknown attachment crypto format (${wireVersion})`)
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