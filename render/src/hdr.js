// hb-render: Radiance .hdr (RGBE) loader + environment importance-sampling tables.
// Pure JS, no dependencies.

export function parseHDR(buffer) {
  const bytes = new Uint8Array(buffer);
  let pos = 0;
  const readLine = () => {
    let s = '';
    while (pos < bytes.length) {
      const c = bytes[pos++];
      if (c === 10) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const magic = readLine();
  if (!magic.startsWith('#?')) throw new Error('not a Radiance HDR file');
  let line;
  while ((line = readLine()) !== '') {
    if (line.startsWith('FORMAT=') && !line.includes('32-bit_rle_rgbe')) throw new Error('unsupported HDR format ' + line);
  }
  const res = readLine().trim().split(/\s+/);
  // typical: -Y H +X W
  let width, height, flipY = false;
  if (res[0] === '-Y') { height = +res[1]; width = +res[3]; }
  else if (res[0] === '+Y') { height = +res[1]; width = +res[3]; flipY = true; }
  else throw new Error('unsupported HDR orientation ' + res.join(' '));

  const data = new Float32Array(width * height * 4);
  const scan = new Uint8Array(width * 4);
  for (let y = 0; y < height; y++) {
    // new RLE?
    if (width >= 8 && width < 32768 && bytes[pos] === 2 && bytes[pos + 1] === 2 && ((bytes[pos + 2] << 8) | bytes[pos + 3]) === width) {
      pos += 4;
      for (let ch = 0; ch < 4; ch++) {
        let x = 0;
        while (x < width) {
          let count = bytes[pos++];
          if (count > 128) {
            count -= 128;
            const v = bytes[pos++];
            for (let i = 0; i < count; i++) scan[(x++) * 4 + ch] = v;
          } else {
            for (let i = 0; i < count; i++) scan[(x++) * 4 + ch] = bytes[pos++];
          }
        }
      }
    } else {
      // flat
      for (let i = 0; i < width * 4; i++) scan[i] = bytes[pos++];
    }
    const row = flipY ? (height - 1 - y) : y;
    for (let x = 0; x < width; x++) {
      const e = scan[x * 4 + 3];
      const o = (row * width + x) * 4;
      if (e === 0) { data[o] = data[o + 1] = data[o + 2] = 0; }
      else {
        const f = Math.pow(2, e - 128 - 8);
        data[o] = scan[x * 4] * f;
        data[o + 1] = scan[x * 4 + 1] * f;
        data[o + 2] = scan[x * 4 + 2] * f;
      }
      data[o + 3] = 1;
    }
  }
  return { width, height, data };
}

// Build sampling tables: per-row conditional CDF (width+1 per row) and marginal CDF (height+1),
// weighted by luminance * sin(theta) so the sampling density matches solid angle.
export function buildEnvCDF(env) {
  const { width: W, height: H, data } = env;
  const cond = new Float32Array((W + 1) * H);
  const marg = new Float32Array(H + 1);
  const rowSum = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const sinT = Math.sin(Math.PI * (y + 0.5) / H);
    let acc = 0;
    cond[y * (W + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const lum = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) * sinT + 1e-6;
      acc += lum;
      cond[y * (W + 1) + x + 1] = acc;
    }
    rowSum[y] = acc;
    for (let x = 1; x <= W; x++) cond[y * (W + 1) + x] /= acc;
  }
  let total = 0;
  marg[0] = 0;
  for (let y = 0; y < H; y++) { total += rowSum[y]; marg[y + 1] = total; }
  for (let y = 1; y <= H; y++) marg[y] /= total;
  // total integral of lum*sin over the sphere param space -> used for pdf
  return { cond, marg, total, rowSum };
}
