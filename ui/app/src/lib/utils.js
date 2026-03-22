let PUBLIC_BASE = "https://userpublic.az7.chat";
let PRIVATE_BASE = "https://userprivate.az7.chat";

if (window.location.hostname == "127.0.0.1") {
  PUBLIC_BASE = "https://userpublic.dev.az7.chat";
  PRIVATE_BASE = "https://userprivate.dev.az7.chat";
} else {}



export async function blobToB64(blob) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

  return dataUrl.split(',', 2)[1] // remove the content type prefix
}

export async function B64toUint8Array(b64_string) {
  return Uint8Array.from(atob(b64_string), (c) => c.charCodeAt(0))
}

export async function hexFromBuffer(buffer) {
  return [...new Uint8Array(buffer)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}


export function timeFromUUIDv1(uuid) {

  const UUID_EPOCH = Date.UTC(1582, 9, 15);

  const hex = uuid.replace(/-/g, '');
  const timeLow = parseInt(hex.slice(0, 8), 16);
  const timeMid = parseInt(hex.slice(8, 12), 16);
  const timeHigh = parseInt(hex.slice(12, 16), 16) & 0x0fff; // clear version bits
  
  const timestamp = (BigInt(timeHigh) << 48n) | (BigInt(timeMid) << 32n) | BigInt(timeLow);
  const unixTimestamp = Number(timestamp / 10000n) + UUID_EPOCH;


  return new Date(unixTimestamp);
}

export function userContentUrl(is_public, bucket, asset_id) {
  let base;
  if (is_public) {
    base = PUBLIC_BASE;
  } else {
    base = PRIVATE_BASE;
  }
  return `${base}/${bucket}/${asset_id}`
}

export function getAvatarUrl(user) {
  if (!user.avatar_asset_id) {
    return getDefaultAvatarUrl(user.user_id);
  }

  return userContentUrl(true, user.user_id, user.avatar_asset_id);

}

// from stack overflow
function hashCode(str) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        let chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}



export function getDefaultAvatarUrl(user_id) {
  let v = Math.abs(hashCode(user_id)) % 4;

  return `/icon${v}.png`
}

export function getDefaultChannelUrl(channel_id) {
  let v = Math.abs(hashCode(channel_id)) % 4;

  return `/icon${v}.png`
}
