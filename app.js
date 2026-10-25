const API_BASE = '/api';
let currentPatientId = null;
let currentPatientCaseToken = null;

const statusClasses = {
  neutral: 'mt-3 text-sm font-medium text-slate-500',
  success: 'mt-3 text-sm font-medium text-emerald-700',
  error: 'mt-3 text-sm font-medium text-rose-700'
};

function setStatus(element, message, type = 'neutral') {
  element.className = statusClasses[type];
  element.textContent = message;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'คำขอไม่สำเร็จ');
  return data;
}

function setSubmitting(form, isSubmitting) {
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = isSubmitting;
}

document.getElementById('patientForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById('patientStatus');
  currentPatientId = null;
  currentPatientCaseToken = null;
  document.getElementById('screen_patient_id').value = '';
  document.getElementById('patientPortalInvite').hidden = true;
  document.getElementById('patientPortalCode').value = '';
  document.getElementById('portalCodeStatus').textContent = '';
  const payload = {
    name: document.getElementById('name').value.trim(),
    age: Number(document.getElementById('age').value),
    weight: Number(document.getElementById('weight').value),
    disease: document.getElementById('disease').value.trim(),
    fund: document.getElementById('fund').value.trim()
  };

  setStatus(status, 'กำลังบันทึกข้อมูล...');
  setSubmitting(form, true);
  try {
    const data = await requestJson(`${API_BASE}/add-patient`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    currentPatientId = data.patient_id;
    currentPatientCaseToken = data.case_token;
    document.getElementById('screen_patient_id').value = currentPatientId;
    setStatus(status, `ลงทะเบียนสำเร็จ (Patient ID: ${currentPatientId})`, 'success');
    document.getElementById('patientPortalCode').value = data.portal_code;
    document.getElementById('patientPortalInvite').hidden = false;
  } catch (error) {
    setStatus(status, error.message || 'เกิดข้อผิดพลาดในการลงทะเบียน', 'error');
  } finally {
    setSubmitting(form, false);
  }
});

document.getElementById('screeningForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById('screeningStatus');
  if (!currentPatientId) {
    setStatus(status, 'กรุณาลงทะเบียนคนไข้ในขั้นตอนที่ 1 ก่อน', 'error');
    return;
  }

  const payload = {
    patient_id: currentPatientId,
    case_token: currentPatientCaseToken,
    blood_sugar: Number(document.getElementById('blood_sugar').value),
    blood_pressure: document.getElementById('blood_pressure').value.trim(),
    qcard_risk: Number(document.getElementById('qcard_risk').value)
  };
  setStatus(status, 'กำลังบันทึกผลตรวจ...');
  setSubmitting(form, true);
  try {
    await requestJson(`${API_BASE}/add-screening`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    setStatus(status, 'บันทึกผลตรวจเรียบร้อย', 'success');
  } catch (error) {
    setStatus(status, error.message || 'เกิดข้อผิดพลาดในการบันทึกผลตรวจ', 'error');
  } finally {
    setSubmitting(form, false);
  }
});

document.getElementById('analyzeBtn').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const container = document.getElementById('aiResultContainer');
  const resultText = document.getElementById('aiResultText');
  if (!currentPatientId) {
    container.classList.remove('hidden');
    resultText.textContent = 'กรุณาลงทะเบียนและบันทึกผลตรวจก่อนเริ่มวิเคราะห์';
    return;
  }

  button.disabled = true;
  button.textContent = 'กำลังวิเคราะห์...';
  container.classList.remove('hidden');
  resultText.textContent = 'ระบบกำลังประมวลผล กรุณารอสักครู่...';
  try {
    const data = await requestJson(`${API_BASE}/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient_id: currentPatientId, case_token: currentPatientCaseToken })
    });
    resultText.textContent = (data.ai_recommendation || '').replace(/[*#]/g, '');
  } catch (error) {
    resultText.textContent = error.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
  } finally {
    button.disabled = false;
    button.textContent = 'เริ่มการวิเคราะห์ด้วย AI';
  }
});

document.getElementById('copyPatientPortalCode').addEventListener('click', async () => {
  const codeInput = document.getElementById('patientPortalCode');
  try {
    await navigator.clipboard.writeText(codeInput.value);
    document.getElementById('portalCodeStatus').textContent = 'คัดลอกรหัสแล้ว ส่งให้คนไข้เป็นการส่วนตัว';
  } catch {
    codeInput.focus();
    codeInput.select();
    document.getElementById('portalCodeStatus').textContent = 'เลือกและคัดลอกรหัสนี้ แล้วส่งให้คนไข้เป็นการส่วนตัว';
  }
});
