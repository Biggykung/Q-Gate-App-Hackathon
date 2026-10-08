const API_BASE = 'http://localhost:9999/api';
let currentPatientId = null;

// 1. ส่งข้อมูลลงทะเบียนคนไข้
document.getElementById('patientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('patientStatus');
    status.className = 'mt-3 text-sm text-slate-500';
    status.innerText = 'กำลังบันทึกข้อมูล...';

    const payload = {
        name: document.getElementById('name').value,
        age: parseInt(document.getElementById('age').value),
        weight: parseFloat(document.getElementById('weight').value),
        disease: document.getElementById('disease').value,
        fund: document.getElementById('fund').value
    };

    try {
        const res = await fetch(`${API_BASE}/add-patient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
        
    if (res.ok) {
        currentPatientId = data.patient_id;
        document.getElementById('screen_patient_id').value = currentPatientId;
        status.className = 'mt-3 text-sm text-emerald-600';
        status.innerText = `สำเร็จ: ลงทะเบียนคนไข้เรียบร้อย (Patient ID: ${currentPatientId})`;
    } else {
        throw new Error(data.error);
        }
      } catch (err) {
        status.className = 'mt-3 text-sm text-red-500';
        status.innerText = 'เกิดข้อผิดพลาดในการลงทะเบียน';
      }
});

    // 2. ส่งข้อมูลผลการตรวจสุขภาพ
document.getElementById('screeningForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('screeningStatus');
      
    if (!currentPatientId) {
        status.className = 'mt-3 text-sm text-red-500';
        status.innerText = 'กรุณาลงทะเบียนคนไข้ในขั้นตอนที่ 1 ก่อน';
        return;
    }

    status.className = 'mt-3 text-sm text-slate-500';
    status.innerText = 'กำลังบันทึกผลตรวจ...';

    const payload = {
        patient_id: currentPatientId,
        blood_sugar: parseFloat(document.getElementById('blood_sugar').value),
        blood_pressure: document.getElementById('blood_pressure').value,
        qcard_risk: document.getElementById('qcard_risk').value
    };

    try {
        const res = await fetch(`${API_BASE}/add-screening`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok) {
        status.className = 'mt-3 text-sm text-emerald-600';
        status.innerText = 'สำเร็จ: บันทึกข้อมูลผลตรวจสุขภาพเรียบร้อย';
    } else {
        throw new Error(data.error);
    }
    } catch (err) {
        status.className = 'mt-3 text-sm text-red-500';
        status.innerText = 'เกิดข้อผิดพลาดในการบันทึกผลตรวจ';
    }
});

    // 3. กดส่งให้ AI วิเคราะห์
document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const container = document.getElementById('aiResultContainer');
    const text = document.getElementById('aiResultText');
    const btn = document.getElementById('analyzeBtn');

    if (!currentPatientId) {
        alert('กรุณาลงทะเบียนและบันทึกผลตรวจคนไข้ก่อนกดวิเคราะห์');
        return;
    }

    btn.disabled = true;
    btn.innerText = 'กำลังรอ AI ประมวลผล...';
    container.classList.remove('hidden');
    text.innerText = 'ระบบกำลังส่งข้อมูลตรวจล่าสุดไปยังโมเดล AI กรุณารอสักครู่...';

    try {
        const res = await fetch(`${API_BASE}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient_id: currentPatientId })
        });
        const data = await res.json();

        if (res.ok) {
            text.innerText = data.ai_recommendation.replace(/[*#]/g, '');
        } else {
          text.innerText = `เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถวิเคราะห์ได้'}`;
        }
    } catch (err) {
        text.innerText = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์หลังบ้านได้';
    } finally {
        btn.disabled = false;
        btn.innerText = 'เริ่มการวิเคราะห์ด้วย AI';
      }
});
