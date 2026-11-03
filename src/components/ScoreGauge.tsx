import React from 'react';
import {
  Sparkles,
  MessageSquareText,
  Printer,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface ScoreGaugeProps {
  score: number;
  summary: string;
  machineName: string;
  generatedAt: string;
  sourceLabel: string;
  hasAIAnalysis: boolean;
  isAnalyzingAI: boolean;
  onRequestAIAnalysis: () => void;
  onOpenAIChat: () => void;
  onPrintReport: () => void;
  onCopySummary: () => void;
  copiedSummary: boolean;
}

// คอมโพเนนต์แสดงคะแนนสุขภาพรวม 0–100 แบบวงกลม (Gauge) พร้อมสรุปภาพรวมและปุ่มคำสั่งหลัก
export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  summary,
  machineName,
  generatedAt,
  sourceLabel,
  hasAIAnalysis,
  isAnalyzingAI,
  onRequestAIAnalysis,
  onOpenAIChat,
  onPrintReport,
  onCopySummary,
  copiedSummary,
}) => {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const getScoreTheme = (val: number) => {
    if (val >= 80) {
      return {
        stroke: '#16A34A', // emerald/green
        textClass: 'text-emerald-600 dark:text-emerald-400',
        label: '🟢 สุขภาพดี',
        Icon: ShieldCheck,
      };
    }
    if (val >= 55) {
      return {
        stroke: '#D97706', // amber
        textClass: 'text-amber-600 dark:text-amber-400',
        label: '🟡 เริ่มผิดปกติ (เฝ้าระวัง)',
        Icon: AlertTriangle,
      };
    }
    return {
      stroke: '#DC2626', // red
      textClass: 'text-red-600 dark:text-red-400',
      label: '🔴 ควรแก้ไขด่วน',
      Icon: ShieldAlert,
    };
  };

  const theme = getScoreTheme(clampedScore);
  const StatusIcon = theme.Icon;

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* ส่วนวงกลมคะแนนและข้อความสรุป */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 flex-1">
          <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth="12"
                className="text-slate-100 dark:text-slate-800"
              />
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke={theme.stroke}
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className={`text-3xl font-bold font-mono tabular-nums ${theme.textClass}`}>
                {clampedScore}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">เต็ม 100</span>
            </div>
          </div>

          <div className="space-y-2 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className={`font-semibold flex items-center gap-1 ${theme.textClass}`}>
                <StatusIcon className="w-4 h-4" />
                {theme.label}
              </span>
              <span aria-hidden="true">·</span>
              <span>เครื่อง: {machineName || 'ไม่ระบุชื่อเครื่อง'}</span>
              <span aria-hidden="true">·</span>
              <span>แหล่งข้อมูล: {sourceLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {new Date(generatedAt).toLocaleString('th-TH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {summary}
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              หมายเหตุ: เป็นการประเมินจากข้อมูลซอฟต์แวร์ เซนเซอร์ และ Event Log ที่มีในรายงาน ไม่ใช่การรับรองทางฮาร์ดแวร์โดยตรง
              {hasAIAnalysis && ' · วิเคราะห์เชิงลึกโดย Gemini AI แล้ว'}
            </p>
          </div>
        </div>

        {/* ปุ่มดำเนินการหลัก */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-center lg:justify-end no-print">
          <button
            type="button"
            onClick={onRequestAIAnalysis}
            disabled={isAnalyzingAI}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            {isAnalyzingAI
              ? 'กำลังให้ AI วิเคราะห์...'
              : hasAIAnalysis
              ? 'วิเคราะห์ด้วย AI อีกครั้ง'
              : 'วิเคราะห์เชิงลึกด้วย Gemini AI'}
          </button>

          <button
            type="button"
            onClick={onOpenAIChat}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <MessageSquareText className="w-4 h-4" />
            ถาม AI เพิ่มเติม
          </button>

          <button
            type="button"
            onClick={onCopySummary}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="คัดลอกข้อความสรุปเพื่อส่งให้ช่างคอมพิวเตอร์"
          >
            {copiedSummary ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                คัดลอกแล้ว
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                คัดลอกส่งช่าง
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onPrintReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="พิมพ์หรือบันทึกเป็น PDF"
          >
            <Printer className="w-4 h-4" />
            พิมพ์ / PDF
          </button>
        </div>
      </div>
    </section>
  );
};
