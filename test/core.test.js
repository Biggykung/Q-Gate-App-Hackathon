const test = require('node:test');
const assert = require('node:assert/strict');
const { getUACRCategory, evaluateUACRRisk } = require('../utils');
const { isValidPatientPayload, isValidScreeningPayload, isValidRegistrationPayload, isValidPatientPortalCode } = require('../validation');
const { hashPassword, verifyPassword, signSession, verifySession, signPatientCaseAccess, verifyPatientCaseAccess } = require('../security');

test('UACR category boundaries are stable', () => {
  assert.equal(getUACRCategory(0), 'A1');
  assert.equal(getUACRCategory(29.99), 'A1');
  assert.equal(getUACRCategory(30), 'A2');
  assert.equal(getUACRCategory(300), 'A2');
  assert.equal(getUACRCategory(300.01), 'A3');
});

test('invalid and missing UACR values are not classified as normal', () => {
  for (const value of [null, undefined, '', '   ', -1, 'NaN', Infinity]) {
    assert.equal(getUACRCategory(value), null);
  }
  assert.match(evaluateUACRRisk(null).riskBadge, /ไม่มีข้อมูล/);
});

test('patient and screening payloads reject invalid values', () => {
  assert.equal(isValidPatientPayload({ name: 'Demo', age: 45, weight: 70, disease: '', fund: 'Demo' }), true);
  assert.equal(isValidPatientPayload({ name: ' ', age: 45, weight: 70, fund: 'Demo' }), false);
  assert.equal(isValidPatientPayload({ name: 'Demo', age: 121, weight: 70, fund: 'Demo' }), false);
  assert.equal(isValidScreeningPayload({ patient_id: 1, blood_sugar: 100, blood_pressure: '120/80', qcard_risk: 30 }), true);
  assert.equal(isValidScreeningPayload({ patient_id: 1.5, blood_sugar: 100, blood_pressure: '120/80', qcard_risk: 30 }), false);
  assert.equal(isValidScreeningPayload({ patient_id: 1, blood_sugar: 100, blood_pressure: '120/80', qcard_risk: -1 }), false);
});

test('password hashes verify without storing the original password', async () => {
  const password = 'Correct Horse Battery Staple!';
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong password', hash), false);
});

test('signed sessions reject tampering and expiry', () => {
  const secret = 'a'.repeat(64);
  const user = { user_id: 7, username: 'clinician', role: 'clinician' };
  const token = signSession(user, secret, 1_800_000_000_000);
  assert.equal(verifySession(token, secret, 1_800_000_000_000).username, 'clinician');
  assert.equal(verifySession(`${token}x`, secret, 1_800_000_000_000), null);
  assert.equal(verifySession(token, secret, 1_800_100_000_000), null);
});

test('registration validates username and password rules', () => {
  assert.equal(isValidRegistrationPayload({ username: 'nurse_01', password: 'LongPassword123' }), true);
  assert.equal(isValidRegistrationPayload({ username: 'ab', password: 'LongPassword123' }), false);
  assert.equal(isValidRegistrationPayload({ username: 'nurse 01', password: 'LongPassword123' }), false);
  assert.equal(isValidRegistrationPayload({ username: 'nurse_01', password: 'short' }), false);
  assert.equal(isValidRegistrationPayload({ username: 'nurse_01', password: 'x'.repeat(129) }), false);
});

test('patient portal codes require the expected opaque token format', () => {
  assert.equal(isValidPatientPortalCode('A'.repeat(43)), true);
  assert.equal(isValidPatientPortalCode('A'.repeat(42)), false);
  assert.equal(isValidPatientPortalCode('!'.repeat(43)), false);
});

test('viewer case tokens are signed, user-bound, and expire', () => {
  const secret = 'b'.repeat(64);
  const now = 1_800_000_000_000;
  const token = signPatientCaseAccess(12, 34, secret, now);
  assert.equal(verifyPatientCaseAccess(token, secret, now).patientId, 34);
  assert.equal(verifyPatientCaseAccess(token, secret, now).sub, 12);
  assert.equal(verifyPatientCaseAccess(token + 'x', secret, now), null);
  assert.equal(verifyPatientCaseAccess(token, secret, now + 8 * 60 * 60 * 1000), null);
});
