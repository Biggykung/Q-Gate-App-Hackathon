// ไฟล์ utils.js: รวมฟังก์ชันคำนวณและช่วยเหลือต่างๆ

// ฟังก์ชันสำหรับจัดหมวดหมู่ความเสี่ยง UACR เป็น A1, A2, A3
function evaluateUACRRisk(uacrValue) {
  let riskBadge = '';
  let actionButton = '';
  const uacr = parseFloat(uacrValue);

  // กรณี A1 (ปกติ)
  if (uacr < 30) {
    riskBadge = '<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium">A1 (ปกติ)</span>';
    actionButton = `<button onclick="alert('สร้างใบนัดหมายล่วงหน้าสำเร็จ! ระบบได้ส่ง SMS แจ้งเตือนคิวไปยังผู้ป่วยแล้ว')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition w-full">ติดตามอาการ 1 ปี</button>`;
  } 
  // กรณี A2 (เฝ้าระวัง/มีความเสี่ยง)
  else if (uacr >= 30 && uacr < 300) {
    riskBadge = '<span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">A2 (เฝ้าระวัง)</span>';
    actionButton = `<button onclick="alert('สร้างใบนัดหมายล่วงหน้าสำเร็จ! ระบบได้ส่ง SMS แจ้งเตือนคิวไปยังผู้ป่วยแล้ว')" class="bg-amber-100 hover:bg-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium transition w-full">นัดตรวจซ้ำ 3-6 เดือน</button>`;
  } 
  // กรณี A3 (อันตราย/โปรตีนรั่ว)
  else {
    riskBadge = '<span class="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium">A3 (เสี่ยงสูง)</span>';
    actionButton = `<button onclick="alert('สร้างใบ Referral สำเร็จ! ระบบได้ส่งแฟ้มประวัติเคสนี้ไปยังแผนกอายุรกรรมโรคไตเรียบร้อยแล้ว')" class="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition w-full">ส่งต่อแพทย์</button>`;
  }

  // ส่งค่ากลับไปเป็น Object เพื่อให้เอาไปใช้ต่อได้ง่ายๆ
  return { riskBadge, actionButton };
}