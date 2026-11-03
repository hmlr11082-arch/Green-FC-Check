import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Sun,
  Moon,
  Download,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Upload,
  ExternalLink,
  DownloadCloud,
  Copy,
  Check,
} from 'lucide-react';
import {
  AIAnalysisResult,
  EvaluatedComponent,
  MaintenanceItem,
  PCReport,
  ScanHistoryItem,
  SymptomKey,
} from './types/pcHealth';
import { DEMO_PRESETS } from './data/demoReports';
import {
  evaluatePCReport,
  formatTechnicianSummaryText,
  mergeAIWithRuleEvaluation,
  sanitizeReportForAI,
} from './utils/ruleEvaluator';
import {
  copyTextToClipboard,
  downloadPowerShellScript,
} from './utils/powershellScript';
import { getDriverUpdateLinksForComponent } from './utils/driverLinks';
import { ScoreGauge } from './components/ScoreGauge';
import { ComponentCard, getStatusMeta } from './components/ComponentCard';
import { SymptomSelector } from './components/SymptomSelector';
import { CauseList } from './components/CauseList';
import { ScriptDownloader } from './components/ScriptDownloader';
import {
  parseAndNormalizePCReportJson,
  ReportUploader,
} from './components/ReportUploader';
import { BrowserProbe } from './components/BrowserProbe';
import { HistoryChart } from './components/HistoryChart';
import {
  DEFAULT_MAINTENANCE_ITEMS,
  MaintenanceChecklist,
} from './components/MaintenanceChecklist';
import { AiConsentModal } from './components/AiConsentModal';
import { AiChatDrawer } from './components/AiChatDrawer';
import { ComponentDetailModal } from './components/ComponentDetailModal';

const STORAGE_KEY_HISTORY = 'pc_health_doctor_history_v1';
const STORAGE_KEY_CHECKLIST = 'pc_health_doctor_checklist_v1';
const STORAGE_KEY_THEME = 'pc_health_doctor_theme_v1';

export default function App() {
  // ธีมสว่าง / มืด
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_THEME) === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEY_THEME, darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage error
    }
  }, [darkMode]);

  // รายงานปัจจุบัน อาการที่เลือก และผลจาก Gemini AI
  const [activePresetId, setActivePresetId] = useState<string | null>(DEMO_PRESETS[0].id);
  const [currentReport, setCurrentReport] = useState<PCReport>(DEMO_PRESETS[0].report);
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomKey[]>(
    DEMO_PRESETS[0].defaultSymptoms
  );
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [autoLoadedBanner, setAutoLoadedBanner] = useState<string | null>(null);
  const [copiedWinget, setCopiedWinget] = useState(false);

  // ตัวกรองการ์ดอะไหล่
  const [componentFilter, setComponentFilter] = useState<'all' | 'issues' | 'normal'>('all');

  // หน้าต่าง Modal และ Drawer
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [stripPersonalInfo, setStripPersonalInfo] = useState(true);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [selectedComponentDetail, setSelectedComponentDetail] =
    useState<EvaluatedComponent | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const topQuickFileInputRef = useRef<HTMLInputElement | null>(null);

  // ประวัติการสแกนใน localStorage
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    const initialEval = evaluatePCReport(DEMO_PRESETS[0].report, DEMO_PRESETS[0].defaultSymptoms);
    const prevDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    return [
      {
        id: 'init-current',
        timestamp: DEMO_PRESETS[0].report.generatedAt,
        machineLabel: DEMO_PRESETS[0].report.machineId || 'WORKSTATION-01',
        source: 'demo',
        overallScore: initialEval.overallScore,
        summary: initialEval.summary,
        maxSsdWearPercent: 84,
        batteryHealthPercent: null,
        cpuTempC: 88,
        ramUsagePercent: 71.2,
        diskRisk: true,
        reportSnapshot: DEMO_PRESETS[0].report,
      },
      {
        id: 'init-prev',
        timestamp: prevDate,
        machineLabel: 'WORKSTATION-01 (2 สัปดาห์ก่อน)',
        source: 'demo',
        overallScore: 76,
        summary: 'เครื่องใช้งานได้ปกติ แต่ SSD เริ่มมีความเสื่อมสะสม',
        maxSsdWearPercent: 77,
        batteryHealthPercent: null,
        cpuTempC: 79,
        ramUsagePercent: 65.0,
        diskRisk: true,
        reportSnapshot: DEMO_PRESETS[0].report,
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(scanHistory));
    } catch {
      // ignore
    }
  }, [scanHistory]);

  // Checklist บำรุงรักษาเครื่องใน localStorage
  const [checklistItems, setChecklistItems] = useState<MaintenanceItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHECKLIST);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_MAINTENANCE_ITEMS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHECKLIST, JSON.stringify(checklistItems));
    } catch {
      // ignore
    }
  }, [checklistItems]);

  // คำนวณผลประเมิน Rule-based และรวมกับผล AI (ถ้ามี)
  const baseRuleEvaluation = useMemo(
    () => evaluatePCReport(currentReport, selectedSymptoms),
    [currentReport, selectedSymptoms]
  );

  const finalEvaluation = useMemo(() => {
    if (!aiAnalysis) return baseRuleEvaluation;
    return mergeAIWithRuleEvaluation(baseRuleEvaluation, aiAnalysis);
  }, [baseRuleEvaluation, aiAnalysis]);

  // อะไหล่ที่ต้องเฝ้าระวัง เรียงจากอันตรายสุด (critical 🔴 -> warning 🟡)
  const watchlistComponents = useMemo(() => {
    return finalEvaluation.components
      .filter((c) => c.status === 'critical' || c.status === 'warning')
      .sort((a, b) => {
        if (a.status === 'critical' && b.status !== 'critical') return -1;
        if (a.status !== 'critical' && b.status === 'critical') return 1;
        return 0;
      });
  }, [finalEvaluation.components]);

  // กรองการ์ดอะไหล่ตามปุ่มแท็บ
  const filteredComponents = useMemo(() => {
    if (componentFilter === 'issues') {
      return finalEvaluation.components.filter(
        (c) => c.status === 'critical' || c.status === 'warning'
      );
    }
    if (componentFilter === 'normal') {
      return finalEvaluation.components.filter((c) => c.status === 'normal');
    }
    return finalEvaluation.components;
  }, [finalEvaluation.components, componentFilter]);

  // รวบรวมลิงก์อัปเดตไดรเวอร์และเฟิร์มแวร์ที่ตรงกับอะไหล่ของเครื่องนี้ทั้งหมด
  const machineDriverLinks = useMemo(() => {
    const items: {
      componentName: string;
      modelName: string;
      status: EvaluatedComponent['status'];
      label: string;
      provider: string;
      url: string;
      description?: string;
    }[] = [];
    const seenUrls = new Set<string>();

    finalEvaluation.components.forEach((comp) => {
      const links = getDriverUpdateLinksForComponent(comp);
      links.forEach((l) => {
        if (!seenUrls.has(l.url)) {
          seenUrls.add(l.url);
          items.push({
            componentName: comp.name,
            modelName: comp.modelName,
            status: comp.status,
            label: l.label,
            provider: l.provider,
            url: l.url,
            description: l.description,
          });
        }
      });
    });

    return items;
  }, [finalEvaluation.components]);

  // ฟังก์ชันส่งวิเคราะห์ด้วย AI (รับพารามิเตอร์โดยตรงเพื่อเรียกอัตโนมัติได้ทันทีเมื่ออัปโหลดหรือวางไฟล์)
  const runAIAnalysisForReport = useCallback(
    async (reportToAnalyze: PCReport, symptomsToAnalyze: SymptomKey[]) => {
      setIsAnalyzingAI(true);
      setAiError(null);

      try {
        const ruleEval = evaluatePCReport(reportToAnalyze, symptomsToAnalyze);
        const sanitizedReport = sanitizeReportForAI(reportToAnalyze, stripPersonalInfo);
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report: sanitizedReport,
            ruleEvaluation: ruleEval,
            selectedSymptoms: symptomsToAnalyze,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.details || data.error || 'การวิเคราะห์ด้วย AI ล้มเหลว');
        }

        setAiAnalysis(data as AIAnalysisResult);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อกับ Gemini API ได้ในขณะนี้';
        setAiError(message);
      } finally {
        setIsAnalyzingAI(false);
      }
    },
    [stripPersonalInfo]
  );

  // บันทึกรายงานลงประวัติการสแกน
  const recordScanToHistory = useCallback((report: PCReport, symptoms: SymptomKey[]) => {
    const evalResult = evaluatePCReport(report, symptoms);
    const ssdWears = (report.disks || [])
      .map((d) => d.wearPercent)
      .filter((w): w is number => typeof w === 'number');
    const maxWear = ssdWears.length > 0 ? Math.max(...ssdWears) : null;

    const newEntry: ScanHistoryItem = {
      id: `scan-${Date.now()}`,
      timestamp: report.generatedAt || new Date().toISOString(),
      machineLabel:
        report.system?.computerName || report.machineId || 'เครื่องคอมพิวเตอร์ของคุณ',
      source: report.source,
      overallScore: evalResult.overallScore,
      summary: evalResult.summary,
      maxSsdWearPercent: maxWear,
      batteryHealthPercent: report.battery?.healthPercent ?? null,
      cpuTempC: report.cpu?.temperatureC ?? report.cooling?.maxTempC ?? null,
      ramUsagePercent: report.ram?.usagePercent ?? null,
      diskRisk: evalResult.hasDiskRisk,
      reportSnapshot: report,
    };

    setScanHistory((prev) => [newEntry, ...prev.slice(0, 14)]);
  }, []);

  // โหลดรายงานใหม่เข้าสู่ระบบ + ประมวลผลอัตโนมัติ + เลื่อนขึ้นไปแสดงผลที่ Dashboard อัตโนมัติ
  const handleLoadReport = useCallback(
    (
      report: PCReport,
      defaultSymptoms: SymptomKey[] = [],
      presetId?: string,
      autoRunAI = true
    ) => {
      setCurrentReport(report);
      setSelectedSymptoms(defaultSymptoms);
      setActivePresetId(presetId || null);
      setAiAnalysis(null);
      setAiError(null);
      setComponentFilter('all');
      recordScanToHistory(report, defaultSymptoms);

      const dashEl = document.getElementById('dashboard');
      if (dashEl) {
        dashEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      const machineTitle =
        report.system?.computerName || report.machineId || 'เครื่องคอมพิวเตอร์ของคุณ';
      setAutoLoadedBanner(
        `นำค่าจาก "${machineTitle}" มาประมวลผลและแสดงผลบนหน้าจอหลักอัตโนมัติเรียบร้อยแล้ว`
      );
      setTimeout(() => {
        setAutoLoadedBanner((prev) =>
          prev?.includes(machineTitle) ? null : prev
        );
      }, 6000);

      if (autoRunAI) {
        runAIAnalysisForReport(report, defaultSymptoms);
      }
    },
    [recordScanToHistory, runAIAnalysisForReport]
  );

  // สลับการเลือกอาการผิดปกติ
  const handleToggleSymptom = (key: SymptomKey) => {
    setSelectedSymptoms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // ส่งข้อมูลให้ Gemini AI วิเคราะห์เมื่อผู้ใช้กดยืนยันจากหน้าต่างความเป็นส่วนตัว
  const handleConfirmAIAnalysis = async () => {
    setShowConsentModal(false);
    await runAIAnalysisForReport(currentReport, selectedSymptoms);
  };

  // คัดลอกสรุปรายงานส่งให้ช่างคอมพิวเตอร์
  const handleCopyTechnicianSummary = async () => {
    const text = formatTechnicianSummaryText(
      currentReport,
      finalEvaluation,
      selectedSymptoms
    );
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    }
  };

  const handleCopyWingetUpgrade = async () => {
    const ok = await copyTextToClipboard(
      'winget upgrade --all --include-unknown'
    );
    if (ok) {
      setCopiedWinget(true);
      setTimeout(() => setCopiedWinget(false), 2500);
    }
  };

  // จำลองจุดข้อมูลในประวัติเพื่อทดสอบการเปรียบเทียบแนวโน้ม
  const handleAddSimulatedTrendPoint = () => {
    const latest = scanHistory[0];
    if (!latest) return;
    const simulatedWear =
      latest.maxSsdWearPercent !== null ? Math.min(99, latest.maxSsdWearPercent + 4) : 62;
    const simulatedBat =
      latest.batteryHealthPercent !== null ? Math.max(30, latest.batteryHealthPercent - 5) : null;
    const simulatedTemp =
      latest.cpuTempC !== null ? Math.min(98, latest.cpuTempC + 6) : 86;
    const simulatedScore = Math.max(15, latest.overallScore - 8);

    const newPoint: ScanHistoryItem = {
      id: `sim-${Date.now()}`,
      timestamp: new Date().toISOString(),
      machineLabel: `${latest.machineLabel} (สแกนติดตามผล)`,
      source: latest.source,
      overallScore: simulatedScore,
      summary: 'ตรวจพบความเสื่อมของอะไหล่เพิ่มขึ้นจากการสแกนครั้งก่อน',
      maxSsdWearPercent: simulatedWear,
      batteryHealthPercent: simulatedBat,
      cpuTempC: simulatedTemp,
      ramUsagePercent: latest.ramUsagePercent,
      diskRisk: true,
      reportSnapshot: latest.reportSnapshot,
    };

    setScanHistory((prev) => [newPoint, ...prev.slice(0, 14)]);
  };

  const handleToggleChecklistItem = (id: string) => {
    setChecklistItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              checked: !item.checked,
              lastDoneDate: !item.checked
                ? new Date().toLocaleDateString('th-TH', { dateStyle: 'medium' })
                : null,
            }
          : item
      )
    );
  };

  const getSourceLabel = (source: PCReport['source']) => {
    switch (source) {
      case 'powershell':
        return 'สคริปต์ PowerShell (pc-report.json)';
      case 'raw_paste':
        return 'ข้อความจากโปรแกรมตรวจฮาร์ดแวร์';
      case 'browser_only':
        return 'Browser API (ตรวจด่วนผ่านเบราว์เซอร์)';
      case 'demo':
      default:
        return 'โหมดข้อมูลตัวอย่าง (Demo Data)';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar Contract: 3 โซนสะอาดตา (Brand | Nav Links | 1 Primary CTA) */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <a
            href="#dashboard"
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            PC Health Doctor
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#dashboard"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              หน้าจอหลัก
            </a>
            <a
              href="#driver-updates"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              อัปเดตไดรเวอร์
            </a>
            <a
              href="#how-to-use"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              วิธีใช้งาน 3 ขั้นตอน
            </a>
            <a
              href="#history-trends"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              กราฟแนวโน้ม
            </a>
            <a
              href="#maintenance"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              บำรุงรักษาเครื่อง
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={downloadPowerShellScript}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              ดาวน์โหลดสคริปต์ตรวจเครื่อง
            </button>
          </div>
        </div>
      </header>

      {/* พื้นที่เนื้อหาหลัก */}
      <main id="dashboard" className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* แถบเครื่องมือด้านบน: ปุ่มอัปโหลดด่วน / กด Ctrl+V ได้ทุกที่ และสลับโหมดสว่าง/มืด */}
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            เคล็ดลับ: กด <strong className="text-slate-900 dark:text-slate-200">Ctrl + V</strong> หรือลากไฟล์ <code className="font-mono font-semibold text-blue-600 dark:text-blue-400">pc-report.json</code> มาวางตรงไหนของหน้าเว็บก็ได้ ระบบจะประมวลผลและแสดงผลทันที
          </div>
          <div className="flex items-center gap-2.5">
            <input
              ref={topQuickFileInputRef}
              type="file"
              accept=".json,application/json,text/plain"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const content = ev.target?.result;
                    if (typeof content === 'string') {
                      try {
                        const parsed = parseAndNormalizePCReportJson(content);
                        handleLoadReport(parsed, [], 'quick-top-upload', true);
                      } catch {
                        document.getElementById('how-to-use')?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }
                  };
                  reader.readAsText(file, 'utf-8');
                }
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => topQuickFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              อัปโหลด pc-report.json ด่วน
            </button>

            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  โหมดสว่าง (Light)
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  โหมดมืด (Dark)
                </>
              )}
            </button>
          </div>
        </div>

        {/* แถบยืนยันเมื่อระบบนำข้อมูลที่วางหรืออัปโหลดมาประมวลผลอัตโนมัติ */}
        {autoLoadedBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-medium flex items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{autoLoadedBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setAutoLoadedBanner(null)}
              className="underline text-emerald-700 dark:text-emerald-300 cursor-pointer shrink-0"
            >
              รับทราบ
            </button>
          </div>
        )}

        {/* แบนเนอร์สีแดงด้านบนสุด "สำรองข้อมูลทันที" เมื่อดิสก์มีสัญญาณเสี่ยง */}
        {finalEvaluation.hasDiskRisk && (
          <div
            role="alert"
            className="bg-red-600 dark:bg-red-700 text-white rounded-xl p-5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5">
              <AlertOctagon className="w-7 h-7 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold">
                  คำเตือนสำคัญที่สุด: สำรองข้อมูลทันที! พบสัญญาณความเสี่ยงที่ดิสก์เก็บข้อมูล
                </h2>
                <p className="text-xs sm:text-sm text-red-100 leading-relaxed">
                  ก่อนทำการซ่อมแซมหรือรันโปรแกรมแก้ไขใด ๆ แนะนำให้คัดลอกไฟล์งานสำคัญ รูปภาพ และเอกสารออกจากดิสก์ที่มีปัญหาไปไว้ใน Flash Drive, External Drive หรือ Cloud ทันที ({finalEvaluation.diskRiskReasons.join(' / ')})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const diskComp = finalEvaluation.components.find((c) => c.category === 'disk');
                if (diskComp) setSelectedComponentDetail(diskComp);
              }}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-white text-red-700 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap shrink-0 no-print"
            >
              ดูอาการของดิสก์ลูกที่มีความเสี่ยง
            </button>
          </div>
        )}

        {/* แสดงข้อผิดพลาดกรณีเรียก Gemini API ไม่สำเร็จ */}
        {aiError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-4 no-print">
            <span>
              <strong>แจ้งเตือนจากระบบ AI:</strong> {aiError} (คุณยังสามารถดูผลวิเคราะห์ตามกฎมาตรฐานด้านล่างได้ตามปกติ)
            </span>
            <button
              type="button"
              onClick={() => setAiError(null)}
              className="underline font-semibold cursor-pointer shrink-0"
            >
              ปิดข้อความ
            </button>
          </div>
        )}

        {/* 1. คะแนนสุขภาพรวม 0–100 แบบวงกลม (ScoreGauge) */}
        <ScoreGauge
          score={finalEvaluation.overallScore}
          summary={finalEvaluation.summary}
          machineName={
            currentReport.system?.computerName || currentReport.machineId || 'WORKSTATION'
          }
          generatedAt={currentReport.generatedAt}
          sourceLabel={getSourceLabel(currentReport.source)}
          hasAIAnalysis={Boolean(aiAnalysis)}
          isAnalyzingAI={isAnalyzingAI}
          onRequestAIAnalysis={() => setShowConsentModal(true)}
          onOpenAIChat={() => setShowChatDrawer(true)}
          onPrintReport={() => window.print()}
          onCopySummary={handleCopyTechnicianSummary}
          copiedSummary={copiedSummary}
        />

        {/* Skeleton Loading ขณะกำลังรอ Gemini AI วิเคราะห์ */}
        {isAnalyzingAI && (
          <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-6 space-y-4 animate-pulse no-print">
            <div className="flex items-center gap-2.5 text-sm font-bold text-blue-600 dark:text-blue-400">
              <Sparkles className="w-5 h-5 animate-spin" />
              <span>กำลังวิเคราะห์ข้อมูลฮาร์ดแวร์ ประวัติ Event Log และประเมินราคาซ่อมบำรุงด้วย AI อัตโนมัติ...</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            </div>
          </div>
        )}

        {/* 2. ส่วน "อะไหล่ที่ต้องเฝ้าระวัง" เรียงจากอันตรายสุดขึ้นก่อน พร้อมปุ่มอัปเดตไดรเวอร์ทันทีถ้าเกี่ยวข้อง */}
        {watchlistComponents.length > 0 ? (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    อะไหล่ที่ต้องเฝ้าระวังและแก้ไข ({watchlistComponents.length} รายการ เรียงตามความเร่งด่วน)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    รายการอะไหล่ที่ตรวจพบค่าเกินเกณฑ์ปกติ แนะนำให้ตรวจสอบจากลำดับแรกสุดก่อน
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {watchlistComponents.map((comp) => {
                const meta = getStatusMeta(comp.status);
                const compLinks = getDriverUpdateLinksForComponent(comp);
                const primaryLink = compLinks.find((l) => l.isPrimary) || compLinks[0] || null;

                return (
                  <div
                    key={comp.id}
                    className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className={`font-bold ${meta.textClass}`}>{meta.badgeText}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {comp.name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ({comp.modelName})
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        <strong>สาเหตุ:</strong> {comp.ruleReasons[0]} —{' '}
                        <span className="text-slate-600 dark:text-slate-400">
                          <strong>แนะนำ:</strong> {comp.recommendation}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0 no-print">
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {comp.estimatedCostTHB}
                      </span>
                      {primaryLink && (
                        <a
                          href={primaryLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {primaryLink.label}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedComponentDetail(comp)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        ดูรายละเอียด
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-sm text-emerald-900 dark:text-emerald-200">
              <strong>ไม่พบอะไหล่ที่อยู่ในเกณฑ์อันตราย:</strong> อะไหล่ทุกชิ้นที่มีข้อมูลอยู่ในเกณฑ์ปกติ สามารถใช้งานได้ตามปกติ
            </div>
          </section>
        )}

        {/* 3. ส่วนเลือกอาการที่ผู้ใช้พบ (Symptom Checkboxes) */}
        <SymptomSelector
          selectedSymptoms={selectedSymptoms}
          onToggleSymptom={handleToggleSymptom}
          onClearSymptoms={() => setSelectedSymptoms([])}
        />

        {/* 4. การ์ดอะไหล่แต่ละชิ้น (CPU, RAM, ดิสก์แต่ละลูก, GPU, แบตเตอรี่, Mainboard/BIOS, ระบบระบายความร้อน, ระบบปฏิบัติการ) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                สถานะอะไหล่ทุกชิ้นส่วน ({finalEvaluation.components.length} รายการ)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                🟢 ปกติ · 🟡 เริ่มผิดปกติ (เฝ้าระวัง) · 🔴 ควรเปลี่ยน/แก้ไขด่วน · ⚪ ตรวจสอบไม่ได้ (ข้อมูลไม่พอ)
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg self-start no-print">
              <button
                type="button"
                onClick={() => setComponentFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  componentFilter === 'all'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ทั้งหมด ({finalEvaluation.components.length})
              </button>
              <button
                type="button"
                onClick={() => setComponentFilter('issues')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  componentFilter === 'issues'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ต้องเฝ้าระวัง/แก้ไข ({watchlistComponents.length})
              </button>
              <button
                type="button"
                onClick={() => setComponentFilter('normal')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  componentFilter === 'normal'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ปกติ ({finalEvaluation.components.filter((c) => c.status === 'normal').length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredComponents.map((comp) => (
              <ComponentCard
                key={comp.id}
                component={comp}
                onSelectDetail={(c) => setSelectedComponentDetail(c)}
              />
            ))}
          </div>
        </section>

        {/* 5. ศูนย์รวมลิงก์อัปเดตไดรเวอร์และเฟิร์มแวร์จากแหล่งข้อมูลทางการตามรุ่นฮาร์ดแวร์ของเครื่องนี้ */}
        <section
          id="driver-updates"
          className="scroll-mt-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 no-print"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                <DownloadCloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  ศูนย์อัปเดตไดรเวอร์ เฟิร์มแวร์ และระบบจากเว็บไซต์ทางการ (ตรงตามอะไหล่เครื่องคุณ)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  รวมลิงก์ดาวน์โหลดไดรเวอร์ของแท้จากผู้ผลิตโดยตรงสำหรับ การ์ดจอ, ชิปเซ็ต CPU, เมนบอร์ด/BIOS, เฟิร์มแวร์ SSD และ Windows Update
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href="ms-settings:windowsupdate"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                เปิด Windows Update บนเครื่อง
              </a>
              <button
                type="button"
                onClick={handleCopyWingetUpgrade}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                title="คัดลอกคำสั่ง winget เพื่ออัปเดตโปรแกรมทั้งหมดในเครื่องผ่าน PowerShell"
              >
                {copiedWinget ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    คัดลอกคำสั่ง winget upgrade แล้ว
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    คัดลอกคำสั่งอัปเดตแอปทั้งหมด (winget)
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {machineDriverLinks.map((item, idx) => (
              <a
                key={idx}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between gap-3 transition-colors group"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate font-medium">{item.componentName}</span>
                    <span className="font-mono text-[11px] shrink-0">{item.provider}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {item.label}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    อุปกรณ์: {item.modelName}
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 pt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-800/80 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <span>คลิกเพื่อไปที่หน้าดาวน์โหลดทางการ</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* 6. ส่วน "สาเหตุที่น่าจะเป็นไปได้" เชื่อมอาการกับอะไหล่และ Event Log */}
        <CauseList
          probableCauses={finalEvaluation.probableCauses}
          preventiveTips={finalEvaluation.preventiveTips}
          eventLogs={currentReport.eventLogs}
        />

        {/* 7. หน้า "วิธีใช้งาน 3 ขั้นตอน" และดาวน์โหลดสคริปต์ PowerShell */}
        <div id="how-to-use" className="scroll-mt-20 space-y-6">
          <ScriptDownloader onLoadReport={handleLoadReport} />
          <ReportUploader
            activePresetId={activePresetId}
            stripPersonalInfo={stripPersonalInfo}
            onChangeStripPersonalInfo={setStripPersonalInfo}
            onLoadReport={handleLoadReport}
          />
        </div>

        {/* 8. ตรวจเช็กด่วนผ่านเบราว์เซอร์ (Browser API + Web Worker Benchmark + FPS Test) */}
        <div id="browser-probe" className="scroll-mt-20">
          <BrowserProbe
            onApplyToDashboard={(browserReport) =>
              handleLoadReport(browserReport, [], 'browser-live', true)
            }
          />
        </div>

        {/* 9. ประวัติการสแกนและกราฟแนวโน้มความเสื่อม */}
        <div id="history-trends" className="scroll-mt-20">
          <HistoryChart
            history={scanHistory}
            onLoadHistoryItem={(item) =>
              handleLoadReport(item.reportSnapshot, [], item.id, true)
            }
            onClearHistory={() => setScanHistory([])}
            onAddSimulatedTrendPoint={handleAddSimulatedTrendPoint}
          />
        </div>

        {/* 10. Checklist บำรุงรักษาเครื่อง */}
        <div id="maintenance" className="scroll-mt-20">
          <MaintenanceChecklist
            items={checklistItems}
            onToggleItem={handleToggleChecklistItem}
            onResetChecklist={() => setChecklistItems(DEFAULT_MAINTENANCE_ITEMS)}
          />
        </div>
      </main>

      {/* ส่วนท้ายเว็บไซต์ (Footer) พร้อม A powered by Surachai P.Zaka */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-8 py-8 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            PC Health Doctor · ระบบตรวจสอบสุขภาพคอมพิวเตอร์ Windows และวิเคราะห์สาเหตุอาการผิดปกติ
          </div>
          <div>
            ข้อจำกัดความรับผิดชอบ: ผลลัพธ์เป็นการประเมินจากซอฟต์แวร์และเซนเซอร์เบื้องต้น โปรดสำรองข้อมูลสำคัญเสมอ
          </div>
        </div>
        <div className="font-display font-bold text-sm text-slate-800 dark:text-slate-200 tracking-tight whitespace-nowrap">
          A powered by Surachai P.Zaka
        </div>
      </footer>

      {/* หน้าต่างขอความยินยอมด้านความเป็นส่วนตัวก่อนส่งให้ Gemini AI */}
      <AiConsentModal
        isOpen={showConsentModal}
        report={currentReport}
        stripPersonalInfo={stripPersonalInfo}
        onChangeStripPersonalInfo={setStripPersonalInfo}
        onConfirm={handleConfirmAIAnalysis}
        onClose={() => setShowConsentModal(false)}
      />

      {/* หน้าต่างแชต "ถาม AI เพิ่มเติม" */}
      <AiChatDrawer
        isOpen={showChatDrawer}
        onClose={() => setShowChatDrawer(false)}
        report={currentReport}
        ruleEvaluation={finalEvaluation}
        aiAnalysis={aiAnalysis}
        selectedSymptoms={selectedSymptoms}
        stripPersonalInfo={stripPersonalInfo}
      />

      {/* หน้าต่างดูรายละเอียดเชิงลึกของอะไหล่แต่ละชิ้น */}
      <ComponentDetailModal
        component={selectedComponentDetail}
        onClose={() => setSelectedComponentDetail(null)}
      />
    </div>
  );
}
