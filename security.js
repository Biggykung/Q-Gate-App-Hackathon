const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const PASSWORD_HASH_BYTES = 64;

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Password must contain at least 12 characters.');
  }
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, PASSWORD_HASH_BYTES);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  const [scheme, saltHex, keyHex, extra] = storedHash.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex || extra !== undefined) return false;
  if (!/^[0-9a-f]{32}$/i.test(saltHex) || !/^[0-9a-f]{128}$/i.test(keyHex)) return false;

  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function signSession(user, secret, now = Date.now()) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
    throw new Error('SESSION_SECRET must be at least 32 bytes.');
  }
  const payload = {
    sub: Number(user.user_id),
    username: user.username,
    role: user.role,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || typeof secret !== 'string' || Buffer.byteLength(secret) < 32) return null;
  const [encodedPayload, providedSignature, extra] = token.split('.');
  if (!encodedPayload || !providedSignature || extra !== undefined) return null;

  const expectedSignature = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  let suppliedSignature;
  try {
    suppliedSignature = Buffer.from(providedSignature, 'base64url');
  } catch {
    return null;
  }
  if (suppliedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(suppliedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!Number.isInteger(payload.sub) || !payload.username || !payload.role || !Number.isInteger(payload.exp)) return null;
    if (payload.exp <= Math.floor(now / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function signPatientCaseAccess(userId, patientId, secret, now = Date.now()) {
  if (!Number.isInteger(Number(userId)) || !Number.isInteger(Number(patientId)) || typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
    throw new Error('Invalid patient case access token input.');
  }
  const payload = { sub: Number(userId), patientId: Number(patientId), purpose: 'patient-case', exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return encodedPayload + '.' + signature;
}

function verifyPatientCaseAccess(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || typeof secret !== 'string' || Buffer.byteLength(secret) < 32) return null;
  const [encodedPayload, providedSignature, extra] = token.split('.');
  if (!encodedPayload || !providedSignature || extra !== undefined) return null;
  const expectedSignature = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  const suppliedSignature = Buffer.from(providedSignature, 'base64url');
  if (suppliedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(suppliedSignature, expectedSignature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!Number.isInteger(payload.sub) || !Number.isInteger(payload.patientId) || payload.purpose !== 'patient-case' || !Number.isInteger(payload.exp)) return null;
    if (payload.exp <= Math.floor(now / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, signSession, verifySession, signPatientCaseAccess, verifyPatientCaseAccess, SESSION_TTL_SECONDS };
