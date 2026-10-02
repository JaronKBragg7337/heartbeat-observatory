import { createHash } from 'node:crypto';
// RFC 6455: masked client text, continuation frames, ping/pong, bounded payloads.
// No compression is negotiated. Binary input is not part of the game protocol.
export function upgrade(req, socket, head, onMessage, onClose) {
  if (req.headers['sec-websocket-version'] !== '13' || !/^[A-Za-z0-9+/]{22}==$/.test(req.headers['sec-websocket-key'] || '')) { socket.destroy(); return null; }
  const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  let buf = Buffer.alloc(0), fragments = [], size = 0;
  const sendFrame = (opcode, data) => {
    if (socket.destroyed) return;
    const body = Buffer.from(data), n = body.length;
    const header = Buffer.alloc(n < 126 ? 2 : n < 65536 ? 4 : 10); header[0] = 0x80 | opcode;
    if (n < 126) header[1] = n;
    else if (n < 65536) { header[1] = 126; header.writeUInt16BE(n, 2); }
    else { header[1] = 127; header.writeBigUInt64BE(BigInt(n), 2); }
    socket.write(Buffer.concat([header, body]));
  };
  const peer = { send: text => { if (socket.writableLength > 8 * 1024 * 1024) socket.destroy(); else sendFrame(1, text); }, close: () => { sendFrame(8, ''); socket.end(); }, socket };
  function receive(chunk) {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const fin = !!(buf[0] & 128), op = buf[0] & 15;
      if ((buf[0] & 112) || !(buf[1] & 128) || ![0, 1, 8, 9, 10].includes(op)) return socket.destroy();
      let n = buf[1] & 127, offset = 2;
      if (n === 126) { if (buf.length < 4) return; n = buf.readUInt16BE(2); offset = 4; }
      else if (n === 127) { if (buf.length < 10) return; const large = buf.readBigUInt64BE(2); if (large > 65536n) return socket.destroy(); n = Number(large); offset = 10; }
      if (n > 65536 || (op >= 8 && (!fin || n > 125))) return socket.destroy();
      if (buf.length < offset + 4 + n) return;
      const mask = buf.subarray(offset, offset + 4), payload = Buffer.from(buf.subarray(offset + 4, offset + 4 + n));
      for (let i = 0; i < n; i++) payload[i] ^= mask[i % 4];
      buf = buf.subarray(offset + 4 + n);
      if (op === 8) { peer.close(); return; }
      if (op === 9) { sendFrame(10, payload); continue; }
      if (op === 10) continue;
      if ((op === 0 && !fragments.length) || (op === 1 && fragments.length)) return socket.destroy();
      fragments.push(payload); size += n; if (size > 65536) return socket.destroy();
      if (fin) {
        let msg; try { msg = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(fragments)); } catch { return socket.destroy(); }
        fragments = []; size = 0; onMessage(msg);
      }
    }
  }
  socket.on('data', receive); socket.on('error', () => {}); socket.on('close', onClose);
  if (head.length) receive(head); return peer;
}
