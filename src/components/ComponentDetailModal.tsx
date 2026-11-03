import React from 'react';
import { X, Wrench, Banknote, Clock, ExternalLink, DownloadCloud } from 'lucide-react';
import { EvaluatedComponent } from '../types/pcHealth';
import { getStatusMeta } from './ComponentCard';
import { getDriverUpdateLinksForComponent } from '../utils/driverLinks';

interface ComponentDetailModalProps {
  component: EvaluatedComponent | null;
  onClose: () => void;
}

// หน้าต่างแสดงรายละเอียดเชิงลึกของอะไหล่แต่ละชิ้น พร้อมปุ่มลิงก์อัปเดตไดรเวอร์จากแหล่งทางการ
export const ComponentDetailModal: React.FC<ComponentDetailModalProps> = ({
  component,
  onClose,
}) => {
  if (!component) return null;

  const statusMeta = getStatusMeta(component.status);
  const officialLinks = getDriverUpdateLinksForComponent(component);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className={`text-xs font-bold mb-1 ${statusMeta.textClass}`}>
              {statusMeta.badgeText}
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {component.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              รุ่นอุปกรณ์: {component.modelName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ตารางค่าที่วัดได้ */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            ค่าสำคัญที่ตรวจพบ
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {component.metrics.map((m, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">{m.label}</div>
                <div
                  className={`text-sm font-bold font-mono tabular-nums mt-1 ${
                    m.isAlert
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* สาเหตุการประเมิน */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            ผลการวิเคราะห์และเหตุผล
          </h4>
          <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200/70 dark:border-slate-800">
            {component.ruleReasons.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>

        {/* คำแนะนำการแก้ไขและงบประมาณ */}
        <div className="p-4 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/80 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-200">
            <Wrench className="w-4 h-4 shrink-0" />
            <span>คำแนะนำในการดูแล / แก้ไข ({component.actionType})</span>
          </div>
          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
            {component.recommendation}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-blue-200/60 dark:border-blue-800/60 text-xs">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>ความเร่งด่วน: </span>
              <strong className="font-semibold">{component.urgency}</strong>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>ราคาประเมิน: </span>
              <strong className="font-mono tabular-nums font-semibold">
                {component.estimatedCostTHB}
              </strong>
            </div>
          </div>
        </div>

        {/* ลิงก์อัปเดตไดรเวอร์ เฟิร์มแวร์ และเครื่องมือจากแหล่งทางการ */}
        {officialLinks.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <DownloadCloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>ลิงก์อัปเดตไดรเวอร์และดาวน์โหลดเครื่องมือจากเว็บไซต์ทางการ</span>
            </h4>
            <div className="space-y-2">
              {officialLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/70 dark:bg-slate-800/50 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1.5">
                      <span>{link.label}</span>
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        ({link.provider})
                      </span>
                    </div>
                    {link.description && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        {link.description}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 text-white shrink-0">
                    ไปที่หน้าอัปเดต
                    <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
