import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  PlayCircle,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  ClipboardPaste,
  ShieldCheck,
} from 'lucide-react';
import { PCReport, SymptomKey } from '../types/pcHealth';
import { DEMO_PRESETS, SAMPLE_CRYSTALDISK_TEXT } from '../data/demoReports';

interface ReportUploaderProps {
  activePresetId: string | null;
  stripPersonalInfo: boolean;
  onChangeStripPersonalInfo: (val: boolean) => void;
  onLoadReport: (
    report: PCReport,
    defaultSymptoms?: SymptomKey[],
    presetId?: string,
    autoRunAI?: boolean
  ) => void;
}

// แปลงผลลัพธ์จากการแยกค่าด้วย AI หรือ Regex ให้เป็นโครงสร้าง PCReport มาตรฐาน
export function convertParsedRawToPCReport(parsed: Record<string, any>): PCReport {
  const disks = Array.isArray(parsed.disks)
    ? parsed.disks.map((d: any, idx: number) => ({
        id: String(idx),
        friendlyName: d.friendlyName || `Disk #${idx}`,
        mediaType: d.mediaType || 'SSD',
        healthStatus: d.healthStatus || 'Healthy',
        sizeGB: typeof d.sizeGB === 'number' ? d.sizeGB : null,
        wearPercent: typeof d.wearPercent === 'number' ? d.wearPercent : null,
        temperatureC: typeof d.temperatureC === 'number' ? d.temperatureC : null,
        readErrorsTotal: typeof d.readErrorsTotal === 'number' ? d.readErrorsTotal : null,
        writeErrorsTotal: typeof d.writeErrorsTotal === 'number' ? d.writeErrorsTotal : null,
        reallocatedSectors: typeof d.reallocatedSectors === 'number' ? d.reallocatedSectors : null,
        powerOnHours: typeof d.powerOnHours === 'number' ? d.powerOnHours : null,
      }))
    : [];

  const designCap =
    typeof parsed.batteryDesignCapacitymWh === 'number' ? parsed.batteryDesignCapacitymWh : null;
  const fullCap =
    typeof parsed.batteryFullChargedCapacitymWh === 'number'
      ? parsed.batteryFullChargedCapacitymWh
      : null;
  const batHealth =
    designCap && fullCap && designCap > 0
      ? Math.round((fullCap / designCap) * 1000) / 10
      : null;

  return {
    reportVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    source: 'raw_paste',
    machineId: 'PASTED-REPORT-PC',
    cpu: {
      model: parsed.cpuModel || null,
      cores: typeof parsed.cpuCores === 'number' ? parsed.cpuCores : null,
      logicalProcessors: null,
      maxClockMHz: null,
      loadPercent: typeof parsed.cpuLoadPercent === 'number' ? parsed.cpuLoadPercent : null,
      temperatureC: typeof parsed.cpuTempC === 'number' ? parsed.cpuTempC : null,
    },
    ram: {
      totalGB: typeof parsed.ramTotalGB === 'number' ? parsed.ramTotalGB : null,
      usedGB: null,
      usagePercent: typeof parsed.ramUsagePercent === 'number' ? parsed.ramUsagePercent : null,
      speedMHz: typeof parsed.ramSpeedMHz === 'number' ? parsed.ramSpeedMHz : null,
      slotsUsed: null,
      slotsTotal: null,
      memoryDiagnosticResult: 'None',
    },
    disks,
    logicalDrives: [],
    gpu: {
      name: parsed.gpuName || null,
      driverVersion: null,
      driverDate: parsed.gpuDriverDate || null,
      vramGB: null,
      status: 'OK',
      temperatureC: typeof parsed.gpuTempC === 'number' ? parsed.gpuTempC : null,
      tdrCrashCount30Days: 0,
    },
    battery: {
      hasBattery: Boolean(parsed.hasBattery || (designCap && fullCap)),
      name: 'Battery (จากรายงานข้อความ)',
      designCapacitymWh: designCap,
      fullChargedCapacitymWh: fullCap,
      healthPercent: batHealth,
      cycleCount: typeof parsed.batteryCycleCount === 'number' ? parsed.batteryCycleCount : null,
    },
    mainboard: {
      boardManufacturer: null,
      boardProduct: parsed.boardModel || null,
      biosVersion: parsed.biosVersion || null,
      biosDate: null,
    },
    cooling: {
      fanSpeedRPM: null,
      fanStatus: null,
      thermalZonesC: typeof parsed.cpuTempC === 'number' ? [parsed.cpuTempC] : [],
      maxTempC: typeof parsed.cpuTempC === 'number' ? parsed.cpuTempC : null,
    },
    eventLogs: {
      diskErrorsCount: 0,
      wheaErrorsCount: 0,
      kernelPower41Count: 0,
      bugCheck1001Count: 0,
      appCrashHangCount: 0,
      ntfsErrorsCount: 0,
      gpuDriverCrashCount: 0,
      categories: [],
    },
    system: {
      osName: parsed.osName || 'Windows (ข้อมูลจากข้อความที่วาง)',
      osVersion: null,
      uptimeDays: null,
      startupProgramsCount: null,
      windowsUpdateStatus: 'Unknown',
    },
  };
}

// ตรวจสอบและแปลงข้อความ JSON ให้เป็นโครงสร้าง PCReport มาตรฐาน
export function parseAndNormalizePCReportJson(text: string): PCReport {
  const cleanText = text.replace(/^\uFEFF/, '').trim();

  if (
    cleanText.includes('ParserError') ||
    cleanText.includes('Missing ] at end of attribute') ||
    cleanText.includes('Unexpected token') ||
    cleanText.includes('not found in Downloads or Desktop')
  ) {
    throw new Error(
      'ข้อความนี้คือแจ้งเตือน Error จากหน้าต่าง PowerShell กรุณากดปุ่ม "คัดลอกคำสั่งไปวางใน PowerShell" ด้านบนใหม่'
    );
  }

  // รองรับกรณีมีข้อความอื่นปนอยู่ก่อนหรือหลังปีกกา JSON { ... }
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  const jsonCandidate =
    firstBrace !== -1 && lastBrace > firstBrace
      ? cleanText.slice(firstBrace, lastBrace + 1)
      : cleanText;

  const data = JSON.parse(jsonCandidate);

  if (typeof data !== 'object' || data === null) {
    throw new Error('โครงสร้างไฟล์ JSON ไม่ถูกต้อง');
  }

  if (!data.cpu && !data.ram && !data.disks && !data.system) {
    throw new Error(
      'ข้อมูล JSON นี้ไม่มีส่วนประกอบของฮาร์ดแวร์ (cpu, ram, disks, system) กรุณาใช้ผลลัพธ์ที่ได้จากสคริปต์ตรวจเครื่อง'
    );
  }

  return {
    reportVersion: data.reportVersion || '1.0.0',
    generatedAt: data.generatedAt || new Date().toISOString(),
    source: 'powershell',
    machineId: data.machineId || data.system?.computerName || 'USER-PC',
    cpu: data.cpu || {
      model: null,
      cores: null,
      logicalProcessors: null,
      maxClockMHz: null,
      loadPercent: null,
      temperatureC: null,
    },
    ram: data.ram || {
      totalGB: null,
      usedGB: null,
      usagePercent: null,
      speedMHz: null,
      slotsUsed: null,
      slotsTotal: null,
      memoryDiagnosticResult: null,
    },
    disks: Array.isArray(data.disks) ? data.disks : [],
    logicalDrives: Array.isArray(data.logicalDrives) ? data.logicalDrives : [],
    gpu: data.gpu || {
      name: null,
      driverVersion: null,
      driverDate: null,
      vramGB: null,
      status: null,
      temperatureC: null,
    },
    battery: data.battery || {
      hasBattery: false,
      designCapacitymWh: null,
      fullChargedCapacitymWh: null,
      healthPercent: null,
      cycleCount: null,
    },
    mainboard: data.mainboard || {
      boardManufacturer: null,
      boardProduct: null,
      biosVersion: null,
      biosDate: null,
    },
    cooling: data.cooling || {
      fanSpeedRPM: null,
      fanStatus: null,
      thermalZonesC: [],
      maxTempC: null,
    },
    eventLogs: data.eventLogs || {
      diskErrorsCount: 0,
      wheaErrorsCount: 0,
      kernelPower41Count: 0,
      bugCheck1001Count: 0,
      appCrashHangCount: 0,
      ntfsErrorsCount: 0,
      gpuDriverCrashCount: 0,
      categories: [],
    },
    system: data.system || {
      osName: null,
      osVersion: null,
      uptimeDays: null,
      startupProgramsCount: null,
      windowsUpdateStatus: 'Unknown',
    },
  };
}

// คอมโพเนนต์อัปโหลดหรือวาง pc-report.json ที่ประมวลผลอัตโนมัติและเลื่อนไปแสดงผลทันที
export const ReportUploader: React.FC<ReportUploaderProps> = ({
  activePresetId,
  stripPersonalInfo,
  onChangeStripPersonalInfo,
  onLoadReport,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'demo'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [quickPasteJson, setQuickPasteJson] = useState('');
  const [isParsingRaw, setIsParsingRaw] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validateAndLoadJson = useCallback(
    (text: string, sourceName?: string) => {
      setErrorMsg(null);
      setSuccessMsg(null);
      try {
        const normalizedReport = parseAndNormalizePCReportJson(text);
        // โหลดรายงาน + สั่งรัน AI วิเคราะห์อัตโนมัติ + เลื่อนหน้าจอไปที่ Dashboard ทันที
        onLoadReport(normalizedReport, [], 'uploaded-report', true);
        setSuccessMsg(
          `ประมวลผลข้อมูลจาก ${sourceName || 'pc-report.json'} และแสดงผลบนหน้าปัดหลักอัตโนมัติเรียบร้อยแล้ว!`
        );
        setQuickPasteJson('');
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'ไม่สามารถอ่านข้อมูลได้ กรุณาตรวจสอบว่าเป็นไฟล์หรือข้อความ pc-report.json ที่ถูกต้อง';
        setErrorMsg(`ข้อผิดพลาดในการอ่านข้อมูล: ${msg}`);
      }
    },
    [onLoadReport]
  );

  // แยกค่าข้อความจากโปรแกรมอื่น (CrystalDiskInfo / HWiNFO) แล้วแสดงผลอัตโนมัติ
  const parseRawTextAndAutoDisplay = useCallback(
    async (inputText: string) => {
      const trimmed = inputText.replace(/^\uFEFF/, '').trim();
      if (!trimmed) return;

      // หากข้อความที่วางเป็น JSON ของ pc-report.json ให้ประมวลผลทันทีโดยไม่ต้องรอ API
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        validateAndLoadJson(trimmed, 'การวางข้อมูล JSON');
        return;
      }

      if (
        trimmed.includes('ParserError') ||
        trimmed.includes('Missing ] at end of attribute') ||
        trimmed.includes('EndSquareBracketExpectedAtEndOfAttribute') ||
        trimmed.includes('not found in Downloads or Desktop')
      ) {
        setErrorMsg(
          'ข้อความที่คุณวางคือแจ้งเตือนจาก PowerShell กรุณากดปุ่ม "คัดลอกคำสั่งไปวางใน PowerShell" ด้านบนใหม่'
        );
        return;
      }

      setErrorMsg(null);
      setSuccessMsg(null);
      setIsParsingRaw(true);

      try {
        const response = await fetch('/api/parse-raw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText: trimmed }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.details || data.error || 'ไม่สามารถแยกค่าจากข้อความได้');
        }

        const report = convertParsedRawToPCReport(data);
        onLoadReport(report, [], 'raw-parsed-report', true);
        setSuccessMsg('แยกค่าฮาร์ดแวร์ ประมวลผล และแสดงผลบนหน้าปัดหลักอัตโนมัติสำเร็จแล้ว!');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการแยกข้อมูล';
        setErrorMsg(msg);
      } finally {
        setIsParsingRaw(false);
      }
    },
    [onLoadReport, validateAndLoadJson]
  );

  // ดักจับการกด Ctrl+V (Paste) หรือลากไฟล์วางจากทุกจุดในหน้าเว็บเพื่อประมวลผลอัตโนมัติทันที
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const pasted = e.clipboardData?.getData('text');
      if (!pasted) return;
      const trimmed = pasted.replace(/^\uFEFF/, '').trim();

      // ถ้าเป็น JSON รายงานตรวจเครื่อง ไม่ว่าจะโฟกัสอยู่ที่ไหน ให้ประมวลผลและแสดงผลทันที!
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (
        firstBrace !== -1 &&
        lastBrace > firstBrace &&
        (trimmed.includes('"reportVersion"') ||
          trimmed.includes('"disks"') ||
          trimmed.includes('"cpu"'))
      ) {
        e.preventDefault();
        validateAndLoadJson(trimmed, 'การวางข้อมูล (Ctrl+V)');
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const content = ev.target?.result;
            if (typeof content === 'string') {
              validateAndLoadJson(content, file.name);
            }
          };
          reader.readAsText(file, 'utf-8');
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [validateAndLoadJson]);

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        // อัปโหลดไฟล์ปุ๊บ ประมวลผลทั้ง JSON หรือ Raw Text ทันที
        const trimmed = content.replace(/^\uFEFF/, '').trim();
        if (trimmed.startsWith('{') || trimmed.includes('"cpu"')) {
          validateAndLoadJson(trimmed, file.name);
        } else {
          setRawText(trimmed);
          parseRawTextAndAutoDisplay(trimmed);
        }
      }
    };
    reader.onerror = () => {
      setErrorMsg('เกิดข้อผิดพลาดขณะอ่านไฟล์จากเครื่องของคุณ');
    };
    reader.readAsText(file, 'utf-8');
  };

  // ปุ่มดึงข้อมูลจาก Clipboard โดยตรง (กรณีผู้ใช้ไม่อยากกด Ctrl+V เอง)
  const handleReadClipboardDirectly = async () => {
    setErrorMsg(null);
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const trimmed = text.replace(/^\uFEFF/, '').trim();
          if (trimmed.startsWith('{') || trimmed.includes('"cpu"')) {
            validateAndLoadJson(trimmed, 'Clipboard');
          } else {
            setRawText(trimmed);
            parseRawTextAndAutoDisplay(trimmed);
          }
          return;
        }
      }
      setErrorMsg(
        'เบราว์เซอร์ขอสิทธิ์วางข้อมูล กรุณาคลิกในช่องวางข้อมูลด้านล่างแล้วกด Ctrl + V เพื่อประมวลผลทันทีครับ'
      );
    } catch {
      setErrorMsg(
        'กรุณาคลิกในช่อง "วางข้อมูล JSON ที่นี่" ด้านล่างแล้วกดปุ่ม Ctrl + V บนคีย์บอร์ด ระบบจะประมวลผลให้อัตโนมัติทันทีครับ'
      );
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 no-print">
      {/* แถบเลือกโหมดนำเข้าข้อมูล */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            วางหรืออัปโหลด <code className="font-mono text-blue-600 dark:text-blue-400">pc-report.json</code> (ประมวลผลและแสดงผลอัตโนมัติทันที)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ลากไฟล์มาวาง เลือกไฟล์ หรือกด <code className="font-mono font-semibold">Ctrl + V</code> เพื่อวางข้อมูลจากสคริปต์ ระบบจะคำนวณคะแนน วิเคราะห์ด้วย AI และเลื่อนไปแสดงผลทันทีโดยไม่ต้องกดปุ่มซ้ำ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* ตัวเลือกปกป้องความเป็นส่วนตัวอัตโนมัติ */}
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-slate-50 dark:bg-slate-800/70 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <input
              type="checkbox"
              checked={stripPersonalInfo}
              onChange={(e) => onChangeStripPersonalInfo(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>ซ่อนชื่อเครื่อง/Serial อัตโนมัติเมื่อวิเคราะห์ AI</span>
          </label>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setActiveTab('upload');
                setErrorMsg(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              อัปโหลด / วาง pc-report.json
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('paste');
                setErrorMsg(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'paste'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              วางข้อความโปรแกรมอื่น
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('demo');
                setErrorMsg(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'demo'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              โหมดตัวอย่าง (Demo Data)
            </button>
          </div>
        </div>
      </div>

      {/* แสดงข้อความแจ้งเตือน Error หรือ Success */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* แท็บที่ 1: อัปโหลดไฟล์ pc-report.json หรือวาง JSON ประมวลผลอัตโนมัติทันที */}
      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* กล่องซ้าย: ลากวางไฟล์ หรือคลิกเลือกไฟล์ pc-report.json */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              const droppedFile = e.dataTransfer.files?.[0];
              handleFileSelect(droppedFile);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json,text/plain"
              onChange={(e) => {
                handleFileSelect(e.target.files?.[0]);
                e.target.value = '';
              }}
              className="hidden"
            />
            <UploadCloud className="w-9 h-9 text-blue-600 dark:text-blue-400 mb-2.5" />
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              คลิกเลือกไฟล์ หรือลาก <code className="font-mono text-blue-600 dark:text-blue-400">pc-report.json</code> มาวางที่นี่
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              เมื่อเลือกไฟล์หรือปล่อยเมาส์ ระบบจะประมวลผลและแสดงผลตรวจทันทีอัตโนมัติ
            </p>
          </div>

          {/* กล่องขวา: วางข้อมูล JSON (Ctrl+V) แล้วประมวลผลอัตโนมัติทันทีโดยไม่ต้องกดปุ่ม */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 flex flex-col justify-between space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ClipboardPaste className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>หรือวางข้อมูล (Ctrl + V) ในช่องนี้เพื่อประมวลผลทันที</span>
              </div>
              <button
                type="button"
                onClick={handleReadClipboardDirectly}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                วางจาก Clipboard อัตโนมัติ
              </button>
            </div>

            <textarea
              value={quickPasteJson}
              onChange={(e) => {
                const val = e.target.value;
                setQuickPasteJson(val);
                const trimmed = val.replace(/^\uFEFF/, '').trim();
                // ทันทีที่วางข้อมูล JSON หรือข้อความรายงาน ให้ประมวลผลและแสดงผลอัตโนมัติทันที
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                  validateAndLoadJson(trimmed, 'ช่องวางข้อมูลด่วน');
                } else if (trimmed.length > 60 && (trimmed.includes('Model') || trimmed.includes('CPU'))) {
                  setRawText(trimmed);
                  parseRawTextAndAutoDisplay(trimmed);
                }
              }}
              rows={3}
              placeholder="คลิกช่องนี้แล้วกด Ctrl + V (วางผลจาก PowerShell หรือเนื้อหาในไฟล์ pc-report.json) ระบบจะนำไปประมวลผลและแสดงผลทันทีโดยไม่ต้องกดปุ่มใด ๆ..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* แท็บที่ 2: วางข้อความจากโปรแกรม CrystalDiskInfo, HWiNFO, battery-report (ประมวลผลอัตโนมัติเมื่อวาง) */}
      {activeTab === 'paste' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              วางข้อความจากโปรแกรม CrystalDiskInfo, HWiNFO หรือ Battery Report (วางปุ๊บประมวลผลอัตโนมัติทันที)
            </label>
            <button
              type="button"
              onClick={() => {
                setRawText(SAMPLE_CRYSTALDISK_TEXT);
                parseRawTextAndAutoDisplay(SAMPLE_CRYSTALDISK_TEXT);
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
            >
              คลิกเพื่อลองวางและประมวลผลข้อความตัวอย่าง (CrystalDiskInfo + HWiNFO) อัตโนมัติ
            </button>
          </div>

          <textarea
            value={rawText}
            onPaste={(e) => {
              const pastedText = e.clipboardData?.getData('text');
              if (pastedText && pastedText.trim()) {
                e.preventDefault();
                setRawText(pastedText);
                parseRawTextAndAutoDisplay(pastedText);
              }
            }}
            onChange={(e) => setRawText(e.target.value)}
            rows={5}
            placeholder="กด Ctrl + V วางข้อความรายงานที่นี่ ระบบจะสกัดค่าฮาร์ดแวร์และแสดงผลบนหน้าปัดหลักให้อัตโนมัติทันที..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isParsingRaw
                ? 'กำลังสกัดค่าตัวเลขฮาร์ดแวร์และอัปเดตหน้าปัดหลักอัตโนมัติ...'
                : 'เมื่อวางข้อความ (Ctrl+V) ระบบจะประมวลผลให้อัตโนมัติ หรือกดปุ่มด้านขวาหากต้องการประมวลผลซ้ำ'}
            </span>
            <button
              type="button"
              onClick={() => parseRawTextAndAutoDisplay(rawText)}
              disabled={isParsingRaw || !rawText.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              {isParsingRaw ? 'กำลังประมวลผลอัตโนมัติ...' : 'ประมวลผลข้อความนี้'}
            </button>
          </div>
        </div>
      )}

      {/* แท็บที่ 3 (และแถบด่วน): โหมดตัวอย่าง (Demo Data) */}
      {(activeTab === 'demo' || activeTab === 'upload') && (
        <div className="pt-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
            <PlayCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>หรือคลิกเลือกข้อมูลจำลองสถานการณ์จริง (Demo Cases) เพื่อประมวลผลและแสดงผลทันที:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DEMO_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    onLoadReport(preset.report, preset.defaultSymptoms, preset.id, true);
                  }}
                  className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-600 dark:border-blue-500'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      {preset.badge}
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {preset.title}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                      {preset.description}
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-3">
                    {isSelected ? 'กำลังแสดงผลเคสนี้' : 'คลิกเพื่อจำลองผลตรวจ →'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
