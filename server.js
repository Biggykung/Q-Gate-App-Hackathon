require('dotenv').config();

const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = Number(process.env.PORT) || 9999;
const aiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'health_gate'
});

db.connect((error) => {
  if (error) {
    console.error('เชื่อมต่อฐานข้อมูลไม่สำเร็จ:', error.message);
    return;
  }
  console.log(`เชื่อมต่อฐานข้อมูล ${process.env.DB_NAME || 'health_gate'} สำเร็จ`);
});

function isPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

app.get('/api/test', (_req, res) => {
  res.json({ message: 'Backend พร้อมทำงานแล้ว!' });
});

app.post('/api/add-patient', (req, res) => {
  const { name, age, weight, disease = '', fund } = req.body;
  if (typeof name !== 'string' || !name.trim() || !isPositiveNumber(age) || !isPositiveNumber(weight) || typeof fund !== 'string' || !fund.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ อายุ น้ำหนัก และสิทธิการรักษาให้ครบถ้วน' });
  }

  const sql = `INSERT INTO patients (Patient_name, Patient_age, Patient_weight, underlying_disease, health_fund)
               VALUES (?, ?, ?, ?, ?)`;
  db.query(sql, [name.trim(), Number(age), Number(weight), String(disease).trim(), fund.trim()], (error, result) => {
    if (error) {
      console.error('Error inserting patient:', error.message);
      return res.status(500).json({ error: 'บันทึกข้อมูลคนไข้ไม่สำเร็จ' });
    }
    res.status(201).json({ message: 'ลงทะเบียนคนไข้สำเร็จ', patient_id: result.insertId });
  });
});

app.post('/api/add-screening', (req, res) => {
  const { patient_id, blood_sugar, blood_pressure, qcard_risk } = req.body;
  if (!isPositiveNumber(patient_id) || !isPositiveNumber(blood_sugar) || typeof blood_pressure !== 'string' || !blood_pressure.trim() || !Number.isFinite(Number(qcard_risk)) || Number(qcard_risk) < 0) {
    return res.status(400).json({ error: 'กรุณาตรวจสอบข้อมูลผลตรวจให้ถูกต้อง' });
  }

  const sql = `INSERT INTO health_screening (patient_id, blood_sugar, blood_pressure, qcard_uacr_risk)
               VALUES (?, ?, ?, ?)`;
  db.query(sql, [Number(patient_id), Number(blood_sugar), blood_pressure.trim(), Number(qcard_risk)], (error) => {
    if (error) {
      console.error('Error inserting screening:', error.message);
      return res.status(500).json({ error: 'บันทึกผลตรวจไม่สำเร็จ' });
    }
    res.status(201).json({ message: 'บันทึกผลตรวจสุขภาพสำเร็จ' });
  });
});

app.post('/api/analyze', async (req, res) => {
  const { patient_id } = req.body;
  if (!isPositiveNumber(patient_id)) return res.status(400).json({ error: 'รหัสคนไข้ไม่ถูกต้อง' });
  if (!aiClient) return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY' });

  db.query('SELECT * FROM health_screening WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1', [Number(patient_id)], async (error, results) => {
    if (error) {
      console.error('Error loading screening:', error.message);
      return res.status(500).json({ error: 'ค้นหาผลตรวจไม่สำเร็จ' });
    }
    if (results.length === 0) return res.status(404).json({ error: 'ไม่พบผลตรวจของคนไข้รายนี้' });

    const data = results[0];
    const prompt = `คุณเป็นผู้ช่วยให้ข้อมูลสุขภาพเบื้องต้น ไม่ใช่แพทย์ โปรดให้คำแนะนำภาษาไทย 3 ข้อ โดยระบุว่าควรปรึกษาบุคลากรทางการแพทย์และห้ามวินิจฉัยโรค จากข้อมูลนี้:\n- ระดับน้ำตาลในเลือด: ${data.blood_sugar} mg/dL\n- ความดันโลหิต: ${data.blood_pressure}\n- ค่า UACR: ${data.qcard_uacr_risk} mg/g`;

    try {
      const model = aiClient.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite' });
      const result = await model.generateContent(prompt);
      const recommendation = result.response.text();
      db.query('INSERT INTO ai_recommendations (patient_id, ai_module, ai_response_text) VALUES (?, ?, ?)',
        [Number(patient_id), 'Q-Card Risk Analysis', recommendation], (saveError) => {
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
  });
});

app.get('/api/patients-queue', (_req, res) => {
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

app.delete('/api/patients/:id', (req, res) => {
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
          if (result.affectedRows === 0) {
            return db.rollback(() => res.status(404).json({ error: 'ไม่พบข้อมูลคนไข้' }));
          }
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

const frontendFiles = new Set(['index.html', 'dashboard.html', 'kidney-twin.html', 'app.js', 'utils.js', 'styles.css']);

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:file', (req, res, next) => {
  if (!frontendFiles.has(req.params.file)) return next();
  res.sendFile(path.join(__dirname, req.params.file));
});
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
