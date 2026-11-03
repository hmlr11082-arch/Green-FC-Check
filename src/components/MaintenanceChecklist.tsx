import React from 'react';
import { ClipboardCheck, RotateCcw } from 'lucide-react';
import { MaintenanceItem } from '../types/pcHealth';

interface MaintenanceChecklistProps {
  items: MaintenanceItem[];
  onToggleItem: (id: string) => void;
  onResetChecklist: () => void;
}

export const DEFAULT_MAINTENANCE_ITEMS: MaintenanceItem[] = [
  {
    id: 'clean-dust',
    title: 'เป่าฝุ่นทำความสะอาดพัดลม ฮีตซิงค์ และแผ่นกรองฝุ่น',
    description: 'ลดอุณหภูมิสะสมของ CPU/GPU และป้องกันพัดลมหมุนดังหรือเสื่อมเร็ว',
    intervalText: 'ทุก 3–6 เดือน',
    category: 'ทำความสะอาด',
    checked: false,
    lastDoneDate: null,
  },
  {
    id: 'thermal-paste',
    title: 'เปลี่ยนซิลิโคนระบายความร้อน (Thermal Paste) ของ CPU และ GPU',
    description: 'แก้ปัญหาซิลิโคนแห้งแข็งซึ่งทำให้ความร้อนพุ่งเกิน 85°C เวลาใช้งานหนัก',
    intervalText: 'ทุก 1–2 ปี',
    category: 'ฮาร์ดแวร์',
    checked: false,
    lastDoneDate: null,
  },
  {
    id: 'update-drivers',
    title: 'อัปเดตไดรเวอร์การ์ดจอ ชิปเซ็ต และ Windows Update',
    description: 'แก้บั๊กจอฟ้า (BSOD) อาการภาพกระตุก และอุดช่องโหว่ความปลอดภัย',
    intervalText: 'ทุก 1–3 เดือน',
    category: 'ซอฟต์แวร์',
    checked: false,
    lastDoneDate: null,
  },
  {
    id: 'clean-junk-startup',
    title: 'ล้างไฟล์ขยะ (Storage Sense / Temp) และปิดโปรแกรม Startup ที่ไม่จำเป็น',
    description: 'ช่วยให้เปิดเครื่องไวขึ้น และเหลือพื้นที่ว่างไดรฟ์ C: มากกว่า 15–20% เสมอ',
    intervalText: 'ทุก 1 เดือน',
    category: 'ซอฟต์แวร์',
    checked: false,
    lastDoneDate: null,
  },
  {
    id: 'backup-important',
    title: 'สำรองไฟล์งานและรูปภาพสำคัญลง External Drive หรือ Cloud',
    description: 'ป้องกันข้อมูลสูญหายหาก SSD หรือ HDD เกิดขัดข้องกะทันหัน',
    intervalText: 'ทุก 2–4 สัปดาห์',
    category: 'ข้อมูล',
    checked: false,
    lastDoneDate: null,
  },
  {
    id: 'check-power-ups',
    title: 'ตรวจเช็กสายไฟ อะแดปเตอร์ชาร์จ หรือแบตเตอรี่เครื่องสำรองไฟ (UPS)',
    description: 'ป้องกันอาการไฟกระชากและลดการเกิด Kernel-Power 41 (เครื่องดับเอง)',
    intervalText: 'ทุก 6 เดือน',
    category: 'ฮาร์ดแวร์',
    checked: false,
    lastDoneDate: null,
  },
];

// คอมโพเนนต์ Checklist บำรุงรักษาเครื่องที่ผู้ใช้ติ๊กบันทึกความคืบหน้าได้
export const MaintenanceChecklist: React.FC<MaintenanceChecklistProps> = ({
  items,
  onToggleItem,
  onResetChecklist,
}) => {
  const completedCount = items.filter((i) => i.checked).length;
  const percent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 no-print">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <ClipboardCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Checklist บำรุงรักษาเครื่องตามระยะ
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ติ๊กเช็กรายการที่คุณทำแล้วเพื่อติดตามการดูแลรักษาเครื่อง (บันทึกสถานะไว้ในเบราว์เซอร์อัตโนมัติ)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
            ดำเนินการแล้ว {completedCount}/{items.length} ข้อ ({percent}%)
          </div>
          {completedCount > 0 && (
            <button
              type="button"
              onClick={onResetChecklist}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              รีเซ็ต
            </button>
          )}
        </div>
      </div>

      {/* แถบความคืบหน้า */}
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => (
          <label
            key={item.id}
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors select-none ${
              item.checked
                ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700'
                : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800'
            }`}
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => onToggleItem(item.id)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-sm font-bold ${
                    item.checked
                      ? 'line-through text-slate-500 dark:text-slate-400'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {item.title}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {item.category} · {item.intervalText}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{item.description}</p>
              {item.checked && item.lastDoneDate && (
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1.5">
                  ทำล่าสุดเมื่อ: {item.lastDoneDate}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
    </section>
  );
};
