require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // อนุญาตให้รับส่งข้อมูลเป็น JSON

// 1. ตั้งค่าการเชื่อมต่อฐานข้อมูล MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',      
  password: '@Biggyggez123',      
  database: 'health_gate' 
});

// 2. สั่งให้เชื่อมต่อ
db.connect((err) => {
  if (err) {
    console.error('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล:', err);
    return;
  }
  console.log('✅ เชื่อมต่อฐานข้อมูล health_gate สำเร็จแล้ว!');
});

// 3. สร้าง API จำลองสำหรับทดสอบว่าเซิร์ฟเวอร์ทำงานปกติ
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend พร้อมทำงานแล้ว!' });
});

// ==========================================
// API ที่ 1: ลงทะเบียนคนไข้ใหม่ (ลงตาราง patients)
// ==========================================
app.post('/api/add-patient', (req, res) => {
  const { name, age, weight, disease, fund } = req.body; 

  const sql = `INSERT INTO patients (Patient_name, Patient_age, Patient_weight, underlying_disease, health_fund) 
               VALUES (?, ?, ?, ?, ?)`;

  db.query(sql, [name, age, weight, disease, fund], (err, result) => {
    if (err) {
      console.error('Error inserting patient:', err);
      return res.status(500).json({ error: 'บันทึกข้อมูลคนไข้ล้มเหลว' });
    }
    res.json({ 
      message: 'ลงทะเบียนคนไข้สำเร็จ!', 
      patient_id: result.insertId 
    });
  });
});

// ==========================================
// API ที่ 2: บันทึกผลตรวจสุขภาพ (ลงตาราง health_screening)
// ==========================================
app.post('/api/add-screening', (req, res) => {
  const { patient_id, blood_sugar, blood_pressure, qcard_risk } = req.body;

  const sql = `INSERT INTO health_screening (patient_id, blood_sugar, blood_pressure, qcard_uacr_risk) 
               VALUES (?, ?, ?, ?)`;

  db.query(sql, [patient_id, blood_sugar, blood_pressure, qcard_risk], (err, result) => {
    if (err) {
      console.error('Error inserting screening:', err);
      return res.status(500).json({ error: 'บันทึกผลตรวจล้มเหลว' });
    }
    res.json({ message: 'บันทึกผลตรวจสุขภาพสำเร็จ!' });
  });
});

// ==========================================
// API ที่ 3: วิเคราะห์สุขภาพด้วย AI (ลงตาราง ai_recommendations)
// ==========================================
app.post('/api/analyze', (req, res) => {
  const { patient_id } = req.body;

  const fetchSql = `SELECT * FROM health_screening WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1`;
  
  db.query(fetchSql, [patient_id], async (err, results) => {
    if (err) return res.status(500).json({ error: 'ค้นหาข้อมูลล้มเหลว' });
    if (results.length === 0) return res.status(404).json({ error: 'ไม่พบประวัติผลตรวจของคนไข้รายนี้' });

    const data = results[0];
    const prompt = `คุณคือผู้เชี่ยวชาญด้านสุขภาพ (Quantum Quest Health Gate) 
    โปรดวิเคราะห์ความเสี่ยงและให้คำแนะนำสั้นๆ 3 ข้อ เป็นภาษาไทย สำหรับคนไข้ที่มีข้อมูลดังนี้:
    - ระดับน้ำตาลในเลือด: ${data.blood_sugar} mg/dL
    - ความดันโลหิต: ${data.blood_pressure}
    - ความเสี่ยงโรคไต (UACR จาก Q-Card): ${data.qcard_uacr_risk}`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
      const aiResult = await model.generateContent(prompt);
      const ai_text = aiResult.response.text();

      const insertSql = `INSERT INTO ai_recommendations (patient_id, ai_module, ai_response_text) VALUES (?, ?, ?)`;
      
      db.query(insertSql, [patient_id, 'Q-Card Risk Analysis', ai_text], (err2, result2) => {
        if (err2) return res.status(500).json({ error: 'บันทึกคำแนะนำ AI ล้มเหลว' });
        res.json({ message: 'วิเคราะห์สำเร็จ!', ai_recommendation: ai_text });
      });

    } catch (aiError) {
      console.error(aiError);
      res.status(500).json({ error: 'การวิเคราะห์ AI มีปัญหา' });
    }
  });
});

// 4. API สำหรับหน้า Dashboard ดึงข้อมูลคิวส่งต่อ (Referral Queue)
app.get('/api/patients-queue', (req, res) => {
  // ดึงข้อมูลคนไข้เชื่อมกับผลตรวจ เรียงลำดับความเสี่ยง UACR จากมากไปน้อย (เอาเคสหนักสุดขึ้นก่อน)
  const sql = `
    SELECT 
      p.Patient_id AS patient_id, 
      p.Patient_name AS name, 
      p.Patient_age AS age,
      s.blood_sugar, 
      s.blood_pressure, 
      s.qcard_uacr_risk AS uacr
    FROM patients p
    JOIN health_screening s ON p.Patient_id = s.patient_id
    ORDER BY s.qcard_uacr_risk DESC;
  `;
  
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 5. API สำหรับลบลายชื่อคนไข้ (เคลียร์คิว)
app.delete('/api/patients/:id', (req, res) => {
  const patientId = req.params.id;
  
  // โดมิโนตัวที่ 1: ลบประวัติผลการวิเคราะห์ AI ก่อน
  db.query('DELETE FROM ai_recommendations WHERE patient_id = ?', [patientId], (err1) => {
    if (err1) return res.status(500).json({ error: err1.message });
    
    // โดมิโนตัวที่ 2: ลบผลตรวจสุขภาพตามไป
    db.query('DELETE FROM health_screening WHERE patient_id = ?', [patientId], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      
      // โดมิโนตัวที่ 3: ลบชื่อคนไข้ออกจากระบบ (ตอนนี้ลบได้แล้วเพราะไม่มีลูกเกาะอยู่)
      db.query('DELETE FROM patients WHERE Patient_id = ?', [patientId], (err3) => {
        if (err3) return res.status(500).json({ error: err3.message });
        
        res.json({ message: 'ลบข้อมูลสำเร็จ' });
      });
    });
  });
});

// 6. เปิดพอร์ตเซิร์ฟเวอร์ (ย้ายมาไว้ล่างสุด)
const PORT = 9999;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
