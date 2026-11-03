import React, { useState } from 'react';
import { MessageSquareText, Send, X, Sparkles, ShieldAlert } from 'lucide-react';
import {
  AIAnalysisResult,
  PCReport,
  RuleEvaluationResult,
  SymptomKey,
} from '../types/pcHealth';
import { sanitizeReportForAI } from '../utils/ruleEvaluator';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface AiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  report: PCReport;
  ruleEvaluation: RuleEvaluationResult;
  aiAnalysis: AIAnalysisResult | null;
  selectedSymptoms: SymptomKey[];
  stripPersonalInfo: boolean;
}

const QUICK_QUESTIONS = [
  'จากผลตรวจนี้ อะไหล่ชิ้นไหนควรซ่อมหรือเปลี่ยนเป็นอันดับแรก?',
  'อาการของเครื่องนี้สามารถแก้เองเบื้องต้นได้อย่างไรบ้างโดยไม่ต้องเสียเงิน?',
  'ถ้าต้องยกไปร้านซ่อม ควรบอกช่างว่าให้เช็กจุดไหนบ้าง และงบประมาณเท่าไหร่?',
  'ช่วยอธิบายสาเหตุของ Event Log Error ที่พบในเครื่องนี้แบบเข้าใจง่าย ๆ หน่อย',
];

// หน้าต่างแชต "ถาม AI เพิ่มเติม" เพื่อปรึกษาปัญหาต่อยอดจากรายงานสุขภาพเครื่องปัจจุบัน
export const AiChatDrawer: React.FC<AiChatDrawerProps> = ({
  isOpen,
  onClose,
  report,
  ruleEvaluation,
  aiAnalysis,
  selectedSymptoms,
  stripPersonalInfo,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: `สวัสดีครับ! ผมคือ PC Health Doctor ผมอ่านข้อมูลรายงานสุขภาพเครื่องของคุณเรียบร้อยแล้ว (คะแนนปัจจุบัน ${ruleEvaluation.overallScore}/100) คุณสามารถเลือกคำถามด้านล่าง หรือพิมพ์ถามอาการเพิ่มเติมได้เลยครับ`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!isOpen) return null;

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);
    setErrorText(null);

    try {
      const sanitizedReport = sanitizeReportForAI(report, stripPersonalInfo);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: sanitizedReport,
          ruleEvaluation,
          aiAnalysis,
          selectedSymptoms,
          messages: nextMessages,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || 'เกิดข้อผิดพลาดในการถาม AI');
      }

      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อกับ AI ได้';
      setErrorText(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-xl h-full flex flex-col justify-between shadow-2xl">
        {/* ส่วนหัวแชต */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600 text-white">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ถาม AI เพิ่มเติม (ปรึกษาปัญหาจากรายงานเครื่องนี้)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ตอบคำถามอ้างอิงจากค่าฮาร์ดแวร์และ Event Log ของคุณโดยตรง
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* พื้นที่ข้อความสนทนา */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ปุ่มคำถามแนะนำ */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              คำถามยอดนิยมสำหรับเครื่องนี้:
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendQuestion(q)}
                  disabled={isLoading}
                  className="text-left text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:border-blue-500 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-3.5 text-sm leading-relaxed whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-xl p-3.5 bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
                กำลังวิเคราะห์คำตอบจากรายงานฮาร์ดแวร์ของคุณ...
              </div>
            </div>
          )}

          {errorText && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorText}</span>
            </div>
          )}
        </div>

        {/* ช่องพิมพ์ข้อความถาม */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="พิมพ์คำถาม เช่น ถ้าเปลี่ยน SSD ต้องลง Windows ใหม่ไหม..."
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
              ส่งถาม
            </button>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            ข้อจำกัด: คำตอบของ AI เป็นการประเมินจากข้อมูลซอฟต์แวร์ที่มี ไม่ใช่การรับรองทางฮาร์ดแวร์โดยตรง
          </div>
        </form>
      </div>
    </div>
  );
};
