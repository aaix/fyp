export async function blobToB64(blob) {
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    return dataUrl.split(',', 2)[1]; // remove the content type prefix
};


export async function B64toUint8Array(b64_string) {
    return Uint8Array.from(atob(b64_string), c => c.charCodeAt(0));
}