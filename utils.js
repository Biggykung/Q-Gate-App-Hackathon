function getUACRCategory(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const uacr = Number(value);
  if (!Number.isFinite(uacr) || uacr < 0) return null;
  if (uacr < 30) return 'A1';
  if (uacr <= 300) return 'A2';
  return 'A3';
}

function evaluateUACRRisk(value) {
  const category = getUACRCategory(value);
  if (!category) {
    return {
      riskBadge: '<span class="inline-flex rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">ไม่มีข้อมูล</span>',
      actionButton: '<span class="text-xs text-slate-500">ตรวจสอบผลตรวจ</span>'
    };
  }

  const categories = {
    A1: {
      riskBadge: '<span class="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">A1 · ปกติ</span>',
      actionButton: '<span class="block w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">แนวทาง: ติดตามผล 1 ปี</span>'
    },
    A2: {
      riskBadge: '<span class="inline-flex rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700">A2 · เฝ้าระวัง</span>',
      actionButton: '<span class="block w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">แนวทาง: ตรวจซ้ำ 3–6 เดือน</span>'
    },
    A3: {
      riskBadge: '<span class="inline-flex rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700">A3 · เสี่ยงสูง</span>',
      actionButton: '<span class="block w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">แนวทาง: ปรึกษาแพทย์</span>'
    }
  };
  return categories[category];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getUACRCategory, evaluateUACRRisk };
}
