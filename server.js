require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('node:crypto');
const mysql = require('mysql2');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { hashPassword, verifyPassword, signSession, verifySession, signPatientCaseAccess, verifyPatientCaseAccess, SESSION_TTL_SECONDS } = require('./security');
const { isValidPatientPayload, isValidScreeningPayload, isValidRegistrationPayload, isValidPatientPortalCode, toFiniteNumber } = require('./validation');

const app = express();
const PORT = Number(process.env.PORT) || 9999;
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const aiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;
const sessionCookieName = 'kidq_session';
const loginAttempts = new Map();
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'health_gate'
});

app.use(cors());
app.use(express.json({ limit: '16kb' }));

function getCookie(req, name) {
  const cookies = req.headers.cookie || '';
  for (const part of cookies.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

function sessionCookie(token, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function loadCurrentUser(req, callback) {
  const session = verifySession(getCookie(req, sessionCookieName), SESSION_SECRET);
  if (!session) return callback(null, null);
  db.query('SELECT user_id, username, role, is_active, patient_id FROM users WHERE user_id = ? LIMIT 1', [session.sub], (error, rows) => {
    if (error) return callback(error);
    const account = rows[0];
    if (!account || !account.is_active) return callback(null, null);
    callback(null, { sub: account.user_id, username: account.username, role: account.role, patientId: account.patient_id });
  });
}

function rateLimitKey(req, username) {
  return `${req.ip || 'local'}:${String(username || '').trim().toLowerCase()}`;
}

function isLoginLimited(key) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.startedAt >= windowMs) {
    loginAttempts.set(key, { startedAt: now, count: 1 });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count += 1;
  return false;
}

function requireAuth(req, res, next) {
  loadCurrentUser(req, (error, user) => {
    if (error) {
      console.error('Session lookup failed:', error.message);
      return res.status(503).json({ error: 'ระบบบัญชีผู้ใช้ยังไม่พร้อมใช้งาน' });
    }
    if (!user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
    req.user = user;
    next();
  });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'บัญชีนี้ไม่มีสิทธิ์ดำเนินการ' });
    }
    next();
  };
}

function withPatientRecordAccess(req, res, patientId, action) {
  if (['admin', 'clinician'].includes(req.user.role)) return action();
  if (req.user.role !== 'viewer') return res.status(403).json({ error: 'บัญชีนี้ไม่มีสิทธิ์ดำเนินการ' });

  const access = verifyPatientCaseAccess(req.body?.case_token, SESSION_SECRET);
  if (!access || access.sub !== Number(req.user.sub) || access.patientId !== Number(patientId)) {
    return res.status(403).json({ error: 'บัญชีนี้เข้าถึงได้เฉพาะเคสที่ตนเองลงทะเบียน' });
  }
  action();
}

app.get('/api/auth/session', (req, res) => {
  loadCurrentUser(req, (error, user) => {
    if (error) {
      console.error('Session lookup failed:', error.message);
      return res.status(503).json({ error: 'ระบบบัญชีผู้ใช้ยังไม่พร้อมใช้งาน' });
    }
    if (!user) return res.json({ authenticated: false, user: null });
    res.json({ authenticated: true, user: { id: user.sub, username: user.username, role: user.role } });
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body || {};
  const rawPatientCode = req.body?.patient_code;
  if (rawPatientCode != null && typeof rawPatientCode !== 'string') {
    return res.status(400).json({ error: 'รูปแบบรหัสลงทะเบียนคนไข้ไม่ถูกต้อง' });
  }
  const patientCode = typeof rawPatientCode === 'string' ? rawPatientCode.trim() : '';
  const key = 'register:' + (req.ip || 'local');
  if (isLoginLimited(key)) return res.status(429).json({ error: 'สมัครสมาชิกบ่อยเกินไป กรุณาลองใหม่ภายใน 15 นาที' });
  if (!isValidRegistrationPayload({ username, password })) {
    return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องยาว 3–32 ตัวอักษร และรหัสผ่านต้องยาว 12–128 ตัวอักษร' });
  }
  if (patientCode && !isValidPatientPortalCode(patientCode)) {
    return res.status(400).json({ error: 'รูปแบบรหัสลงทะเบียนคนไข้ไม่ถูกต้อง' });
  }
  if (!SESSION_SECRET || Buffer.byteLength(SESSION_SECRET) < 32) {
    return res.status(503).json({ error: 'ระบบบัญชียังตั้งค่าไม่พร้อมใช้งาน' });
  }

  hashPassword(password).then((passwordHash) => {
    if (patientCode) return registerPatientAccount(username.trim(), passwordHash, patientCode, res);
    db.execute('INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, ?)',
      [username.trim(), passwordHash, 'viewer', false], (error) => {
        if (error) {
          if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
          console.error('Registration failed:', error.message);
          return res.status(503).json({ error: 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่ภายหลัง' });
        }
        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ กรุณารอผู้ดูแลอนุมัติบัญชีก่อนเข้าสู่ระบบ', role: 'viewer', active: false });
      });
  }).catch((error) => {
    console.error('Password hashing failed:', error.message);
    res.status(500).json({ error: 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่ภายหลัง' });
  });
});

function registerPatientAccount(username, passwordHash, patientCode, res) {
  const codeHash = crypto.createHash('sha256').update(patientCode).digest('hex');
  db.beginTransaction((transactionError) => {
    if (transactionError) return res.status(503).json({ error: 'ระบบบัญชียังไม่พร้อมใช้งาน' });
    db.query('SELECT Patient_id FROM patients WHERE portal_code_hash = ? AND portal_code_expires_at > UTC_TIMESTAMP() LIMIT 1 FOR UPDATE', [codeHash], (lookupError, patients) => {
      if (lookupError) return rollbackRegistration(lookupError);
      if (patients.length === 0) return rollbackRegistration(null, 400, 'รหัสลงทะเบียนไม่ถูกต้อง หมดอายุ หรือถูกใช้ไปแล้ว');
      const patientId = patients[0].Patient_id;
      db.execute('INSERT INTO users (username, password_hash, role, patient_id, is_active) VALUES (?, ?, ?, ?, TRUE)',
        [username, passwordHash, 'patient', patientId], (insertError) => {
          if (insertError) {
            if (insertError.code === 'ER_DUP_ENTRY') return rollbackRegistration(null, 409, 'ชื่อผู้ใช้ถูกใช้แล้ว หรือบัญชีคนไข้รายนี้ลงทะเบียนไปแล้ว');
            return rollbackRegistration(insertError);
          }
          db.execute('UPDATE patients SET portal_code_hash = NULL, portal_code_expires_at = NULL WHERE Patient_id = ?', [patientId], (clearError) => {
            if (clearError) return rollbackRegistration(clearError);
            db.commit((commitError) => {
              if (commitError) return rollbackRegistration(commitError);
              res.status(201).json({ message: 'สร้างบัญชีคนไข้สำเร็จ เข้าสู่ระบบเพื่อดูผลของคุณ', role: 'patient', active: true });
            });
          });
        });
    });

    function rollbackRegistration(error, status = 503, message = 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่ภายหลัง') {
      if (error) console.error('Patient account registration failed:', error.message);
      db.rollback(() => res.status(status).json({ error: message }));
    }
  });
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const key = rateLimitKey(req, username);
  if (isLoginLimited(key)) return res.status(429).json({ error: 'ลองเข้าสู่ระบบใหม่ภายใน 15 นาที' });
  if (typeof username !== 'string' || typeof password !== 'string' || !SESSION_SECRET || Buffer.byteLength(SESSION_SECRET) < 32) {
    return res.status(400).json({ error: 'กรุณาตรวจสอบชื่อผู้ใช้ รหัสผ่าน และการตั้งค่า session' });
  }

  db.query('SELECT user_id, username, password_hash, role, is_active, patient_id FROM users WHERE username = ? LIMIT 1', [username.trim()], async (error, rows) => {
    if (error) {
      console.error('Login lookup failed:', error.message);
      return res.status(503).json({ error: 'ระบบบัญชีผู้ใช้ยังไม่พร้อมใช้งาน' });
    }
    const user = rows[0];
    const valid = user && user.is_active && await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });

    loginAttempts.delete(key);
    const token = signSession(user, SESSION_SECRET);
    res.setHeader('Set-Cookie', sessionCookie(token, SESSION_TTL_SECONDS));
    res.json({ authenticated: true, user: { id: user.user_id, username: user.username, role: user.role } });
  });
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.json({ message: 'ออกจากระบบแล้ว' });
});

app.get('/api/test', (_req, res) => {
  res.json({ message: 'Backend พร้อมทำงานแล้ว!' });
});

app.post('/api/add-patient', requireAuth, requireRole('admin', 'clinician', 'viewer'), (req, res) => {
  const { name, age, weight, disease = '', fund } = req.body || {};
  if (!isValidPatientPayload({ name, age, weight, disease, fund })) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ อายุ น้ำหนัก และสิทธิการรักษาให้ถูกต้อง' });
  }

  const portalCode = crypto.randomBytes(32).toString('base64url');
  const portalCodeHash = crypto.createHash('sha256').update(portalCode).digest('hex');
  const sql = 'INSERT INTO patients (Patient_name, Patient_age, Patient_weight, underlying_disease, health_fund, portal_code_hash, portal_code_expires_at) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))';
  db.execute(sql, [name.trim(), toFiniteNumber(age), toFiniteNumber(weight), disease.trim(), fund.trim(), portalCodeHash], (error, result) => {
    if (error) {
      console.error('Error inserting patient:', error.message);
      return res.status(500).json({ error: 'บันทึกข้อมูลคนไข้ไม่สำเร็จ' });
    }
    res.status(201).json({ message: 'ลงทะเบียนคนไข้สำเร็จ', patient_id: result.insertId, portal_code: portalCode, case_token: signPatientCaseAccess(req.user.sub, result.insertId, SESSION_SECRET) });
  });
});

app.post('/api/add-screening', requireAuth, requireRole('admin', 'clinician', 'viewer'), (req, res) => {
  const { patient_id, blood_sugar, blood_pressure, qcard_risk } = req.body || {};
  if (!isValidScreeningPayload({ patient_id, blood_sugar, blood_pressure, qcard_risk })) {
    return res.status(400).json({ error: 'กรุณาตรวจสอบข้อมูลผลตรวจให้ถูกต้อง' });
  }

  return withPatientRecordAccess(req, res, toFiniteNumber(patient_id), () => {
    const sql = `INSERT INTO health_screening (patient_id, blood_sugar, blood_pressure, qcard_uacr_risk)
                 VALUES (?, ?, ?, ?)`;
    db.query(sql, [toFiniteNumber(patient_id), toFiniteNumber(blood_sugar), blood_pressure.trim(), String(toFiniteNumber(qcard_risk))], (error) => {
      if (error) {
        console.error('Error inserting screening:', error.message);
        return res.status(500).json({ error: 'บันทึกผลตรวจไม่สำเร็จ' });
      }
      res.status(201).json({ message: 'บันทึกผลตรวจสุขภาพสำเร็จ' });
    });
  });
});

app.post('/api/analyze', requireAuth, requireRole('admin', 'clinician', 'viewer'), (req, res) => {
  const { patient_id } = req.body || {};
  if (!Number.isInteger(toFiniteNumber(patient_id)) || toFiniteNumber(patient_id) <= 0) {
    return res.status(400).json({ error: 'รหัสคนไข้ไม่ถูกต้อง' });
  }
  if (!aiClient) return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY' });

  return withPatientRecordAccess(req, res, toFiniteNumber(patient_id), () => {
    db.query('SELECT * FROM health_screening WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1', [toFiniteNumber(patient_id)], (error, results) => {
      if (error) {
        console.error('Error loading screening:', error.message);
        return res.status(500).json({ error: 'ค้นหาผลตรวจไม่สำเร็จ' });
      }
      if (results.length === 0) return res.status(404).json({ error: 'ไม่พบผลตรวจของคนไข้รายนี้' });

      const data = results[0];
      const prompt = `คุณเป็นผู้ช่วยให้ข้อมูลสุขภาพเบื้องต้น ไม่ใช่แพทย์ โปรดให้คำแนะนำภาษาไทย 3 ข้อ โดยระบุว่าควรปรึกษาบุคลากรทางการแพทย์และห้ามวินิจฉัยโรค จากข้อมูลนี้:\n- ระดับน้ำตาลในเลือด: ${data.blood_sugar} mg/dL\n- ความดันโลหิต: ${data.blood_pressure}\n- ค่า UACR: ${data.qcard_uacr_risk} mg/g`;

      (async () => {
        try {
          const model = aiClient.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite' });
          const result = await model.generateContent(prompt);
          const recommendation = result.response.text();
          db.query('INSERT INTO ai_recommendations (patient_id, ai_module, ai_response_text) VALUES (?, ?, ?)',
            [toFiniteNumber(patient_id), 'Q-Card Risk Analysis', recommendation], (saveError) => {
              if (saveError) {
                console.error('Error saving AI recommendation:', saveError.message);
                return res.status(500).json({ error: 'บันทึกคำแนะนำไม่สำเร็จ' });
              }
              res.json({ message: 'วิเคราะห์สำเร็จ', ai_recommendation: recommendation });
            });
        } catch (aiError) {
          console.error('AI analysis error:', aiError.message);
          res.status(502).json({ error: 'ระบบวิเคราะห์ AI ขัดข้อง กรุณาลองอีกครั้ง' });
        }
      })();
    });
  });
});

app.get('/api/patients-queue', requireAuth, requireRole('admin', 'clinician'), (req, res) => {
  const sql = `
    SELECT p.Patient_id AS patient_id, p.Patient_name AS name, p.Patient_age AS age,
           s.blood_sugar, s.blood_pressure, s.qcard_uacr_risk AS uacr
    FROM patients p
    JOIN health_screening s ON p.Patient_id = s.patient_id
    ORDER BY s.qcard_uacr_risk DESC`;
  db.query(sql, (error, results) => {
    if (error) {
      console.error('Error loading queue:', error.message);
      return res.status(500).json({ error: 'โหลดคิวผู้ป่วยไม่สำเร็จ' });
    }
    res.json(results);
  });
});

app.post('/api/patients/:id/portal-code', requireAuth, requireRole('admin', 'clinician'), (req, res) => {
  const patientId = Number(req.params.id);
  if (!Number.isInteger(patientId) || patientId <= 0) return res.status(400).json({ error: 'รหัสคนไข้ไม่ถูกต้อง' });
  const portalCode = crypto.randomBytes(32).toString('base64url');
  const portalCodeHash = crypto.createHash('sha256').update(portalCode).digest('hex');
  const sql = 'UPDATE patients p SET portal_code_hash = ?, portal_code_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY) WHERE p.Patient_id = ? AND NOT EXISTS (SELECT 1 FROM users u WHERE u.patient_id = p.Patient_id)';
  db.execute(sql, [portalCodeHash, patientId], (error, result) => {
    if (error) {
      console.error('Portal code generation failed:', error.message);
      return res.status(500).json({ error: 'สร้างรหัสลงทะเบียนไม่สำเร็จ' });
    }
    if (result.affectedRows === 0) {
      return db.query('SELECT Patient_id FROM patients WHERE Patient_id = ? LIMIT 1', [patientId], (lookupError, rows) => {
        if (lookupError) return res.status(500).json({ error: 'ตรวจสอบข้อมูลคนไข้ไม่สำเร็จ' });
        if (!rows.length) return res.status(404).json({ error: 'ไม่พบข้อมูลคนไข้' });
        res.status(409).json({ error: 'คนไข้รายนี้มีบัญชีแล้ว' });
      });
    }
    res.json({ portal_code: portalCode, expires_in_days: 30 });
  });
});

app.get('/api/patient/me', requireAuth, requireRole('patient'), (req, res) => {
  if (!Number.isInteger(Number(req.user.patientId))) return res.status(403).json({ error: 'บัญชีนี้ยังไม่ได้ผูกกับข้อมูลคนไข้' });
  const patientId = Number(req.user.patientId);
  db.query('SELECT Patient_name AS name, Patient_age AS age FROM patients WHERE Patient_id = ? LIMIT 1', [patientId], (patientError, patients) => {
    if (patientError) {
      console.error('Patient portal lookup failed:', patientError.message);
      return res.status(500).json({ error: 'โหลดข้อมูลคนไข้ไม่สำเร็จ' });
    }
    if (!patients.length) return res.status(404).json({ error: 'ไม่พบข้อมูลคนไข้' });
    db.query('SELECT blood_sugar, blood_pressure, qcard_uacr_risk AS uacr, created_at FROM health_screening WHERE patient_id = ? ORDER BY Health_Screening_id DESC LIMIT 1', [patientId], (screeningError, screenings) => {
      if (screeningError) {
        console.error('Patient screening lookup failed:', screeningError.message);
        return res.status(500).json({ error: 'โหลดผลตรวจไม่สำเร็จ' });
      }
      db.query('SELECT ai_module, ai_response_text, created_at FROM ai_recommendations WHERE patient_id = ? ORDER BY Ai_id DESC LIMIT 20', [patientId], (recommendationError, recommendations) => {
        if (recommendationError) {
          console.error('Patient AI results lookup failed:', recommendationError.message);
          return res.status(500).json({ error: 'โหลดผล AI ไม่สำเร็จ' });
        }
        res.json({ patient: patients[0], screening: screenings[0] || null, recommendations });
      });
    });
  });
});

app.delete('/api/patients/:id', requireAuth, requireRole('admin'), (req, res) => {
  const patientId = Number(req.params.id);
  if (!Number.isInteger(patientId) || patientId <= 0) return res.status(400).json({ error: 'รหัสคนไข้ไม่ถูกต้อง' });

  db.beginTransaction((transactionError) => {
    if (transactionError) return res.status(500).json({ error: 'เริ่มลบข้อมูลไม่สำเร็จ' });
    db.query('DELETE FROM ai_recommendations WHERE patient_id = ?', [patientId], (aiError) => {
      if (aiError) return rollbackDelete(aiError);
      db.query('DELETE FROM health_screening WHERE patient_id = ?', [patientId], (screeningError) => {
        if (screeningError) return rollbackDelete(screeningError);
        db.query('DELETE FROM patients WHERE Patient_id = ?', [patientId], (patientError, result) => {
          if (patientError) return rollbackDelete(patientError);
          if (result.affectedRows === 0) return db.rollback(() => res.status(404).json({ error: 'ไม่พบข้อมูลคนไข้' }));
          db.commit((commitError) => {
            if (commitError) return rollbackDelete(commitError);
            res.json({ message: 'ลบข้อมูลสำเร็จ' });
          });
        });
      });
    });

    function rollbackDelete(error) {
      console.error('Error deleting patient:', error.message);
      db.rollback(() => res.status(500).json({ error: 'ลบข้อมูลคนไข้ไม่สำเร็จ' }));
    }
  });
});

const frontendFiles = new Set(['index.html', 'dashboard.html', 'kidney-twin.html', 'login.html', 'register.html', 'patient.html', 'app.js', 'auth.js', 'utils.js', 'styles.css']);
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/:file', (req, res, next) => {
  if (!frontendFiles.has(req.params.file)) return next();
  res.sendFile(path.join(__dirname, req.params.file));
});

function startServer() {
  db.connect((error) => {
    if (error) {
      console.error('เชื่อมต่อฐานข้อมูลไม่สำเร็จ:', error.message);
    } else {
      console.log(`เชื่อมต่อฐานข้อมูล ${process.env.DB_NAME || 'health_gate'} สำเร็จ`);
    }
  });
  app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
}

if (require.main === module) startServer();

module.exports = { app, startServer };
