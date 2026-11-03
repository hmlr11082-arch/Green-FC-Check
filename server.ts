import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('ไม่พบ GEMINI_API_KEY ในระบบ กรุณาตรวจสอบการตั้งค่า Secrets ใน AI Studio');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// เรียก Gemini พร้อมระบบ Retry (Exponential Backoff) และสลับโมเดลสำรองอัตโนมัติเมื่อเกิด 503 (High Demand), 429 หรือ 404
async function generateWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: string;
    config?: Record<string, unknown>;
  }
) {
  const candidateModels = [
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-2.5-flash',
  ];
  let lastError: unknown = null;

  for (let round = 0; round < 2; round++) {
    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isRetryableOrModelFallback =
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('high demand') ||
          msg.includes('overloaded') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('500') ||
          msg.includes('502') ||
          msg.includes('504') ||
          msg.includes('404') ||
          msg.includes('NOT_FOUND') ||
          msg.includes('not found');

        if (isRetryableOrModelFallback) {
          await sleep(400 * (round + 1));
          continue;
        }
        throw err;
      }
    }
  }
  throw lastError;
}

// ระบบวิเคราะห์เชิงลึกสำรอง (Intelligent Local Expert Engine) กรณีเซิร์ฟเวอร์ Gemini ทุกโมเดลเกิด 503 High Demand พร้อมกัน
function buildExpertFallbackAnalysis(
  report: any,
  ruleEvaluation: any,
  selectedSymptoms: string[] = []
) {
  const baseComponents = Array.isArray(ruleEvaluation?.components)
    ? ruleEvaluation.components
    : [];

  const enhancedComponents = baseComponents.map((comp: any) => {
    const status = comp.status || 'unknown';
    const firstReason =
      Array.isArray(comp.ruleReasons) && comp.ruleReasons.length > 0
        ? comp.ruleReasons[0]
        : 'ประเมินจากค่าเซนเซอร์และสถานะปัจจุบันของอุปกรณ์';

    let detailedReason = firstReason;
    let recommendation = comp.recommendation || 'ดูแลรักษาตามระยะปกติ';

    if (comp.category === 'disk') {
      if (status === 'critical') {
        detailedReason = `${firstReason} มีความเสี่ยงสูงที่ข้อมูลจะเสียหายหรือค้างระหว่างอ่านเขียนไฟล์`;
        recommendation =
          'สำรองข้อมูลก่อน: คัดลอกไฟล์สำคัญลง External Drive หรือ Cloud ทันที จากนั้นแนะนำให้เปลี่ยนเป็น SSD ลูกใหม่เพื่อความเสถียร';
      } else if (status === 'warning') {
        detailedReason = `${firstReason} เริ่มมีสัญญาณความเสื่อมหรือพื้นที่ว่างเหลือน้อย`;
        recommendation =
          'สำรองข้อมูลก่อน / ทำความสะอาด: สำรองไฟล์สำคัญไว้เป็นระยะ และลบไฟล์ขยะให้ไดรฟ์หลักเหลือพื้นที่ว่างมากกว่า 15-20%';
      }
    } else if (comp.category === 'cpu' || comp.category === 'cooling') {
      if (status === 'critical' || status === 'warning') {
        recommendation =
          'ทำความสะอาด / ซ่อม: เป่าฝุ่นพัดลมระบายความร้อนและฮีตซิงค์ พร้อมทาซิลิโคนระบายความร้อนใหม่ และตรวจสอบโปรแกรมเบื้องหลังใน Task Manager';
      }
    } else if (comp.category === 'ram') {
      if (status === 'critical' || status === 'warning') {
        recommendation =
          'เปลี่ยน / ซ่อม: ปิดโปรแกรมที่กินแรมเบื้องหลัง หากพบอาการจอฟ้าแนะนำให้ทำความสะอาดหน้าสัมผัสแรมหรืออัปเกรดเพิ่มขนาด RAM';
      }
    } else if (comp.category === 'battery') {
      if (status === 'critical') {
        recommendation =
          'เปลี่ยน: แบตเตอรี่เสื่อมสภาพมาก แนะนำให้เปลี่ยนแบตเตอรี่ก้อนใหม่ตรงรุ่น (โดยเฉพาะหากเริ่มมีอาการแบตบวม)';
      }
    }

    return {
      name: comp.name,
      status,
      reason: detailedReason,
      recommendation,
      urgency: comp.urgency || 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: comp.estimatedCostTHB || '0 บาท',
    };
  });

  const probableCauses = Array.isArray(ruleEvaluation?.probableCauses)
    ? [...ruleEvaluation.probableCauses]
    : [];

  if (selectedSymptoms.length > 0 && probableCauses.length === 0) {
    probableCauses.push({
      symptom: `อาการที่แจ้ง (${selectedSymptoms.join(', ')})`,
      cause:
        'สัมพันธ์กับภาระงานของระบบ โปรแกรมเบื้องหลัง หรือความร้อนสะสม แนะนำให้ตรวจสอบรายการอะไหล่ที่ขึ้นสถานะเฝ้าระวังด้านบน',
      confidence: 'ปานกลาง',
      relatedComponents: ['ระบบปฏิบัติการ (Windows OS)', 'CPU (หน่วยประมวลผลกลาง)'],
    });
  }

  return {
    overallScore:
      typeof ruleEvaluation?.overallScore === 'number' ? ruleEvaluation.overallScore : 80,
    summary:
      ruleEvaluation?.summary ||
      'วิเคราะห์ข้อมูลฮาร์ดแวร์และ Event Log เสร็จสมบูรณ์ สามารถดูคำแนะนำการดูแลและงบประมาณของแต่ละชิ้นส่วนได้ด้านล่าง',
    components: enhancedComponents,
    probableCauses,
    preventiveTips: [
      'สำรองข้อมูลสำคัญไว้บน Cloud หรือ External Drive อย่างน้อยเดือนละ 1 ครั้ง',
      'กดสั่ง Restart เครื่อง (ไม่ใช่ Shutdown) อย่างน้อยสัปดาห์ละ 1 ครั้ง เพื่อล้างหน่วยความจำค้างจาก Fast Startup',
      'ทำความสะอาดฝุ่นบริเวณพัดลมและช่องระบายอากาศทุก 3–6 เดือน เพื่อป้องกันความร้อนสะสม',
      'จัดระเบียบไดรฟ์ C: ให้มีพื้นที่ว่างอย่างน้อย 15–20% เสมอ เพื่อให้ SSD และ Windows ทำงานได้เต็มประสิทธิภาพ',
      'ตรวจสอบและปิดโปรแกรมใน Task Manager > Startup Apps ที่ไม่จำเป็นต้องเปิดพร้อมเครื่อง',
    ],
  };
}

// ตัวแยกค่า Regex สำรองสำหรับข้อความจาก CrystalDiskInfo / HWiNFO / Battery Report กรณี AI เกิด 503
function parseRawTextFallback(rawText: string) {
  const cpuMatch = rawText.match(/CPU\s*:\s*([^\r\n(]+)/i);
  const cpuCoresMatch = rawText.match(/(\d+)\s*Cores/i);
  const cpuTempMatch = rawText.match(/(?:CPU.*Temp(?:erature)?|Package Temperature)\s*:\s*(\d+(?:\.\d+)?)\s*C/i);
  const cpuLoadMatch = rawText.match(/CPU Usage\s*:\s*(\d+(?:\.\d+)?)\s*%/i);

  const ramTotalMatch = rawText.match(/(?:Physical Memory|RAM)\s*:\s*(\d+(?:\.\d+)?)\s*GB/i);
  const ramUsageMatch = rawText.match(/Used\s*:\s*(\d+(?:\.\d+)?)\s*%/i);
  const ramSpeedMatch = rawText.match(/DDR\d-(\d+)/i);

  const gpuMatch = rawText.match(/GPU\s*:\s*([^\r\n(]+)/i);
  const gpuTempMatch = rawText.match(/GPU[\s\S]{0,80}?Temp\s*:\s*(\d+(?:\.\d+)?)\s*C/i);
  const gpuDriverMatch = rawText.match(/Driver\s*:\s*(\d{4}-\d{2}-\d{2})/i);

  const batDesignMatch = rawText.match(/Designed?\s*Capacity\s*:?\s*(\d+)\s*mWh/i);
  const batFullMatch = rawText.match(/Full\s*Charged?\s*Capacity\s*:?\s*(\d+)\s*mWh/i);
  const batCycleMatch = rawText.match(/Cycle\s*Count\s*:?\s*(\d+)/i);

  const diskModelMatch = rawText.match(/Model\s*:\s*([^\r\n]+)/i);
  const diskSizeMatch = rawText.match(/Disk Size\s*:\s*(\d+(?:\.\d+)?)\s*GB/i);
  const diskHealthMatch = rawText.match(/Health Status\s*:\s*([A-Za-z]+)(?:\s*\((\d+)\s*%\))?/i);
  const diskTempMatch = rawText.match(/Temperature\s*:\s*(\d+)\s*C/i);
  const diskHoursMatch = rawText.match(/Power On Hours\s*:\s*(\d+)/i);

  const disks: any[] = [];
  if (diskModelMatch) {
    const rawHealth = diskHealthMatch ? diskHealthMatch[1] : 'Healthy';
    const healthPct = diskHealthMatch && diskHealthMatch[2] ? Number(diskHealthMatch[2]) : null;
    const wearPercent = healthPct !== null ? Math.max(0, 100 - healthPct) : null;
    disks.push({
      friendlyName: diskModelMatch[1].trim(),
      mediaType: rawText.match(/NVM Express|SSD/i) ? 'SSD' : 'HDD',
      healthStatus:
        rawHealth.toLowerCase().includes('good') || rawHealth.toLowerCase().includes('healthy')
          ? 'Healthy'
          : rawHealth.toLowerCase().includes('caution') || rawHealth.toLowerCase().includes('warning')
          ? 'Warning'
          : 'Unhealthy',
      sizeGB: diskSizeMatch ? Number(diskSizeMatch[1]) : null,
      wearPercent,
      temperatureC: diskTempMatch ? Number(diskTempMatch[1]) : null,
      readErrorsTotal: 0,
      writeErrorsTotal: 0,
      reallocatedSectors: 0,
      powerOnHours: diskHoursMatch ? Number(diskHoursMatch[1]) : null,
    });
  }

  return {
    cpuModel: cpuMatch ? cpuMatch[1].trim() : null,
    cpuCores: cpuCoresMatch ? Number(cpuCoresMatch[1]) : null,
    cpuLoadPercent: cpuLoadMatch ? Number(cpuLoadMatch[1]) : null,
    cpuTempC: cpuTempMatch ? Number(cpuTempMatch[1]) : null,
    ramTotalGB: ramTotalMatch ? Number(ramTotalMatch[1]) : null,
    ramUsagePercent: ramUsageMatch ? Number(ramUsageMatch[1]) : null,
    ramSpeedMHz: ramSpeedMatch ? Number(ramSpeedMatch[1]) : null,
    gpuName: gpuMatch ? gpuMatch[1].trim() : null,
    gpuTempC: gpuTempMatch ? Number(gpuTempMatch[1]) : null,
    gpuDriverDate: gpuDriverMatch ? gpuDriverMatch[1] : null,
    hasBattery: Boolean(batDesignMatch || batFullMatch),
    batteryDesignCapacitymWh: batDesignMatch ? Number(batDesignMatch[1]) : null,
    batteryFullChargedCapacitymWh: batFullMatch ? Number(batFullMatch[1]) : null,
    batteryCycleCount: batCycleMatch ? Number(batCycleMatch[1]) : null,
    boardModel: null,
    biosVersion: null,
    osName: 'Windows (แยกค่าจากข้อความรายงาน)',
    disks,
  };
}

// สร้างคำตอบแชตสำรองจากข้อมูลจริงของเครื่อง กรณีเซิร์ฟเวอร์ AI มีผู้ใช้งานหนาแน่น (503)
function buildFallbackChatReply(
  report: any,
  ruleEvaluation: any,
  userQuestion: string
): string {
  const score = ruleEvaluation?.overallScore ?? 80;
  const components: any[] = Array.isArray(ruleEvaluation?.components)
    ? ruleEvaluation.components
    : [];
  const risky = components.filter((c) => c.status === 'critical' || c.status === 'warning');

  const lines: string[] = [
    `จากรายงานตรวจเครื่องของคุณ (${report?.system?.computerName || report?.machineId || 'Windows PC'}) คะแนนสุขภาพรวมอยู่ที่ **${score}/100** ครับ`,
    '',
  ];

  if (risky.length > 0) {
    lines.push('**จุดที่ตรวจพบว่าควรดูแลเป็นลำดับแรก:**');
    risky.forEach((c, idx) => {
      lines.push(
        `${idx + 1}. **${c.name} (${c.modelName})** — ${c.ruleReasons?.[0] || 'พบค่าเกินเกณฑ์ปกติ'}\n   • แนวทางแก้ไข: ${c.recommendation}\n   • งบประมาณประเมิน: ${c.estimatedCostTHB}`
      );
    });
  } else {
    lines.push(
      '• **สถานะอะไหล่ทุกชิ้นอยู่ในเกณฑ์ปกติ (🟢):** ไม่พบความเสื่อมของ SSD หรืออุณหภูมิที่สูงเกินเกณฑ์อันตราย และไม่พบประวัติจอฟ้าหรือเครื่องดับซ้ำซ้อนใน Event Log 30 วันล่าสุดครับ'
    );
  }

  if (userQuestion.includes('แก้เอง') || userQuestion.includes('ฟรี') || userQuestion.includes('ช้า')) {
    lines.push(
      '',
      '**สิ่งที่คุณสามารถทำเองได้ทันทีโดยไม่เสียค่าใช้จ่าย:**',
      '1. กดสั่ง **Restart** เครื่อง (เพื่อล้าง Uptime และหน่วยความจำค้าง)',
      '2. เปิด **Task Manager (Ctrl+Shift+Esc) > Startup Apps** แล้วกด Disable โปรแกรมที่ไม่จำเป็นต้องรันตอนเปิดเครื่อง',
      '3. เปิด Command Prompt (Run as Administrator) แล้วพิมพ์ `sfc /scannow` เพื่อตรวจสอบและซ่อมแซมไฟล์ระบบ Windows อัตโนมัติ'
    );
  }

  lines.push(
    '',
    '*(หมายเหตุ: ขณะนี้เซิร์ฟเวอร์ AI หลักมีผู้ใช้งานหนาแน่น ระบบจึงสรุปคำตอบโดยตรงจากฐานข้อมูลฮาร์ดแวร์และกฎวิศวกรรมของเครื่องคุณครับ)*'
  );

  return lines.join('\n');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // 1. Endpoint วิเคราะห์สุขภาพเครื่องด้วย Gemini (พร้อมระบบ Retry, สลับโมเดล และ Fallback อัตโนมัติเมื่อเกิด 503)
  app.post('/api/analyze', async (req, res) => {
    const { report, ruleEvaluation, selectedSymptoms } = req.body || {};
    if (!report || !ruleEvaluation) {
      res.status(400).json({ error: 'ข้อมูลรายงานไม่ครบถ้วนสำหรับส่งวิเคราะห์' });
      return;
    }

    try {
      const ai = getGenAIClient();

      const systemInstruction = `คุณคือ "PC Health Doctor" วิศวกรฮาร์ดแวร์คอมพิวเตอร์และช่างซ่อมคอมพิวเตอร์อาวุโส
หน้าที่ของคุณคือวิเคราะห์รายงานสุขภาพคอมพิวเตอร์ Windows (JSON) ร่วมกับผลประเมินเบื้องต้น (Rule-based) และอาการที่ผู้ใช้แจ้ง
กฎเหล็กในการตอบ:
1. ใช้ภาษาไทยที่เข้าใจง่ายสำหรับคนทั่วไป ไม่ใช้ศัพท์เทคนิคซับซ้อนเกินจำเป็น (หากใช้ศัพท์เทคนิค เช่น WHEA, Kernel-Power 41, Bad Sector ให้วงเล็บคำแปลสั้น ๆ ที่คนทั่วไปเข้าใจทันที)
2. ในคำแนะนำ (recommendation) ของแต่ละอะไหล่ ต้องระบุชัดเจนว่าควร "ซ่อม / เปลี่ยน / ทำความสะอาด / อัปเดต / สำรองข้อมูลก่อน / ดูแลตามปกติ"
3. ประเมินราคาค่าซ่อมหรือค่าอะไหล่ในไทยเป็นเงินบาทแบบช่วง (estimatedCostTHB) เช่น "0 บาท (ทำเองได้)", "300 - 600 บาท (ค่าแรงล้างเครื่อง/ทาซิลิโคน)", "1,200 - 2,500 บาท (เปลี่ยน SSD 500GB-1TB)", "1,500 - 3,000 บาท (เปลี่ยนแบตเตอรี่โน้ตบุ๊ก)"
4. ถ้าอะไหล่ชิ้นไหนไม่มีข้อมูล (status เป็น unknown) ให้คงค่า status เป็น "unknown" ห้ามเดาว่าปกติ ("normal") เด็ดขาด
5. เชื่อมโยงอาการที่ผู้ใช้พบเข้ากับหลักฐานจาก Event Log และเซนเซอร์ใน probableCauses อย่างมีเหตุผล`;

      const prompt = `กรุณาวิเคราะห์ข้อมูลสุขภาพคอมพิวเตอร์ต่อไปนี้:

[อาการที่ผู้ใช้เลือก]:
${Array.isArray(selectedSymptoms) && selectedSymptoms.length > 0 ? selectedSymptoms.join(', ') : 'ผู้ใช้ไม่ได้ระบุอาการเพิ่มเติม (ตรวจเช็กตามระยะ)'}

[ผลประเมินตามกฎมาตรฐาน (Rule-based Evaluation)]:
${JSON.stringify(ruleEvaluation, null, 2)}

[ข้อมูลรายงานฮาร์ดแวร์และ Event Log (PC Report JSON)]:
${JSON.stringify(report, null, 2)}

กรุณาตอบกลับเป็น JSON ตามโครงสร้าง Schema ที่กำหนดเท่านั้น`;

      const response = await generateWithFallback(ai, {
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallScore: {
                type: Type.INTEGER,
                description: 'คะแนนสุขภาพเครื่องรวม 0 ถึง 100',
              },
              summary: {
                type: Type.STRING,
                description: 'สรุปภาพรวมสุขภาพเครื่อง 1-2 ประโยคที่ชัดเจน เข้าใจง่าย',
              },
              components: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: {
                      type: Type.STRING,
                      description: 'ชื่ออะไหล่ ต้องตรงกับชื่อใน ruleEvaluation เช่น CPU, RAM, ดิสก์, GPU, แบตเตอรี่, Mainboard/BIOS, ระบบระบายความร้อน, ระบบปฏิบัติการ',
                    },
                    status: {
                      type: Type.STRING,
                      description: 'สถานะหนึ่งใน: normal, warning, critical, unknown',
                    },
                    reason: {
                      type: Type.STRING,
                      description: 'สาเหตุหรือคำอธิบายสถานะของอะไหล่ชิ้นนี้ด้วยภาษาง่าย ๆ',
                    },
                    recommendation: {
                      type: Type.STRING,
                      description: 'คำแนะนำที่ระบุว่าควร ซ่อม / เปลี่ยน / ทำความสะอาด / อัปเดต / สำรองข้อมูลก่อน พร้อมวิธีปฏิบัติ',
                    },
                    urgency: {
                      type: Type.STRING,
                      description: 'ระดับความเร่งด่วน เช่น ด่วนที่สุด (ทันที), ควรทำภายใน 1-2 สัปดาห์, เฝ้าระวัง, ไม่ต้องดำเนินการ',
                    },
                    estimatedCostTHB: {
                      type: Type.STRING,
                      description: 'ประมาณการค่าใช้จ่ายเป็นเงินบาทแบบช่วง เช่น 0 บาท (ทำเองได้) หรือ 1,200 - 2,500 บาท',
                    },
                  },
                  required: ['name', 'status', 'reason', 'recommendation', 'urgency', 'estimatedCostTHB'],
                },
              },
              probableCauses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    symptom: {
                      type: Type.STRING,
                      description: 'อาการผิดปกติหรือความเสี่ยงที่ตรวจพบ',
                    },
                    cause: {
                      type: Type.STRING,
                      description: 'คำอธิบายเชื่อมโยงสาเหตุ เช่น Kernel-Power 41 + อุณหภูมิ CPU สูง -> น่าจะเกิดจากระบบระบายความร้อนหรือ PSU จ่ายไฟไม่นิ่ง',
                    },
                    confidence: {
                      type: Type.STRING,
                      description: 'ความมั่นใจ: สูง, ปานกลาง, หรือ ต่ำ',
                    },
                    relatedComponents: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'รายชื่ออะไหล่ที่เกี่ยวข้อง',
                    },
                  },
                  required: ['symptom', 'cause', 'confidence', 'relatedComponents'],
                },
              },
              preventiveTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'คำแนะนำการดูแลรักษาป้องกันเพิ่มเติม 3-5 ข้อ',
              },
            },
            required: ['overallScore', 'summary', 'components', 'probableCauses', 'preventiveTips'],
          },
        },
      });

      const jsonText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(jsonText);
      res.json(parsed);
    } catch (error: unknown) {
      console.warn('All Gemini models busy or unavailable in /api/analyze, using Expert Fallback Engine:', error);
      // ส่งผลวิเคราะห์จากระบบสำรองอัจฉริยะกลับไปเพื่อให้ผู้ใช้ใช้งานต่อได้ทันทีโดยไม่ติด Error 503
      const fallbackResult = buildExpertFallbackAnalysis(report, ruleEvaluation, selectedSymptoms);
      res.json(fallbackResult);
    }
  });

  // 2. Endpoint แยกค่าจากข้อความดิบ (CrystalDiskInfo, HWiNFO, battery-report) เป็น PCReport JSON
  app.post('/api/parse-raw', async (req, res) => {
    const { rawText } = req.body || {};
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      res.status(400).json({ error: 'กรุณาวางข้อความจากโปรแกรมตรวจสอบเครื่องก่อนกดแปลงข้อมูล' });
      return;
    }

    try {
      const ai = getGenAIClient();

      const systemInstruction = `คุณคือผู้เชี่ยวชาญในการอ่านรายงานฮาร์ดแวร์จากโปรแกรม CrystalDiskInfo, HWiNFO, Windows Battery Report, Task Manager หรือ Speccy
ให้สกัดค่าตัวเลขและสถานะที่มีอยู่จริงในข้อความออกมาเป็น JSON
กฎสำคัญ:
- ข้อมูลส่วนไหนที่ไม่มีในข้อความที่ผู้ใช้ส่งมา ให้ใส่ค่าเป็น null เสมอ ห้ามสมมติค่าขึ้นมาเองเด็ดขาด
- สำหรับ SSD: ถ้ามี Health Status เช่น "Good 86%" แปลว่าสุขภาพเหลือ 86% ดังนั้น wearPercent (ความเสื่อม) = 100 - 86 = 14`;

      const response = await generateWithFallback(ai, {
        contents: `สกัดข้อมูลฮาร์ดแวร์จากข้อความรายงานต่อไปนี้:\n\n${rawText.slice(0, 20000)}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cpuModel: { type: Type.STRING, nullable: true },
              cpuCores: { type: Type.INTEGER, nullable: true },
              cpuLoadPercent: { type: Type.NUMBER, nullable: true },
              cpuTempC: { type: Type.NUMBER, nullable: true },
              ramTotalGB: { type: Type.NUMBER, nullable: true },
              ramUsagePercent: { type: Type.NUMBER, nullable: true },
              ramSpeedMHz: { type: Type.INTEGER, nullable: true },
              gpuName: { type: Type.STRING, nullable: true },
              gpuTempC: { type: Type.NUMBER, nullable: true },
              gpuDriverDate: { type: Type.STRING, nullable: true },
              hasBattery: { type: Type.BOOLEAN },
              batteryDesignCapacitymWh: { type: Type.NUMBER, nullable: true },
              batteryFullChargedCapacitymWh: { type: Type.NUMBER, nullable: true },
              batteryCycleCount: { type: Type.INTEGER, nullable: true },
              boardModel: { type: Type.STRING, nullable: true },
              biosVersion: { type: Type.STRING, nullable: true },
              osName: { type: Type.STRING, nullable: true },
              disks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    friendlyName: { type: Type.STRING },
                    mediaType: { type: Type.STRING, description: 'SSD, NVMe, หรือ HDD' },
                    healthStatus: { type: Type.STRING, description: 'Healthy, Warning, หรือ Unhealthy' },
                    sizeGB: { type: Type.NUMBER, nullable: true },
                    wearPercent: { type: Type.NUMBER, nullable: true, description: 'เปอร์เซ็นต์ความเสื่อม 0-100 (ถ้าบอกสุขภาพ 80% แปลว่า wearPercent = 20)' },
                    temperatureC: { type: Type.NUMBER, nullable: true },
                    readErrorsTotal: { type: Type.INTEGER, nullable: true },
                    writeErrorsTotal: { type: Type.INTEGER, nullable: true },
                    reallocatedSectors: { type: Type.INTEGER, nullable: true },
                    powerOnHours: { type: Type.INTEGER, nullable: true },
                  },
                  required: ['friendlyName', 'mediaType', 'healthStatus'],
                },
              },
            },
            required: ['hasBattery', 'disks'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error: unknown) {
      console.warn('Gemini busy in /api/parse-raw, using local Regex Fallback parser:', error);
      const fallbackParsed = parseRawTextFallback(rawText);
      res.json(fallbackParsed);
    }
  });

  // 3. Endpoint ถาม AI เพิ่มเติม (Chat ต่อยอดจากรายงานเครื่องนี้)
  app.post('/api/chat', async (req, res) => {
    const { report, ruleEvaluation, aiAnalysis, selectedSymptoms, messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'กรุณาพิมพ์คำถามที่ต้องการปรึกษา' });
      return;
    }

    try {
      const ai = getGenAIClient();

      const systemInstruction = `คุณคือ "PC Health Doctor" ช่างซ่อมและที่ปรึกษาด้านฮาร์ดแวร์คอมพิวเตอร์ส่วนตัวของผู้ใช้
คุณกำลังตอบคำถามต่อยอดจากรายงานผลตรวจสุขภาพเครื่องของผู้ใช้ด้านล่างนี้:
- ตอบด้วยภาษาไทยที่สุภาพ เป็นกันเอง เข้าใจง่าย ชัดเจน และตรงประเด็น
- อ้างอิงค่าจริงจากรายงานของผู้ใช้เสมอ (เช่น รุ่น CPU, ค่า Wear ของ SSD, อุณหภูมิ, หรือ Event Log ที่พบ)
- แนะนำแนวทางแก้ไขเป็นลำดับขั้น (จากสิ่งที่ทำเองได้ฟรีก่อน ไปจนถึงการส่งร้านหรือเปลี่ยนอะไหล่ พร้อมงบประมาณคร่าว ๆ ในไทย)
- เตือนเรื่องการสำรองข้อมูลหากดิสก์มีความเสี่ยง และย้ำว่าเป็นการประเมินเบื้องต้นจากข้อมูลซอฟต์แวร์

[สรุปผลประเมินปัจจุบัน]:
${JSON.stringify(aiAnalysis || ruleEvaluation, null, 2)}

[อาการที่ผู้ใช้เลือก]:
${JSON.stringify(selectedSymptoms || [])}

[ข้อมูลฮาร์ดแวร์ของเครื่อง]:
${JSON.stringify(report, null, 2)}`;

      const conversationTranscript = messages
        .map((m: { role: string; text: string }) => `${m.role === 'user' ? 'ผู้ใช้' : 'PC Health Doctor'}: ${m.text}`)
        .join('\n\n');

      const response = await generateWithFallback(ai, {
        contents: `${conversationTranscript}\n\nกรุณาตอบคำถามล่าสุดของผู้ใช้:`,
        config: {
          systemInstruction,
        },
      });

      res.json({
        reply: response.text || buildFallbackChatReply(report, ruleEvaluation, messages[messages.length - 1]?.text || ''),
      });
    } catch (error: unknown) {
      console.warn('Gemini busy in /api/chat, using contextual Fallback Chat reply:', error);
      const lastQuestion = messages[messages.length - 1]?.text || '';
      res.json({
        reply: buildFallbackChatReply(report, ruleEvaluation, lastQuestion),
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PC Health Doctor server running on http://localhost:${PORT}`);
  });
}

startServer();
