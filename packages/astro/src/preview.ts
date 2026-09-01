const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Creates a short-lived signed preview token: `<expiryEpochSeconds>.<hmac>`. */
export async function createPreviewToken(secret: string, ttlSeconds = 900): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(String(exp)));
  return `${exp}.${toHex(sig)}`;
}

export async function verifyPreviewToken(secret: string, token: string): Promise<boolean> {
  const [expStr, sigHex] = token.split('.');
  if (!expStr || !sigHex) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const key = await hmacKey(secret);
  const expected = toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(expStr)));
  return expected.length === sigHex.length && expected === sigHex;
}
