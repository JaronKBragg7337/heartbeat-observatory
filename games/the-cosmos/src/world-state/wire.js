// Lossless typed terrain on JSON transports (including Postgres jsonb).
const types = { Uint16Array, Float32Array, Uint8Array };
export function stringify(value) {
  return JSON.stringify(value, (_, v) => {
    if (ArrayBuffer.isView(v)) {
      const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
      let raw = ''; for (const b of bytes) raw += String.fromCharCode(b);
      return { $array: v.constructor.name, data: btoa(raw) };
    }
    return v;
  });
}
export function parse(text) {
  return JSON.parse(text, (_, v) => {
    if (v?.$array && types[v.$array]) {
      const bytes = Uint8Array.from(atob(v.data), c => c.charCodeAt(0));
      return new types[v.$array](bytes.buffer);
    }
    return v;
  });
}
