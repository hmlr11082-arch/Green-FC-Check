import React from 'react';
import { Stethoscope } from 'lucide-react';
import { SymptomKey } from '../types/pcHealth';
import { SYMPTOM_OPTIONS } from '../utils/ruleEvaluator';

interface SymptomSelectorProps {
  selectedSymptoms: SymptomKey[];
  onToggleSymptom: (key: SymptomKey) => void;
  onClearSymptoms: () => void;
}

// คอมโพเนนต์ให้ผู้ใช้ติ๊กเลือกอาการผิดปกติที่พบ เพื่อนำไปใช้ประกอบการวิเคราะห์สาเหตุ
export const SymptomSelector: React.FC<SymptomSelectorProps> = ({
  selectedSymptoms,
  onToggleSymptom,
  onClearSymptoms,
}) => {
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 no-print">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            ระบุอาการผิดปกติที่คุณพบ (เลือกได้หลายข้อ เพื่อช่วยวิเคราะห์หาสาเหตุแม่นยำขึ้น)
          </h3>
        </div>
        {selectedSymptoms.length > 0 && (
          <button
            type="button"
            onClick={onClearSymptoms}
            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
          >
            ล้างตัวเลือกอาการ ({selectedSymptoms.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {SYMPTOM_OPTIONS.map((item) => {
          const isChecked = selectedSymptoms.includes(item.key);
          return (
            <label
              key={item.key}
              className={`flex items-start gap-3 p-3 rounded-lg border text-left cursor-pointer transition-colors select-none ${
                isChecked
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleSymptom(item.key)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.description}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
};
