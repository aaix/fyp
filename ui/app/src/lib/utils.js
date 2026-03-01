const USER_CONTENT_BASE = "https://usercontent.az7.chat"

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

export function userContentUrl(bucket, asset_id, extension) {
  return `${USER_CONTENT_BASE}/${bucket}/${asset_id}.${extension}`
}

export function getAvatarUrl(user) {
  if (!user.avatar_asset_id) {
    return getDefaultAvatarUrl(user.user_id);
  }

  return userContentUrl(user.user_id, user.avatar_asset_id, "webp");

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
  let v = hashCode(user_id) % 4;

  return `/icon${v}.png`
}
