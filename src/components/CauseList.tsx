import React, { useState } from 'react';
import { SearchCheck, FileWarning, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { EventLogReport, ProbableCause } from '../types/pcHealth';

interface CauseListProps {
  probableCauses: ProbableCause[];
  preventiveTips: string[];
  eventLogs: EventLogReport;
}

// คอมโพเนนต์แสดง "สาเหตุที่น่าจะเป็นไปได้" เชื่อมโยงอาการกับอะไหล่และ Event Log
export const CauseList: React.FC<CauseListProps> = ({
  probableCauses,
  preventiveTips,
  eventLogs,
}) => {
  const [showEventDetails, setShowEventDetails] = useState(false);

  const getConfidenceStyle = (confidence: string) => {
    if (confidence.includes('สูง')) {
      return 'text-red-700 dark:text-red-400 font-semibold';
    }
    if (confidence.includes('ปานกลาง')) {
      return 'text-amber-700 dark:text-amber-400 font-semibold';
    }
    return 'text-slate-600 dark:text-slate-400';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* คอลัมน์ซ้าย (2 ส่วน): สาเหตุที่น่าจะเป็นไปได้ + Event Log */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <SearchCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                สาเหตุที่น่าจะเป็นไปได้ (เชื่อมโยงอาการ + ฮาร์ดแวร์ + Event Log)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                วิเคราะห์ความสัมพันธ์ระหว่างอาการผิดปกติ ค่าเซนเซอร์ และบันทึกข้อผิดพลาดของ Windows
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {probableCauses.map((item, index) => (
            <div key={index} className="py-4 first:pt-1 last:pb-1 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {index + 1}. {item.symptom}
                </h4>
                <span className={`text-xs ${getConfidenceStyle(item.confidence)}`}>
                  โอกาสเป็นสาเหตุ: {item.confidence}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {item.cause}
              </p>
              {item.relatedComponents && item.relatedComponents.length > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                  <span>อะไหล่ที่เกี่ยวข้อง: </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {item.relatedComponents.join(' · ')}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* สรุปสถิติ Event Log ย้อนหลัง 30 วัน */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              <FileWarning className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>สรุปประวัติ Event Log สำคัญย้อนหลัง 30 วัน</span>
            </div>
            <button
              type="button"
              onClick={() => setShowEventDetails(!showEventDetails)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer no-print"
            >
              {showEventDetails ? (
                <>
                  ซ่อนข้อความตัวอย่าง <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  ดูข้อความ Event ล่าสุด <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-center">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">ดับเอง (KP 41)</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {eventLogs.kernelPower41Count} ครั้ง
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">จอฟ้า (1001)</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {eventLogs.bugCheck1001Count} ครั้ง
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">WHEA Error</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {eventLogs.wheaErrorsCount} ครั้ง
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Disk Error</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {eventLogs.diskErrorsCount} ครั้ง
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">NTFS Error</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {eventLogs.ntfsErrorsCount} ครั้ง
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">แอปค้าง/เด้ง</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {eventLogs.appCrashHangCount} ครั้ง
              </div>
            </div>
          </div>

          {showEventDetails && (
            <div className="mt-4 space-y-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
              {eventLogs.categories && eventLogs.categories.some((c) => c.samples.length > 0) ? (
                eventLogs.categories
                  .filter((c) => c.samples.length > 0)
                  .map((cat, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {cat.category} (พบ {cat.count30Days} รายการ)
                      </div>
                      <ul className="space-y-1 text-slate-600 dark:text-slate-400 font-mono">
                        {cat.samples.map((s, sIdx) => (
                          <li key={sIdx} className="break-words">
                            [{s.timeCreated}] (ID {s.id}): {s.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
              ) : (
                <p className="text-slate-500 dark:text-slate-400">
                  ไม่พบตัวอย่างข้อความ Error ร้ายแรงใน Event Log ย้อนหลัง 30 วัน
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* คอลัมน์ขวา (1 ส่วน): คำแนะนำการป้องกันและทำให้เครื่องลื่นไหล */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                คำแนะนำเพื่อให้เครื่องลื่นไหล
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                แนวทางดูแลป้องกันปัญหาและยืดอายุอะไหล่
              </p>
            </div>
          </div>

          <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            {preventiveTips.map((tip, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/70 last:border-none last:pb-0"
              >
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 shrink-0">
                  0{idx + 1}.
                </span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          เคล็ดลับ: หากพบอาการค้างหรือจอฟ้าหลังจากอัปเดตไดรเวอร์ แนะนำให้ใช้ System Restore หรือลบไดรเวอร์ด้วย DDU
        </div>
      </div>
    </div>
  );
};
