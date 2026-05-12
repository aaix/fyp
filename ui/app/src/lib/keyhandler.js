import { B64toUint8Array, blobToB64 } from "./utils"

function lengthPrefixedBlob(version, parts) {
  let prefixed = [new Uint8Array([version])]

  for (const part of parts) {
    let length = part.byteLength
    if (!length) {
      throw new Error('no part length')
    }

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

// sym attachments can be large so must have a 32 bit prefix for big lengths
const SYM_ATTACHMENT_FORMAT_VERSION = 4

// use null to signify that meta is not present
const SYM_ATTACHMENT_META_ABSENT = 0x00

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
  if (buff.byteLength < 1) {
    throw new RangeError('Empty buff');
  }

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

function decodeAttachmentMetaPart(part) {
  const u8 = partToU8(part)
  if (u8.byteLength === 1 && u8[0] === SYM_ATTACHMENT_META_ABSENT) {
    return null
  }
  return new TextDecoder().decode(u8)
}

/**
 * AES-GCM encrypt messsage attachments
 * - 2 parts: iv + ciphertext only (same as v3)
 * - 3 parts: iv + ciphertext + content-type
 * - 4 parts: iv + ciphertext + content-type or null + file-name or null
 * @param {string | null} [content_type=null]
 * @param {string | null} [file_name=null]
 */
export async function encryptSymAttachment(key, plaintext, content_type = null, file_name = null) {
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
  const enc = new TextEncoder()
  const hasCt = content_type != null && String(content_type).length > 0
  const hasFn = file_name != null && String(file_name).length > 0

  const parts = [iv, ciphertext]
  if (!hasCt && !hasFn) {
    return lengthPrefixedBlobU32(SYM_ATTACHMENT_FORMAT_VERSION, parts)
  }
  if (hasCt && !hasFn) {
    parts.push(enc.encode(content_type))
    return lengthPrefixedBlobU32(SYM_ATTACHMENT_FORMAT_VERSION, parts)
  }
  if (!hasCt && hasFn) {
    parts.push(new Uint8Array([SYM_ATTACHMENT_META_ABSENT]), enc.encode(file_name))
    return lengthPrefixedBlobU32(SYM_ATTACHMENT_FORMAT_VERSION, parts)
  }
  parts.push(enc.encode(content_type), enc.encode(file_name))
  return lengthPrefixedBlobU32(SYM_ATTACHMENT_FORMAT_VERSION, parts)
}

/**
 * Decrypt attachment ciphertext from cloud using v4 or v3 and v1 format
 * @returns {Promise<{ plaintext: ArrayBuffer, contentType: string | null, fileName: string | null }>}
 */
export async function decryptSymAttachment(buff, key) {
  if (!buff || buff.byteLength < 1) {
    throw new RangeError('Empty encrypted attachment')
  }
  const wireVersion = new DataView(buff).getUint8(0)
  if (wireVersion === SYM_ATTACHMENT_FORMAT_VERSION) {
    const { parts } = unwrapLengthPrefixedU32(buff)
    if (parts.length < 2) {
      throw new RangeError('Malformed encrypted attachment')
    }
    const [iv, ciphertext] = parts
    const plaintext = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        length: 256,
        iv,
        additionalData: iv,
      },
      key,
      ciphertext,
    )
    let contentType = null
    let fileName = null
    if (parts.length === 3) {
      contentType = decodeAttachmentMetaPart(parts[2])
    } else if (parts.length === 4) {
      contentType = decodeAttachmentMetaPart(parts[2])
      fileName = decodeAttachmentMetaPart(parts[3])
    } else if (parts.length > 4) {
      throw new RangeError('Malformed encrypted attachment: too many parts')
    }
    return { plaintext, contentType, fileName }
  }
  if (wireVersion === 3) {
    const { parts } = unwrapLengthPrefixedU32(buff)
    const [iv, ciphertext] = parts
    const plaintext = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        length: 256,
        iv,
        additionalData: iv,
      },
      key,
      ciphertext,
    )
    return { plaintext, contentType: null, fileName: null }
  }
  if (wireVersion === 1) {
    const plaintext = await decryptSym(buff, key)
    return { plaintext, contentType: null, fileName: null }
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