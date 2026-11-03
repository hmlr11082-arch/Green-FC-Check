import React, { useState, useRef } from 'react';
import {
  Download,
  Terminal,
  Copy,
  Check,
  ShieldCheck,
  Code2,
  ChevronDown,
  ChevronUp,
  Upload,
  ClipboardPaste,
} from 'lucide-react';
import {
  copyTextToClipboard,
  downloadPowerShellScript,
  POWERSHELL_RUN_FILE_COMMAND,
  POWERSHELL_SCRIPT_CONTENT,
} from '../utils/powershellScript';
import { PCReport, SymptomKey } from '../types/pcHealth';
import { parseAndNormalizePCReportJson } from './ReportUploader';

interface ScriptDownloaderProps {
  onLoadReport: (
    report: PCReport,
    defaultSymptoms?: SymptomKey[],
    presetId?: string,
    autoRunAI?: boolean
  ) => void;
}

// คอมโพเนนต์แสดงวิธีใช้งาน 3 ขั้นตอน พร้อมปุ่มอัปโหลด/วาง pc-report.json ในขั้นตอนที่ 2 ที่ประมวลผลและแสดงผลทันที
export const ScriptDownloader: React.FC<ScriptDownloaderProps> = ({ onLoadReport }) => {
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedFullScript, setCopiedFullScript] = useState(false);
  const [step2Status, setStep2Status] = useState<string | null>(null);
  const scriptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const step2FileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCopyOneLiner = async () => {
    const ok = await copyTextToClipboard(POWERSHELL_RUN_FILE_COMMAND);
    if (ok) {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 3000);
    }
  };

  const handleCopyScript = async () => {
    const ok = await copyTextToClipboard(POWERSHELL_RUN_FILE_COMMAND);
    if (ok) {
      setCopiedFullScript(true);
      setTimeout(() => setCopiedFullScript(false), 3000);
    } else {
      setShowScriptCode(true);
      setTimeout(() => {
        scriptTextareaRef.current?.focus();
        scriptTextareaRef.current?.select();
      }, 100);
    }
  };

  const handleStep2FileChange = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        try {
          const report = parseAndNormalizePCReportJson(content);
          onLoadReport(report, [], 'step2-upload', true);
          setStep2Status(`โหลดไฟล์ ${file.name} และแสดงผลแล้ว!`);
        } catch (err: unknown) {
          setStep2Status(err instanceof Error ? err.message : 'ไฟล์ JSON ไม่ถูกต้อง');
        }
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleStep2PasteClipboard = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const report = parseAndNormalizePCReportJson(text);
          onLoadReport(report, [], 'step2-clipboard', true);
          setStep2Status('วางข้อมูลจาก Clipboard และแสดงผลเรียบร้อยแล้ว!');
          return;
        }
      }
      setStep2Status('กรุณากดปุ่ม Ctrl + V บนคีย์บอร์ดเพื่อวางข้อมูลและแสดงผลทันที');
    } catch {
      setStep2Status('กรุณากดปุ่ม Ctrl + V บนคีย์บอร์ดเพื่อวางข้อมูลและแสดงผลทันที');
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6 no-print">
      {/* ส่วนหัวและปุ่มคัดลอกคำสั่งสแกนทันที */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-4 h-4" />
            <span>ปลอดภัย 100%: โหมดอ่านอย่างเดียว (Read-Only) ประมวลผลและแสดงผลอัตโนมัติ</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            วิธีใช้งาน 3 ขั้นตอน (วางหรืออัปโหลดปุ๊บ ประมวลผลและแสดงผลทันที)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            เมื่อรันคำสั่งใน PowerShell เสร็จ สคริปต์จะคัดลอกผลเข้า Clipboard อัตโนมัติ เพียงกลับมาหน้าเว็บแล้วกด <code className="font-mono font-bold">Ctrl + V</code> (หรืออัปโหลดไฟล์ <code className="font-mono">pc-report.json</code>) ระบบจะประมวลผลและเลื่อนไปแสดงผลทันที
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyScript}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copiedFullScript ? (
              <>
                <Check className="w-4 h-4 text-white" />
                คัดลอกคำสั่งตรวจเครื่องแล้ว! (วางใน PowerShell ได้เลย)
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                คัดลอกคำสั่งไปวางใน PowerShell
              </>
            )}
          </button>

          <button
            type="button"
            onClick={downloadPowerShellScript}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            ดาวน์โหลด pc-check.ps1
          </button>

          <button
            type="button"
            onClick={() => setShowScriptCode(!showScriptCode)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Code2 className="w-4 h-4" />
            {showScriptCode ? 'ซ่อนโค้ด' : 'ดูโค้ดสคริปต์'}
            {showScriptCode ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 3 ขั้นตอนการใช้งาน */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            01. คัดลอกคำสั่งแล้ววางใน PowerShell
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            เปิดโปรแกรม <strong>Windows PowerShell (Run as Administrator)</strong> กดปุ่มคัดลอกคำสั่งด้านล่างนี้ แล้วคลิกขวา (หรือกด <code className="font-mono">Ctrl + V</code>) ในหน้าต่าง PowerShell แล้วกด <strong>Enter</strong>
          </p>
          <div className="flex items-center gap-2 pt-1">
            <code className="flex-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-2 rounded text-slate-800 dark:text-slate-200 truncate">
              [ชุดคำสั่งตรวจเครื่องครบในตัว - กดปุ่มคัดลอก →]
            </code>
            <button
              type="button"
              onClick={handleCopyOneLiner}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-slate-900 dark:bg-slate-700 hover:bg-blue-600 text-white cursor-pointer shrink-0"
            >
              {copiedCmd ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  คัดลอกแล้ว!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  คัดลอกคำสั่ง
                </>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            02. กด Ctrl + V หรือเลือกไฟล์ pc-report.json
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            เมื่อสแกนเสร็จ เพียงกลับมาหน้าเว็บนี้แล้วกด <code className="font-mono font-bold text-blue-600 dark:text-blue-400">Ctrl + V</code> หรือกดปุ่มด้านล่าง ระบบจะประมวลผลและเลื่อนขึ้นไปแสดงผลทันทีอัตโนมัติ
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              ref={step2FileInputRef}
              type="file"
              accept=".json,application/json,text/plain"
              onChange={(e) => {
                handleStep2FileChange(e.target.files?.[0]);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleStep2PasteClipboard}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              วางผลจาก Clipboard ทันที
            </button>
            <button
              type="button"
              onClick={() => step2FileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              เลือกไฟล์ pc-report.json
            </button>
          </div>
          {step2Status && (
            <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400 pt-0.5">
              {step2Status}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            03. ระบบประมวลผลและแสดงผลให้อัตโนมัติ
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            ทันทีที่วางหรืออัปโหลด ระบบจะคำนวณคะแนนสุขภาพรวม 0–100 ประเมินสถานะอะไหล่ทุกชิ้น วิเคราะห์เชิงลึกด้วย <strong className="text-slate-800 dark:text-slate-200">Gemini AI</strong> และเลื่อนหน้าจอขึ้นไปแสดงผลบนหน้าปัดหลักให้อัตโนมัติ
          </p>
        </div>
      </div>

      {/* แสดงโค้ด PowerShell ให้ตรวจสอบความโปร่งใส */}
      {showScriptCode && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-blue-600" />
              โค้ดสคริปต์ตรวจเครื่องฉบับเต็ม (คลิกในกล่องแล้วกด Ctrl+A, Ctrl+C เพื่อคัดลอกไปวางใน PowerShell ได้ทันที)
            </span>
            <button
              type="button"
              onClick={handleCopyScript}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              {copiedFullScript ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  คัดลอกโค้ดทั้งหมดแล้ว
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  คัดลอกโค้ด PowerShell
                </>
              )}
            </button>
          </div>
          <textarea
            ref={scriptTextareaRef}
            readOnly
            value={POWERSHELL_SCRIPT_CONTENT}
            onClick={(e) => e.currentTarget.select()}
            rows={14}
            className="w-full p-4 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed focus:outline-none border border-slate-800"
          />
        </div>
      )}
    </section>
  );
};
