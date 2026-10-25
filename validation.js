function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return Number.NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function isValidPatientPayload({ name, age, weight, disease = '', fund } = {}) {
  return typeof name === 'string'
    && name.trim().length > 0
    && toFiniteNumber(age) >= 1
    && toFiniteNumber(age) <= 120
    && toFiniteNumber(weight) >= 1
    && toFiniteNumber(weight) <= 500
    && typeof disease === 'string'
    && typeof fund === 'string'
    && fund.trim().length > 0;
}

function isValidScreeningPayload({ patient_id, blood_sugar, blood_pressure, qcard_risk } = {}) {
  return Number.isInteger(toFiniteNumber(patient_id))
    && toFiniteNumber(patient_id) > 0
    && toFiniteNumber(blood_sugar) > 0
    && typeof blood_pressure === 'string'
    && blood_pressure.trim().length > 0
    && toFiniteNumber(qcard_risk) >= 0;
}

function isValidPatientPortalCode(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

function isValidRegistrationPayload({ username, password } = {}) {
  return typeof username === 'string'
    && /^[a-zA-Z0-9._-]{3,32}$/.test(username)
    && typeof password === 'string'
    && password.length >= 12
    && password.length <= 128
    && Buffer.byteLength(password, 'utf8') <= 256;
}

module.exports = { toFiniteNumber, isValidPatientPayload, isValidScreeningPayload, isValidRegistrationPayload, isValidPatientPortalCode };
