import React, { useState } from 'react';
import { ShieldCheck, Sparkles, X, Eye } from 'lucide-react';
import { PCReport } from '../types/pcHealth';
import { sanitizeReportForAI } from '../utils/ruleEvaluator';

interface AiConsentModalProps {
  isOpen: boolean;
  report: PCReport;
  stripPersonalInfo: boolean;
  onChangeStripPersonalInfo: (val: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}

// หน้าต่างแจ้งความเป็นส่วนตัวและขอความยินยอมก่อนส่งข้อมูลให้ Gemini AI วิเคราะห์
export const AiConsentModal: React.FC<AiConsentModalProps> = ({
  isOpen,
  report,
  stripPersonalInfo,
  onChangeStripPersonalInfo,
  onConfirm,
  onClose,
}) => {
  const [showPreview, setShowPreview] = useState(false);

  if (!isOpen) return null;

  const sanitizedPreview = sanitizeReportForAI(report, stripPersonalInfo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                การคุ้มครองความเป็นส่วนตัวก่อนส่งให้ AI วิเคราะห์
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ยืนยันการส่งค่าสถานะฮาร์ดแวร์ไปยัง Gemini API
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
          <p>
            โดยปกติแอปจะประมวลผลข้อมูลบนเครื่องของคุณทันที แต่เมื่อกด{' '}
            <strong>"วิเคราะห์เชิงลึกด้วย Gemini AI"</strong> ระบบจะส่งข้อมูลสเปกเครื่อง ค่าเซนเซอร์ และสถิติ Event Log ไปให้โมเดล Gemini ช่วยสรุปแนวทางซ่อมและประเมินราคาอะไหล่
          </p>
        </div>

        {/* ตัวเลือกตัดข้อมูลระบุตัวตนออกก่อนส่ง */}
        <label className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={stripPersonalInfo}
            onChange={(e) => onChangeStripPersonalInfo(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <div className="text-xs">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              ลบข้อมูลที่ระบุตัวตนออกก่อนส่ง (แนะนำให้เปิดไว้)
            </div>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              แทนที่ ชื่อเครื่อง (Computer Name), ชื่อผู้ใช้ (Username) และหมายเลขประจำเครื่อง (Serial Number ของดิสก์และเมนบอร์ด) ด้วยข้อความ REDACTED ก่อนส่งให้ AI
            </p>
          </div>
        </label>

        <div>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            {showPreview ? 'ซ่อนตัวอย่างข้อมูลที่จะส่ง' : 'ดูตัวอย่างข้อมูล JSON ที่จะถูกส่งให้ Gemini'}
          </button>

          {showPreview && (
            <pre className="mt-2 p-3 rounded-lg bg-slate-950 text-slate-100 font-mono text-[11px] max-h-44 overflow-auto">
              {JSON.stringify(sanitizedPreview, null, 2)}
            </pre>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            ยินยอมและเริ่มวิเคราะห์ด้วย AI
          </button>
        </div>
      </div>
    </div>
  );
};
