import React from 'react';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Monitor,
  BatteryCharging,
  CircuitBoard,
  Fan,
  AppWindow,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { ComponentStatus, EvaluatedComponent } from '../types/pcHealth';
import { getDriverUpdateLinksForComponent } from '../utils/driverLinks';

interface ComponentCardProps {
  component: EvaluatedComponent;
  onSelectDetail: (component: EvaluatedComponent) => void;
}

export function getStatusMeta(status: ComponentStatus) {
  switch (status) {
    case 'normal':
      return {
        badgeText: '🟢 ปกติ',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        barClass: 'bg-emerald-600 dark:bg-emerald-500',
        borderClass: 'border-slate-200 dark:border-slate-800',
        Icon: CheckCircle2,
      };
    case 'warning':
      return {
        badgeText: '🟡 เริ่มผิดปกติ (เฝ้าระวัง)',
        textClass: 'text-amber-700 dark:text-amber-400',
        barClass: 'bg-amber-500 dark:bg-amber-400',
        borderClass: 'border-amber-300 dark:border-amber-800/80',
        Icon: AlertTriangle,
      };
    case 'critical':
      return {
        badgeText: '🔴 ควรเปลี่ยน/แก้ไขด่วน',
        textClass: 'text-red-700 dark:text-red-400',
        barClass: 'bg-red-600 dark:bg-red-500',
        borderClass: 'border-red-300 dark:border-red-800/80',
        Icon: XCircle,
      };
    case 'unknown':
    default:
      return {
        badgeText: '⚪ ตรวจสอบไม่ได้ (ข้อมูลไม่พอ)',
        textClass: 'text-slate-500 dark:text-slate-400',
        barClass: 'bg-slate-400 dark:bg-slate-600',
        borderClass: 'border-slate-200 dark:border-slate-800',
        Icon: HelpCircle,
      };
  }
}

function getCategoryIcon(category: EvaluatedComponent['category']) {
  switch (category) {
    case 'cpu':
      return Cpu;
    case 'ram':
      return MemoryStick;
    case 'disk':
      return HardDrive;
    case 'gpu':
      return Monitor;
    case 'battery':
      return BatteryCharging;
    case 'mainboard':
      return CircuitBoard;
    case 'cooling':
      return Fan;
    case 'os':
    default:
      return AppWindow;
  }
}

// การ์ดแสดงสถานะอะไหล่แต่ละชิ้น พร้อม 4 ระดับสถานะ ค่าสำคัญ 3 ตัว Progress Bar และปุ่มอัปเดตไดรเวอร์จากแหล่งทางการ
export const ComponentCard: React.FC<ComponentCardProps> = ({ component, onSelectDetail }) => {
  const statusMeta = getStatusMeta(component.status);
  const CategoryIcon = getCategoryIcon(component.category);
  const updateLinks = getDriverUpdateLinksForComponent(component);
  const primaryUpdateLink = updateLinks.find((l) => l.isPrimary) || updateLinks[0] || null;

  // แสดงปุ่มอัปเดตเด่นชัดเมื่อคำแนะนำระบุให้อัปเดต หรือเป็นหมวด GPU / Mainboard / OS / Disk ที่มีลิงก์ทางการ
  const needsDriverHighlight =
    component.actionType === 'อัปเดต' ||
    component.recommendation.includes('อัปเดต') ||
    component.recommendation.includes('ไดรเวอร์') ||
    (component.status !== 'normal' &&
      (component.category === 'gpu' ||
        component.category === 'mainboard' ||
        component.category === 'os'));

  return (
    <article
      className={`bg-white dark:bg-slate-900 border ${statusMeta.borderClass} rounded-xl p-5 flex flex-col justify-between transition-colors print-break-inside-avoid`}
    >
      <div>
        {/* ส่วนหัวการ์ด: ไอคอน ชื่ออะไหล่ รุ่น และสถานะ */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shrink-0">
              <CategoryIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {component.name}
              </h3>
              <p
                className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5"
                title={component.modelName}
              >
                {component.modelName}
              </p>
            </div>
          </div>
        </div>

        {/* สถานะ 4 ระดับ (ไม่ใช้สีอย่างเดียว มีสัญลักษณ์และข้อความชัดเจน) */}
        <div className="flex items-center justify-between text-xs mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
          <span className={`font-semibold ${statusMeta.textClass}`}>{statusMeta.badgeText}</span>
          <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {component.progressLabel}
          </span>
        </div>

        {/* Progress Bar ตามสถานะ */}
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
          {component.progressValue !== null ? (
            <div
              className={`h-full ${statusMeta.barClass} transition-all duration-300`}
              style={{ width: `${Math.max(6, Math.min(100, component.progressValue))}%` }}
            />
          ) : (
            <div className="h-full w-full bg-slate-200 dark:bg-slate-800" />
          )}
        </div>

        {/* ค่าสำคัญ 2–3 ตัว (Tabular Numerals) */}
        <dl className="space-y-2 text-xs mb-4">
          {component.metrics.map((m, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">{m.label}</dt>
              <dd
                className={`font-mono tabular-nums font-medium text-right ${
                  m.isAlert
                    ? 'text-red-600 dark:text-red-400 font-semibold'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* สรุปสาเหตุ คำแนะนำ และปุ่มอัปเดตไดรเวอร์ */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
        <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
          <span className="font-semibold">ผลประเมิน: </span>
          {component.ruleReasons[0]}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
          <span className="font-semibold text-slate-800 dark:text-slate-200">คำแนะนำ: </span>
          {component.recommendation}
        </p>

        {/* ปุ่มลิงก์อัปเดตไดรเวอร์/เฟิร์มแวร์จากเว็บไซต์ทางการโดยตรง */}
        {primaryUpdateLink && (
          <div className="pt-1 no-print">
            <a
              href={primaryUpdateLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                needsDriverHighlight
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200'
              }`}
              title={primaryUpdateLink.description || primaryUpdateLink.label}
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{primaryUpdateLink.label}</span>
            </a>
          </div>
        )}

        <div className="flex items-center justify-between pt-1.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
            งบประมาณ: {component.estimatedCostTHB}
          </span>
          <button
            type="button"
            onClick={() => onSelectDetail(component)}
            className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap shrink-0 no-print"
          >
            ดูรายละเอียด
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};
