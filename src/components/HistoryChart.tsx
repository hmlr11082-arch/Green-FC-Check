import React from 'react';
import {
  History,
  TrendingDown,
  Trash2,
  RotateCcw,
  PlusCircle,
} from 'lucide-react';
import { ScanHistoryItem } from '../types/pcHealth';

interface HistoryChartProps {
  history: ScanHistoryItem[];
  onLoadHistoryItem: (item: ScanHistoryItem) => void;
  onClearHistory: () => void;
  onAddSimulatedTrendPoint: () => void;
}

// คอมโพเนนต์แสดงประวัติการสแกน กราฟแนวโน้มความเสื่อมของอะไหล่ และแจ้งเตือนเมื่อค่าแย่ลงเมื่อเทียบกับครั้งก่อน
export const HistoryChart: React.FC<HistoryChartProps> = ({
  history,
  onLoadHistoryItem,
  onClearHistory,
  onAddSimulatedTrendPoint,
}) => {
  // เปรียบเทียบการสแกนล่าสุด (index 0) กับครั้งก่อนหน้า (index 1) เพื่อเตือนเมื่อค่าแย่ลง
  const degradationWarnings: string[] = [];
  if (history.length >= 2) {
    const latest = history[0];
    const previous = history[1];

    if (latest.overallScore < previous.overallScore) {
      degradationWarnings.push(
        `คะแนนสุขภาพรวมลดลงจาก ${previous.overallScore} เหลือ ${latest.overallScore} คะแนน (-${
          previous.overallScore - latest.overallScore
        })`
      );
    }
    if (
      latest.maxSsdWearPercent !== null &&
      previous.maxSsdWearPercent !== null &&
      latest.maxSsdWearPercent > previous.maxSsdWearPercent
    ) {
      degradationWarnings.push(
        `ความเสื่อมของ SSD (Wear) เพิ่มขึ้นจาก ${previous.maxSsdWearPercent}% เป็น ${latest.maxSsdWearPercent}% (+${(
          latest.maxSsdWearPercent - previous.maxSsdWearPercent
        ).toFixed(1)}%)`
      );
    }
    if (
      latest.batteryHealthPercent !== null &&
      previous.batteryHealthPercent !== null &&
      latest.batteryHealthPercent < previous.batteryHealthPercent
    ) {
      degradationWarnings.push(
        `สุขภาพแบตเตอรี่ลดลงจาก ${previous.batteryHealthPercent}% เหลือ ${latest.batteryHealthPercent}% (-${(
          previous.batteryHealthPercent - latest.batteryHealthPercent
        ).toFixed(1)}%)`
      );
    }
    if (
      latest.cpuTempC !== null &&
      previous.cpuTempC !== null &&
      latest.cpuTempC - previous.cpuTempC >= 5
    ) {
      degradationWarnings.push(
        `อุณหภูมิ CPU สูงขึ้นจากครั้งก่อน ${previous.cpuTempC}°C เป็น ${latest.cpuTempC}°C (+${(
          latest.cpuTempC - previous.cpuTempC
        ).toFixed(1)}°C)`
      );
    }
  }

  // เรียงจากเก่าไปใหม่เพื่อวาดกราฟแนวโน้ม (สูงสุด 8 ครั้งล่าสุด)
  const chronological = [...history].slice(0, 8).reverse();

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 no-print">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              ประวัติการสแกนและกราฟแนวโน้มสุขภาพอะไหล่
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              บันทึกในเครื่องอัตโนมัติ (localStorage) เพื่อเปรียบเทียบอัตราความเสื่อมของ SSD, แบตเตอรี่ และอุณหภูมิ
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAddSimulatedTrendPoint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="จำลองการเก็บประวัติย้อนหลังเพื่อดูการแจ้งเตือนแนวโน้ม"
          >
            <PlusCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            จำลองข้อมูลแนวโน้มย้อนหลัง
          </button>
          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              ล้างประวัติ
            </button>
          )}
        </div>
      </div>

      {/* แจ้งเตือนเมื่อค่าแย่ลงเทียบกับการสแกนครั้งก่อน */}
      {degradationWarnings.length > 0 && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
            <TrendingDown className="w-4 h-4 shrink-0" />
            <span>แจ้งเตือนแนวโน้ม: พบค่าสุขภาพเครื่องลดลงเมื่อเทียบกับการสแกนครั้งก่อน</span>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-800 dark:text-amber-200 space-y-1">
            {degradationWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {history.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          ยังไม่มีประวัติการสแกนบันทึกไว้ เมื่อคุณอัปโหลดรายงานหรือเลือกโหมดตัวอย่าง ระบบจะบันทึกแนวโน้มให้อัตโนมัติ
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* กราฟเปรียบเทียบแนวโน้มแต่ละครั้ง */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              กราฟแนวโน้ม {chronological.length} ครั้งล่าสุด (เรียงจากอดีต → ปัจจุบัน)
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 items-end pt-2">
              {chronological.map((item, idx) => {
                const dateLabel = new Date(item.timestamp).toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                });
                const scoreBarHeight = Math.max(15, item.overallScore);
                const wearVal = item.maxSsdWearPercent ?? 0;
                const tempVal = item.cpuTempC ?? 0;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col items-center p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2"
                  >
                    <div className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                      #{idx + 1} · {dateLabel}
                    </div>
                    <div className="w-full h-24 bg-slate-100 dark:bg-slate-800 rounded flex items-end justify-center p-1.5 gap-1.5">
                      {/* แท่งคะแนนรวม */}
                      <div
                        className="w-3 bg-blue-600 dark:bg-blue-500 rounded-t transition-all"
                        style={{ height: `${scoreBarHeight}%` }}
                        title={`คะแนนรวม: ${item.overallScore}`}
                      />
                      {/* แท่งความเสื่อม SSD */}
                      <div
                        className="w-3 bg-amber-500 rounded-t transition-all"
                        style={{ height: `${Math.max(8, Math.min(100, wearVal))}%` }}
                        title={`SSD Wear: ${wearVal}%`}
                      />
                      {/* แท่งอุณหภูมิ CPU */}
                      <div
                        className="w-3 bg-red-500 rounded-t transition-all"
                        style={{ height: `${Math.max(8, Math.min(100, tempVal))}%` }}
                        title={`CPU Temp: ${tempVal}°C`}
                      />
                    </div>
                    <div className="w-full space-y-0.5 font-mono tabular-nums text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-400">คะแนน:</span>
                        <span className="font-bold">{item.overallScore}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-600 dark:text-amber-400">SSD Wear:</span>
                        <span>{item.maxSsdWearPercent !== null ? `${item.maxSsdWearPercent}%` : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-600 dark:text-red-400">CPU Temp:</span>
                        <span>{item.cpuTempC !== null ? `${item.cpuTempC}°C` : '-'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <span>สัญลักษณ์แท่งกราฟ:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">■ คะแนนสุขภาพรวม (ยิ่งสูงยิ่งดี)</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">■ SSD Wear % (ยิ่งต่ำยิ่งดี)</span>
              <span className="font-semibold text-red-600 dark:text-red-400">■ อุณหภูมิ CPU °C</span>
            </div>
          </div>

          {/* ตารางประวัติการสแกนแต่ละครั้ง */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-3 font-semibold">วัน-เวลา / เครื่อง</th>
                  <th className="py-2.5 px-2 font-semibold text-right">คะแนน</th>
                  <th className="py-2.5 px-2 font-semibold text-right">SSD Wear</th>
                  <th className="py-2.5 px-2 font-semibold text-right">แบต / CPU</th>
                  <th className="py-2.5 pl-2 font-semibold text-right">เรียกดู</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {history.slice(0, 6).map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.machineLabel}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {new Date(item.timestamp).toLocaleString('th-TH', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {item.overallScore}/100
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {item.maxSsdWearPercent !== null ? `${item.maxSsdWearPercent}%` : '-'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {item.batteryHealthPercent !== null ? `${item.batteryHealthPercent}%` : '-'} /{' '}
                      {item.cpuTempC !== null ? `${item.cpuTempC}°C` : '-'}
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() => onLoadHistoryItem(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        เปิดดู
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
