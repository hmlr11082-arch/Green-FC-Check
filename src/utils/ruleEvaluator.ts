import {
  AIAnalysisResult,
  ComponentStatus,
  EvaluatedComponent,
  PCReport,
  ProbableCause,
  RuleEvaluationResult,
  SymptomKey,
  SymptomOption,
} from '../types/pcHealth';

export const SYMPTOM_OPTIONS: SymptomOption[] = [
  { key: 'slow', label: 'เครื่องช้า อืด', description: 'เปิดโปรแกรมช้า สลับหน้าต่างหน่วง' },
  { key: 'freeze', label: 'ค้างบ่อย', description: 'เมาส์ค้าง หน้าจอไม่ตอบสนองเป็นพัก ๆ' },
  { key: 'bsod', label: 'จอฟ้า (BSOD)', description: 'ขึ้นหน้าจอสีฟ้าพร้อมโค้ด Error แล้วรีสตาร์ท' },
  { key: 'shutdown', label: 'เครื่องดับเอง', description: 'เครื่องดับวูบหรือรีสตาร์ทเองโดยไม่ได้สั่ง' },
  { key: 'overheat', label: 'เครื่องร้อน / พัดลมดัง', description: 'ตัวเครื่องร้อนจัดหรือพัดลมหมุนเสียงดังตลอด' },
  { key: 'slow_boot', label: 'เปิดเครื่องนาน', description: 'กดเปิดเครื่องแล้วรอนานมากกว่าปกติกว่าจะพร้อมใช้' },
  { key: 'battery_drain', label: 'แบตหมดเร็ว', description: 'ถอดสายชาร์จแล้วแบตลดฮวบ หรือเครื่องดับทั้งที่แบตเหลือ' },
  { key: 'stutter', label: 'ภาพกระตุก / เล่นเกมแลค', description: 'เฟรมเรตตก ภาพค้างเวลาดูวิดีโอหรือเล่นเกม' },
];

function worseStatus(a: ComponentStatus, b: ComponentStatus): ComponentStatus {
  const rank: Record<ComponentStatus, number> = {
    unknown: 0,
    normal: 1,
    warning: 2,
    critical: 3,
  };
  return rank[b] > rank[a] ? b : a;
}

// ฟังก์ชันประเมินสถานะอะไหล่ด้วยกฎมาตรฐาน (Rule-based Evaluation)
export function evaluatePCReport(
  report: PCReport,
  selectedSymptoms: SymptomKey[] = []
): RuleEvaluationResult {
  const components: EvaluatedComponent[] = [];
  const probableCauses: ProbableCause[] = [];
  const diskRiskReasons: string[] = [];
  let hasDiskRisk = false;

  const eventLogs = report.eventLogs || {
    diskErrorsCount: 0,
    wheaErrorsCount: 0,
    kernelPower41Count: 0,
    bugCheck1001Count: 0,
    appCrashHangCount: 0,
    ntfsErrorsCount: 0,
    gpuDriverCrashCount: 0,
    categories: [],
  };

  // =========================================================
  // 1. ประเมิน CPU
  // กฎ: temp >85°C 🟡, >95°C 🔴; โหลดค้างสูง >90% 🟡; มี WHEA error 🟡/🔴 ตามจำนวน
  // =========================================================
  const cpu = report.cpu;
  if (!cpu || (!cpu.model && cpu.cores === null && cpu.temperatureC === null && cpu.loadPercent === null)) {
    components.push({
      id: 'cpu',
      category: 'cpu',
      name: 'CPU (หน่วยประมวลผลกลาง)',
      modelName: 'ไม่พบข้อมูลรุ่น CPU',
      status: 'unknown',
      progressValue: null,
      progressLabel: 'ข้อมูลไม่เพียงพอ',
      metrics: [
        { label: 'ความเร็ว / คอร์', value: 'ไม่ระบุ' },
        { label: 'อุณหภูมิ', value: 'ตรวจสอบไม่ได้' },
        { label: 'ภาระงาน (Load)', value: 'ตรวจสอบไม่ได้' },
      ],
      ruleReasons: [cpu?.errorReason || 'ไม่มีข้อมูลเซนเซอร์และการทำงานของ CPU'],
      recommendation: 'ตรวจสอบไม่ได้เนื่องจากข้อมูลไม่พอ แนะนำให้รันสคริปต์ PowerShell แบบ Administrator',
      actionType: 'ดูแลตามปกติ',
      urgency: 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: '-',
    });
  } else {
    let cpuStatus: ComponentStatus = 'normal';
    const reasons: string[] = [];

    if (cpu.temperatureC !== null) {
      if (cpu.temperatureC > 95) {
        cpuStatus = worseStatus(cpuStatus, 'critical');
        reasons.push(`อุณหภูมิ CPU สูงวิกฤต (${cpu.temperatureC}°C เกินเกณฑ์ 95°C) เสี่ยงเครื่องดับหรือลดความเร็วตัวเอง`);
      } else if (cpu.temperatureC > 85) {
        cpuStatus = worseStatus(cpuStatus, 'warning');
        reasons.push(`อุณหภูมิ CPU ค่อนข้างสูง (${cpu.temperatureC}°C เกินเกณฑ์ 85°C)`);
      }
    }

    if (cpu.loadPercent !== null && cpu.loadPercent > 90) {
      cpuStatus = worseStatus(cpuStatus, 'warning');
      reasons.push(`ภาระงาน CPU สูงค้างผิดปกติ (${cpu.loadPercent}% เกิน 90%)`);
    }

    if (eventLogs.wheaErrorsCount >= 5) {
      cpuStatus = worseStatus(cpuStatus, 'critical');
      reasons.push(`พบ WHEA-Logger Hardware Error ถึง ${eventLogs.wheaErrorsCount} ครั้งใน 30 วัน บ่งชี้ปัญหาฮาร์ดแวร์ CPU/RAM/ไฟเลี้ยง`);
    } else if (eventLogs.wheaErrorsCount > 0) {
      cpuStatus = worseStatus(cpuStatus, 'warning');
      reasons.push(`พบ WHEA-Logger Hardware Error ${eventLogs.wheaErrorsCount} ครั้งใน 30 วัน ควรเฝ้าระวัง`);
    }

    if (reasons.length === 0) {
      reasons.push('การทำงานของ CPU และภาระงานอยู่ในเกณฑ์ปกติ');
    }

    let recommendation = 'ดูแลตามปกติ ไม่พบความผิดปกติของ CPU';
    let actionType = 'ดูแลตามปกติ';
    let urgency = 'ไม่ต้องดำเนินการ';
    let cost = '0 บาท';

    if (cpuStatus === 'critical') {
      recommendation = 'ทำความสะอาดพัดลมระบายความร้อนและทาซิลิโคนใหม่ทันที หากได้ทำการ Overclock ควรรีเซ็ตค่า BIOS กลับเป็นค่าโรงงาน';
      actionType = 'ทำความสะอาด';
      urgency = 'ด่วนที่สุด (ทันที)';
      cost = '300 - 800 บาท (ค่าแรงทำความสะอาดและทาซิลิโคนเกรดดี)';
    } else if (cpuStatus === 'warning') {
      recommendation = 'ทำความสะอาดช่องระบายอากาศ เช็กโปรแกรมเบื้องหลังใน Task Manager ที่กิน CPU สูง และพิจารณาเปลี่ยนซิลิโคนระบายความร้อน';
      actionType = 'ทำความสะอาด';
      urgency = 'ควรทำภายใน 1-2 สัปดาห์';
      cost = '0 - 500 บาท';
    }

    const tempOrLoadScore =
      cpu.temperatureC !== null
        ? Math.min(100, Math.max(10, Math.round(100 - Math.max(0, cpu.temperatureC - 45) * 1.5)))
        : cpu.loadPercent !== null
        ? Math.max(15, 100 - cpu.loadPercent)
        : 85;

    components.push({
      id: 'cpu',
      category: 'cpu',
      name: 'CPU (หน่วยประมวลผลกลาง)',
      modelName: cpu.model || 'CPU มาตรฐาน',
      status: cpuStatus,
      progressValue: tempOrLoadScore,
      progressLabel: cpu.temperatureC !== null ? `อุณหภูมิ ${cpu.temperatureC}°C` : `ใช้งาน ${cpu.loadPercent ?? 0}%`,
      metrics: [
        {
          label: 'จำนวนคอร์ / เธรด',
          value: cpu.cores ? `${cpu.cores} Cores / ${cpu.logicalProcessors ?? cpu.cores} Threads` : 'ไม่ระบุ',
        },
        {
          label: 'อุณหภูมิ CPU',
          value: cpu.temperatureC !== null ? `${cpu.temperatureC} °C` : 'ไม่มีเซนเซอร์',
          isAlert: cpu.temperatureC !== null && cpu.temperatureC > 85,
        },
        {
          label: 'โหลด / WHEA Error',
          value: `${cpu.loadPercent !== null ? `${cpu.loadPercent}%` : '-'} / WHEA ${eventLogs.wheaErrorsCount} ครั้ง`,
          isAlert: (cpu.loadPercent !== null && cpu.loadPercent > 90) || eventLogs.wheaErrorsCount > 0,
        },
      ],
      ruleReasons: reasons,
      recommendation,
      actionType,
      urgency,
      estimatedCostTHB: cost,
    });
  }

  // =========================================================
  // 2. ประเมิน RAM
  // กฎ: ใช้งาน >85% 🟡, >95% 🔴; มี WHEA/memory diagnostic error 🔴 (แนะนำ MemTest86)
  // =========================================================
  const ram = report.ram;
  if (!ram || (ram.totalGB === null && ram.usagePercent === null)) {
    components.push({
      id: 'ram',
      category: 'ram',
      name: 'RAM (หน่วยความจำหลัก)',
      modelName: 'ไม่พบข้อมูลขนาด RAM',
      status: 'unknown',
      progressValue: null,
      progressLabel: 'ข้อมูลไม่เพียงพอ',
      metrics: [
        { label: 'ความจุรวม', value: 'ตรวจสอบไม่ได้' },
        { label: 'การใช้งาน', value: 'ตรวจสอบไม่ได้' },
        { label: 'ผลตรวจ Memory Diag', value: 'ไม่ระบุ' },
      ],
      ruleReasons: [ram?.errorReason || 'ไม่สามารถอ่านค่าความจุและการใช้งาน RAM ได้'],
      recommendation: 'ตรวจสอบไม่ได้ แนะนำให้ใช้ไฟล์รายงานจากสคริปต์ PowerShell',
      actionType: 'ดูแลตามปกติ',
      urgency: 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: '-',
    });
  } else {
    let ramStatus: ComponentStatus = 'normal';
    const reasons: string[] = [];

    const hasMemDiagFail =
      typeof ram.memoryDiagnosticResult === 'string' &&
      ram.memoryDiagnosticResult.toLowerCase().includes('fail');

    if (hasMemDiagFail || eventLogs.wheaErrorsCount >= 3) {
      ramStatus = worseStatus(ramStatus, 'critical');
      reasons.push(
        hasMemDiagFail
          ? 'ตรวจพบข้อผิดพลาดจาก Windows Memory Diagnostic (แรมอาจมีเซลล์ความจำเสีย)'
          : `พบ WHEA Hardware Error (${eventLogs.wheaErrorsCount} ครั้ง) ซึ่งมักเกี่ยวข้องกับ RAM หรือการตั้งค่า XMP`
      );
    }

    if (ram.usagePercent !== null) {
      if (ram.usagePercent > 95) {
        ramStatus = worseStatus(ramStatus, 'critical');
        reasons.push(`RAM ถูกใช้งานเกือบเต็ม (${ram.usagePercent}% เกิน 95%) ทำให้เครื่องค้างและสลับใช้ดิสก์ (Pagefile) หนัก`);
      } else if (ram.usagePercent > 85) {
        ramStatus = worseStatus(ramStatus, 'warning');
        reasons.push(`RAM ถูกใช้งานสูง (${ram.usagePercent}% เกิน 85%) อาจไม่พอเมื่อเปิดหลายโปรแกรมพร้อมกัน`);
      }
    }

    if (reasons.length === 0) {
      reasons.push('ปริมาณ RAM เพียงพอต่อการใช้งาน และไม่พบข้อผิดพลาดของหน่วยความจำ');
    }

    let recommendation = 'ดูแลตามปกติ ปิดโปรแกรมที่ไม่ใช้งานเมื่อต้องทำงานหนัก';
    let actionType = 'ดูแลตามปกติ';
    let urgency = 'ไม่ต้องดำเนินการ';
    let cost = '0 บาท';

    if (hasMemDiagFail || eventLogs.wheaErrorsCount >= 3) {
      recommendation =
        'ควรทดสอบแรมอย่างละเอียดด้วยโปรแกรม MemTest86 ทันที ลองถอดแรมมาทำความสะอาดหน้าสัมผัสด้วยยางลบ หรือเปลี่ยนแถวแรมที่มีปัญหา';
      actionType = 'เปลี่ยน';
      urgency = 'ด่วนที่สุด (ทันที)';
      cost = '800 - 2,200 บาท (หากต้องเปลี่ยนหรือเพิ่ม RAM DDR4/DDR5 8GB-16GB)';
    } else if (ramStatus === 'critical' || ramStatus === 'warning') {
      recommendation =
        'ปิดโปรแกรมที่รันเบื้องหลังเกินจำเป็น หรืออัปเกรดเพิ่มขนาด RAM อีก 8GB-16GB เพื่อให้เปิดโปรแกรมควบคู่กันได้ลื่นไหล';
      actionType = 'เปลี่ยน';
      urgency = 'ควรทำภายใน 1-2 สัปดาห์';
      cost = '750 - 1,800 บาท (ค่าอัปเกรดเพิ่มแถว RAM)';
    }

    components.push({
      id: 'ram',
      category: 'ram',
      name: 'RAM (หน่วยความจำหลัก)',
      modelName: `${ram.totalGB ?? '?'} GB ${ram.speedMHz ? `(${ram.speedMHz} MHz)` : ''} ${
        ram.slotsUsed ? `[ใช้ ${ram.slotsUsed}/${ram.slotsTotal ?? ram.slotsUsed} สล็อต]` : ''
      }`.trim(),
      status: ramStatus,
      progressValue: ram.usagePercent !== null ? Math.max(5, Math.round(100 - ram.usagePercent)) : 80,
      progressLabel: ram.usagePercent !== null ? `ใช้งานอยู่ ${ram.usagePercent}% (เหลือ ${Math.max(0, 100 - ram.usagePercent).toFixed(0)}%)` : 'ปกติ',
      metrics: [
        {
          label: 'ความจุ / ความเร็ว',
          value: `${ram.totalGB ?? '-'} GB ${ram.speedMHz ? `@ ${ram.speedMHz} MHz` : ''}`,
        },
        {
          label: 'ใช้งานปัจจุบัน',
          value: ram.usagePercent !== null ? `${ram.usagePercent}% (${ram.usedGB ?? '-'} GB)` : 'ไม่ระบุ',
          isAlert: ram.usagePercent !== null && ram.usagePercent > 85,
        },
        {
          label: 'ผล Memory Diagnostic',
          value: hasMemDiagFail ? 'พบข้อผิดพลาด (Fail)' : ram.memoryDiagnosticResult === 'Pass' ? 'ผ่านปกติ (Pass)' : 'ไม่มีประวัติ Error',
          isAlert: hasMemDiagFail,
        },
      ],
      ruleReasons: reasons,
      recommendation,
      actionType,
      urgency,
      estimatedCostTHB: cost,
    });
  }

  // =========================================================
  // 3. ประเมินดิสก์แต่ละลูก (SSD / HDD) + พื้นที่ว่างไดรฟ์ระบบ
  // กฎ SSD: wear ≥80% 🔴, 50–79% 🟡; temp >70°C 🟡, >80°C 🔴; read/write error > 0 🟡, เพิ่มขึ้นต่อเนื่อง 🔴
  // กฎ HDD: HealthStatus ≠ Healthy 🔴; reallocated/pending sector > 0 🟡, > 50 🔴; temp >50°C 🟡, >60°C 🔴; PowerOnHours > 30,000 🟡
  // พื้นที่ว่างไดรฟ์ระบบ: <15% 🟡, <5% 🔴
  // =========================================================
  const sysDrive =
    (report.logicalDrives || []).find((d) => d.isSystemDrive || d.driveLetter.toUpperCase().startsWith('C')) ||
    (report.logicalDrives || [])[0] ||
    null;

  if (!report.disks || report.disks.length === 0) {
    components.push({
      id: 'disk-0',
      category: 'disk',
      name: 'ดิสก์เก็บข้อมูล (Storage)',
      modelName: 'ไม่พบข้อมูล Physical Disk',
      status: 'unknown',
      progressValue: null,
      progressLabel: 'ข้อมูลไม่เพียงพอ',
      metrics: [
        { label: 'สถานะ SMART', value: 'ตรวจสอบไม่ได้' },
        { label: 'ความเสื่อม (Wear)', value: 'ไม่ระบุ' },
        { label: 'พื้นที่ว่างไดรฟ์หลัก', value: sysDrive?.freePercent != null ? `${sysDrive.freePercent}%` : 'ไม่ระบุ' },
      ],
      ruleReasons: ['ไม่มีข้อมูล SMART ของดิสก์ (ต้องรัน PowerShell หรืออัปโหลดรายงาน)'],
      recommendation: 'ตรวจสอบไม่ได้ แนะนำให้รันสคริปต์ pc-check.ps1 ด้วยสิทธิ์ Administrator',
      actionType: 'ดูแลตามปกติ',
      urgency: 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: '-',
    });
  } else {
    report.disks.forEach((disk, idx) => {
      const isUnknownDisk =
        disk.healthStatus === 'Unknown' &&
        disk.wearPercent === null &&
        disk.temperatureC === null &&
        disk.readErrorsTotal === null;

      if (isUnknownDisk) {
        components.push({
          id: `disk-${disk.id || idx}`,
          category: 'disk',
          name: `ดิสก์ลูกที่ ${idx + 1} (${disk.mediaType || 'Disk'})`,
          modelName: disk.friendlyName || `Disk #${idx}`,
          status: 'unknown',
          progressValue: null,
          progressLabel: 'ข้อมูล SMART ไม่เพียงพอ',
          metrics: [
            { label: 'ความจุ', value: disk.sizeGB ? `${disk.sizeGB} GB` : 'ไม่ระบุ' },
            { label: 'สถานะสุขภาพ', value: 'ตรวจสอบไม่ได้' },
            { label: 'อุณหภูมิ', value: 'ไม่ระบุ' },
          ],
          ruleReasons: [disk.errorReason || 'ไม่สามารถอ่านค่า SMART Reliability Counter ได้'],
          recommendation: 'เปิด PowerShell แบบ Run as Administrator แล้วรันสคริปต์อีกครั้งเพื่อดูค่าความเสื่อมของดิสก์',
          actionType: 'ดูแลตามปกติ',
          urgency: 'ไม่ต้องดำเนินการ',
          estimatedCostTHB: '-',
        });
        return;
      }

      let diskStatus: ComponentStatus = 'normal';
      const reasons: string[] = [];
      const mediaUpper = (disk.mediaType || '').toUpperCase();
      const isHDD = mediaUpper.includes('HDD');

      if (disk.healthStatus && disk.healthStatus !== 'Healthy' && disk.healthStatus !== 'Unknown') {
        diskStatus = worseStatus(diskStatus, 'critical');
        reasons.push(`สถานะสุขภาพดิสก์รายงานว่า "${disk.healthStatus}" (ไม่ปกติ)`);
      }

      if (!isHDD) {
        // กฎสำหรับ SSD / NVMe
        if (disk.wearPercent !== null) {
          if (disk.wearPercent >= 80) {
            diskStatus = worseStatus(diskStatus, 'critical');
            reasons.push(`ค่าความเสื่อมของ SSD (Wear) สูงถึง ${disk.wearPercent}% (เกินเกณฑ์อันตราย 80%) เสี่ยงพังกะทันหัน`);
          } else if (disk.wearPercent >= 50) {
            diskStatus = worseStatus(diskStatus, 'warning');
            reasons.push(`ค่าความเสื่อมของ SSD (Wear) อยู่ที่ ${disk.wearPercent}% (อยู่ในช่วงเฝ้าระวัง 50–79%)`);
          }
        }

        if (disk.temperatureC !== null) {
          if (disk.temperatureC > 80) {
            diskStatus = worseStatus(diskStatus, 'critical');
            reasons.push(`อุณหภูมิ SSD ร้อนจัด (${disk.temperatureC}°C เกิน 80°C)`);
          } else if (disk.temperatureC > 70) {
            diskStatus = worseStatus(diskStatus, 'warning');
            reasons.push(`อุณหภูมิ SSD ค่อนข้างร้อน (${disk.temperatureC}°C เกิน 70°C)`);
          }
        }
      } else {
        // กฎสำหรับ HDD
        if (disk.reallocatedSectors !== null && disk.reallocatedSectors > 0) {
          if (disk.reallocatedSectors > 50) {
            diskStatus = worseStatus(diskStatus, 'critical');
            reasons.push(`พบ Bad/Reallocated Sector สูงถึง ${disk.reallocatedSectors} จุด (เกิน 50 จุด) จานแม่เหล็กเริ่มเสีย`);
          } else {
            diskStatus = worseStatus(diskStatus, 'warning');
            reasons.push(`เริ่มพบ Reallocated/Pending Sector จำนวน ${disk.reallocatedSectors} จุด`);
          }
        }

        if (disk.temperatureC !== null) {
          if (disk.temperatureC > 60) {
            diskStatus = worseStatus(diskStatus, 'critical');
            reasons.push(`อุณหภูมิฮาร์ดดิสก์ HDD ร้อนจัด (${disk.temperatureC}°C เกิน 60°C)`);
          } else if (disk.temperatureC > 50) {
            diskStatus = worseStatus(diskStatus, 'warning');
            reasons.push(`อุณหภูมิฮาร์ดดิสก์ HDD สูง (${disk.temperatureC}°C เกิน 50°C)`);
          }
        }

        if (disk.powerOnHours !== null && disk.powerOnHours > 30000) {
          diskStatus = worseStatus(diskStatus, 'warning');
          reasons.push(`ชั่วโมงการทำงานสะสมสูง (${disk.powerOnHours.toLocaleString()} ชั่วโมง เกิน 30,000 ชม.) อายุการใช้งานมากแล้ว`);
        }
      }

      // ตรวจสอบ Read / Write Errors และ Disk Event Log
      const totalRWError = (disk.readErrorsTotal ?? 0) + (disk.writeErrorsTotal ?? 0);
      if (totalRWError > 20 || (totalRWError > 0 && eventLogs.diskErrorsCount >= 5)) {
        diskStatus = worseStatus(diskStatus, 'critical');
        reasons.push(
          `พบ Read/Write Error สะสม ${totalRWError} ครั้ง ร่วมกับ Disk Event Log Error ${eventLogs.diskErrorsCount} ครั้ง`
        );
      } else if (totalRWError > 0 || (idx === 0 && eventLogs.diskErrorsCount > 0)) {
        diskStatus = worseStatus(diskStatus, 'warning');
        reasons.push(
          `พบประวัติการอ่าน/เขียนข้อมูลสะดุด (Read/Write Error ${totalRWError} ครั้ง, Disk Event Log ${eventLogs.diskErrorsCount} ครั้ง)`
        );
      }

      // ตรวจสอบพื้นที่ว่างไดรฟ์ระบบสำหรับดิสก์ลูกแรก
      if (idx === 0 && sysDrive && sysDrive.freePercent !== null) {
        if (sysDrive.freePercent < 5) {
          diskStatus = worseStatus(diskStatus, 'critical');
          reasons.push(
            `พื้นที่ว่างไดรฟ์ระบบ (${sysDrive.driveLetter}) เหลือเพียง ${sysDrive.freePercent}% (${sysDrive.freeGB} GB) น้อยกว่า 5% ทำให้เครื่องช้าและค้างหนัก`
          );
        } else if (sysDrive.freePercent < 15) {
          diskStatus = worseStatus(diskStatus, 'warning');
          reasons.push(
            `พื้นที่ว่างไดรฟ์ระบบ (${sysDrive.driveLetter}) เหลือ ${sysDrive.freePercent}% (${sysDrive.freeGB} GB) น้อยกว่า 15%`
          );
        }
      }

      // เช็กสัญญาณเสี่ยงของดิสก์เพื่อแสดงแบนเนอร์สีแดง "สำรองข้อมูลทันที"
      const isHardwareDiskRisk =
        disk.healthStatus !== 'Healthy' ||
        (disk.wearPercent !== null && disk.wearPercent >= 50) ||
        totalRWError > 0 ||
        (disk.reallocatedSectors !== null && disk.reallocatedSectors > 0) ||
        eventLogs.diskErrorsCount > 0 ||
        eventLogs.ntfsErrorsCount > 0;

      if (isHardwareDiskRisk) {
        hasDiskRisk = true;
        reasons.forEach((r) => {
          if (!diskRiskReasons.includes(r)) {
            diskRiskReasons.push(`${disk.friendlyName}: ${r}`);
          }
        });
      }

      if (reasons.length === 0) {
        reasons.push('สุขภาพดิสก์แข็งแรง ไม่พบ Bad Sector หรือข้อผิดพลาดในการอ่านเขียน');
      }

      let recommendation = 'ดูแลตามปกติ ควรเหลือพื้นที่ว่างอย่างน้อย 15–20% เสมอ';
      let actionType = 'ดูแลตามปกติ';
      let urgency = 'ไม่ต้องดำเนินการ';
      let cost = '0 บาท';

      if (diskStatus === 'critical') {
        recommendation =
          'สำรองข้อมูลสำคัญออกจากดิสก์ลูกนี้ทันที! และควรเปลี่ยนเป็น SSD ลูกใหม่เพื่อป้องกันข้อมูลสูญหายและแก้ปัญหาเครื่องค้าง';
        actionType = 'สำรองข้อมูลก่อน';
        urgency = 'ด่วนที่สุด (ทันที)';
        cost = '1,200 - 2,800 บาท (ค่าเปลี่ยน SSD NVMe/SATA 500GB - 1TB)';
      } else if (diskStatus === 'warning') {
        recommendation =
          isHardwareDiskRisk
            ? 'สำรองข้อมูลสำคัญเก็บไว้ก่อน และหมั่นตรวจเช็กค่า Wear/Error ทุกเดือน หากเป็นไดรฟ์เต็มให้ลบไฟล์ขยะด้วย Storage Sense'
            : 'ลบไฟล์ขยะและถอนโปรแกรมที่ไม่ใช้เพื่อคืนพื้นที่ว่างไดรฟ์หลักให้มากกว่า 15%';
        actionType = isHardwareDiskRisk ? 'สำรองข้อมูลก่อน' : 'ทำความสะอาด';
        urgency = 'ควรทำภายใน 1-2 สัปดาห์';
        cost = isHardwareDiskRisk ? '0 - 2,200 บาท (สำรองข้อมูลฟรี / เตรียมงบเปลี่ยน SSD)' : '0 บาท (ลบไฟล์ขยะเองได้)';
      }

      const healthRemaining =
        disk.wearPercent !== null
          ? Math.max(0, 100 - disk.wearPercent)
          : diskStatus === 'critical'
          ? 25
          : diskStatus === 'warning'
          ? 65
          : 95;

      components.push({
        id: `disk-${disk.id || idx}`,
        category: 'disk',
        name: `ดิสก์ลูกที่ ${idx + 1} (${disk.mediaType || 'Storage'})`,
        modelName: `${disk.friendlyName}${disk.sizeGB ? ` (${disk.sizeGB} GB)` : ''}`,
        status: diskStatus,
        progressValue: healthRemaining,
        progressLabel:
          disk.wearPercent !== null
            ? `ความเสื่อม (Wear) ${disk.wearPercent}% · สุขภาพเหลือ ${100 - disk.wearPercent}%`
            : `สถานะ ${disk.healthStatus}`,
        metrics: [
          {
            label: isHDD ? 'ชั่วโมงทำงาน / Reallocated' : 'ความเสื่อม (Wear) / สถานะ',
            value: isHDD
              ? `${disk.powerOnHours ? `${disk.powerOnHours.toLocaleString()} ชม.` : '-'} / Bad ${disk.reallocatedSectors ?? 0}`
              : `${disk.wearPercent !== null ? `Wear ${disk.wearPercent}%` : 'ไม่ระบุ'} (${disk.healthStatus})`,
            isAlert:
              disk.healthStatus !== 'Healthy' ||
              (disk.wearPercent !== null && disk.wearPercent >= 50) ||
              (disk.reallocatedSectors !== null && disk.reallocatedSectors > 0),
          },
          {
            label: 'อุณหภูมิ / Read-Write Error',
            value: `${disk.temperatureC !== null ? `${disk.temperatureC} °C` : '-'} / Error ${totalRWError} ครั้ง`,
            isAlert:
              (disk.temperatureC !== null && disk.temperatureC > (isHDD ? 50 : 70)) || totalRWError > 0,
          },
          {
            label: idx === 0 && sysDrive ? `พื้นที่ว่างไดรฟ์ ${sysDrive.driveLetter}` : 'ชั่วโมงเปิดใช้งาน',
            value:
              idx === 0 && sysDrive && sysDrive.freePercent !== null
                ? `ว่าง ${sysDrive.freePercent}% (${sysDrive.freeGB} GB)`
                : disk.powerOnHours !== null
                ? `${disk.powerOnHours.toLocaleString()} ชั่วโมง`
                : 'ไม่ระบุ',
            isAlert: idx === 0 && sysDrive?.freePercent != null && sysDrive.freePercent < 15,
          },
        ],
        ruleReasons: reasons,
        recommendation,
        actionType,
        urgency,
        estimatedCostTHB: cost,
      });
    });
  }

  // =========================================================
  // 4. ประเมิน GPU (การ์ดจอ)
  // กฎ: ไดรเวอร์เก่ากว่า 12 เดือน 🟡; มี driver crash (TDR/Event 4101) ซ้ำ 🟡/🔴; temp >85°C 🟡
  // =========================================================
  const gpu = report.gpu;
  if (!gpu || !gpu.name) {
    components.push({
      id: 'gpu',
      category: 'gpu',
      name: 'GPU (การ์ดจอแสดงผล)',
      modelName: 'ไม่พบข้อมูลการ์ดจอ',
      status: 'unknown',
      progressValue: null,
      progressLabel: 'ข้อมูลไม่เพียงพอ',
      metrics: [
        { label: 'รุ่นการ์ดจอ', value: 'ตรวจสอบไม่ได้' },
        { label: 'วันที่ไดรเวอร์', value: 'ไม่ระบุ' },
        { label: 'ประวัติไดรเวอร์ค้าง', value: 'ไม่ระบุ' },
      ],
      ruleReasons: [gpu?.errorReason || 'ไม่พบข้อมูลการ์ดจอจากรายงาน'],
      recommendation: 'ตรวจสอบไม่ได้ แนะนำให้รันสคริปต์ตรวจเครื่องหรือเปิดใช้ Browser Probe',
      actionType: 'ดูแลตามปกติ',
      urgency: 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: '-',
    });
  } else {
    let gpuStatus: ComponentStatus = 'normal';
    const reasons: string[] = [];

    let driverMonthsOld: number | null = null;
    if (gpu.driverDate) {
      const parsedDate = new Date(gpu.driverDate);
      if (!isNaN(parsedDate.getTime())) {
        const diffMs = Date.now() - parsedDate.getTime();
        driverMonthsOld = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
        if (driverMonthsOld > 12) {
          gpuStatus = worseStatus(gpuStatus, 'warning');
          reasons.push(`ไดรเวอร์การ์ดจอเก่ากว่า 12 เดือน (อัปเดตล่าสุดเมื่อ ${gpu.driverDate} หรือประมาณ ${driverMonthsOld} เดือนก่อน)`);
        }
      }
    }

    const tdrCount = gpu.tdrCrashCount30Days ?? eventLogs.gpuDriverCrashCount ?? 0;
    if (tdrCount >= 5) {
      gpuStatus = worseStatus(gpuStatus, 'critical');
      reasons.push(`พบอาการไดรเวอร์การ์ดจอหยุดทำงาน (Event 4101 / TDR Crash) ซ้ำถึง ${tdrCount} ครั้งใน 30 วัน`);
    } else if (tdrCount > 0) {
      gpuStatus = worseStatus(gpuStatus, 'warning');
      reasons.push(`พบประวัติไดรเวอร์การ์ดจอรีเซ็ตตัวเอง (Event 4101) ${tdrCount} ครั้งใน 30 วัน`);
    }

    if (gpu.temperatureC !== null && gpu.temperatureC > 85) {
      gpuStatus = worseStatus(gpuStatus, 'warning');
      reasons.push(`อุณหภูมิการ์ดจอสูง (${gpu.temperatureC}°C เกินเกณฑ์ 85°C)`);
    }

    if (gpu.status && gpu.status !== 'OK') {
      gpuStatus = worseStatus(gpuStatus, 'critical');
      reasons.push(`สถานะอุปกรณ์ใน Windows แจ้งว่า "${gpu.status}"`);
    }

    if (reasons.length === 0) {
      reasons.push('การ์ดจอและไดรเวอร์ทำงานปกติ ไม่พบประวัติไดรเวอร์หลุด');
    }

    let recommendation = 'ดูแลตามปกติ อัปเดตไดรเวอร์เมื่อมีเวอร์ชันเสถียรใหม่';
    let actionType = 'ดูแลตามปกติ';
    let urgency = 'ไม่ต้องดำเนินการ';
    let cost = '0 บาท';

    if (gpuStatus === 'critical') {
      recommendation =
        'ลบไดรเวอร์การ์ดจอเดิมด้วยโปรแกรม DDU (Display Driver Uninstaller) แล้วลงไดรเวอร์ใหม่ และตรวจเช็กความร้อนหรือสายไฟเลี้ยงการ์ดจอ';
      actionType = 'อัปเดต';
      urgency = 'ด่วนที่สุด (ทันที)';
      cost = '0 - 800 บาท (ลบลงไดรเวอร์เองฟรี หรือส่งช่างเช็กภาคจ่ายไฟ/ทำความสะอาด)';
    } else if (gpuStatus === 'warning') {
      recommendation =
        'อัปเดตไดรเวอร์การ์ดจอ (NVIDIA / AMD / Intel) ให้เป็นเวอร์ชันปัจจุบัน และทำความสะอาดฝุ่นบริเวณพัดลมการ์ดจอ';
      actionType = 'อัปเดต';
      urgency = 'ควรทำภายใน 1-2 สัปดาห์';
      cost = '0 บาท (อัปเดตไดรเวอร์เองได้ฟรี)';
    }

    components.push({
      id: 'gpu',
      category: 'gpu',
      name: 'GPU (การ์ดจอแสดงผล)',
      modelName: `${gpu.name}${gpu.vramGB ? ` (${gpu.vramGB} GB)` : ''}`,
      status: gpuStatus,
      progressValue: gpuStatus === 'critical' ? 35 : gpuStatus === 'warning' ? 68 : 94,
      progressLabel: gpu.driverDate ? `ไดรเวอร์วันที่ ${gpu.driverDate}` : `สถานะ ${gpu.status || 'OK'}`,
      metrics: [
        {
          label: 'เวอร์ชัน / วันที่ไดรเวอร์',
          value: gpu.driverDate
            ? `${gpu.driverDate}${driverMonthsOld !== null ? ` (${driverMonthsOld} เดือน)` : ''}`
            : gpu.driverVersion || 'ไม่ระบุ',
          isAlert: driverMonthsOld !== null && driverMonthsOld > 12,
        },
        {
          label: 'ไดรเวอร์ค้าง (Event 4101)',
          value: `${tdrCount} ครั้ง (ใน 30 วัน)`,
          isAlert: tdrCount > 0,
        },
        {
          label: 'อุณหภูมิ / สถานะ',
          value: `${gpu.temperatureC !== null ? `${gpu.temperatureC} °C` : 'ปกติ'} / ${gpu.status || 'OK'}`,
          isAlert: (gpu.temperatureC !== null && gpu.temperatureC > 85) || (gpu.status !== null && gpu.status !== 'OK'),
        },
      ],
      ruleReasons: reasons,
      recommendation,
      actionType,
      urgency,
      estimatedCostTHB: cost,
    });
  }

  // =========================================================
  // 5. ประเมินแบตเตอรี่ (โน้ตบุ๊ก)
  // กฎ: สุขภาพ <80% 🟡, <60% 🔴
  // =========================================================
  const bat = report.battery;
  if (!bat || (!bat.hasBattery && bat.healthPercent === null)) {
    components.push({
      id: 'battery',
      category: 'battery',
      name: 'แบตเตอรี่ (สำหรับโน้ตบุ๊ก)',
      modelName: bat?.hasBattery === false ? 'เครื่องตั้งโต๊ะ (Desktop PC / ไม่มีแบตเตอรี่)' : 'ไม่พบข้อมูลแบตเตอรี่',
      status: 'unknown',
      progressValue: null,
      progressLabel: 'ไม่พบแบตเตอรี่ / ตรวจสอบไม่ได้',
      metrics: [
        { label: 'สุขภาพแบตเตอรี่', value: 'ไม่มีข้อมูล / เครื่อง PC' },
        { label: 'ความจุเต็มเทียบโรงงาน', value: '-' },
        { label: 'จำนวนรอบชาร์จ (Cycle)', value: '-' },
      ],
      ruleReasons: [bat?.errorReason || 'ไม่พบแบตเตอรี่ในระบบ (หากเป็น PC ตั้งโต๊ะ แนะนำให้ใช้เครื่องสำรองไฟ UPS)'],
      recommendation: 'หากเป็นคอมพิวเตอร์ตั้งโต๊ะ (PC) แนะนำให้ต่อผ่านปลั๊กกันไฟกระชากหรือเครื่องสำรองไฟ (UPS) เพื่อถนอมพาวเวอร์ซัพพลายและดิสก์',
      actionType: 'ดูแลตามปกติ',
      urgency: 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: '-',
    });
  } else {
    let batStatus: ComponentStatus = 'normal';
    const reasons: string[] = [];

    const healthPct =
      bat.healthPercent !== null
        ? bat.healthPercent
        : bat.designCapacitymWh && bat.fullChargedCapacitymWh
        ? Math.round((bat.fullChargedCapacitymWh / bat.designCapacitymWh) * 100)
        : null;

    if (healthPct === null) {
      batStatus = 'unknown';
      reasons.push('พบแบตเตอรี่แต่ไม่สามารถอ่านค่าความจุโรงงานเทียบความจุปัจจุบันได้');
    } else if (healthPct < 60) {
      batStatus = 'critical';
      reasons.push(`สุขภาพแบตเตอรี่เสื่อมสภาพมาก เหลือเพียง ${healthPct}% (ต่ำกว่าเกณฑ์ 60%) เสี่ยงแบตบวมหรือเครื่องดับทันทีเมื่อถอดสายชาร์จ`);
    } else if (healthPct < 80) {
      batStatus = 'warning';
      reasons.push(`สุขภาพแบตเตอรี่เริ่มเสื่อม เหลือ ${healthPct}% (ต่ำกว่าเกณฑ์ 80%) เก็บไฟได้น้อยลง`);
    } else {
      reasons.push(`สุขภาพแบตเตอรี่ยังดี (${healthPct}%) เก็บประจุไฟได้ตามปกติ`);
    }

    let recommendation = 'ดูแลตามปกติ หลีกเลี่ยงการปล่อยให้แบตร้อนจัดหรือแบตหมดเกลี้ยง 0% บ่อย ๆ';
    let actionType = 'ดูแลตามปกติ';
    let urgency = 'ไม่ต้องดำเนินการ';
    let cost = '0 บาท';

    if (batStatus === 'critical') {
      recommendation =
        'ควรเปลี่ยนแบตเตอรี่ก้อนใหม่ โดยเฉพาะหากสังเกตเห็นทัชแพดนูนหรือตัวเครื่องอ้า (แบตบวม) เพื่อความปลอดภัย';
      actionType = 'เปลี่ยน';
      urgency = 'ควรทำภายใน 1-2 สัปดาห์';
      cost = '1,500 - 3,200 บาท (ค่าเปลี่ยนแบตเตอรี่โน้ตบุ๊กตรงรุ่น)';
    } else if (batStatus === 'warning') {
      recommendation =
        'เปิดโหมดถนอมแบตเตอรี่ (Battery Conservation / Limit Charge 80%) เมื่อเสียบสายชาร์จใช้งานอยู่กับที่';
      actionType = 'ดูแลตามปกติ';
      urgency = 'เฝ้าระวัง';
      cost = '0 - 2,500 บาท (ยังไม่จำเป็นต้องเปลี่ยนทันทีหากยังพกพาใช้งานได้พอเพียง)';
    }

    components.push({
      id: 'battery',
      category: 'battery',
      name: 'แบตเตอรี่ (สำหรับโน้ตบุ๊ก)',
      modelName: bat.name || 'แบตเตอรี่มาตรฐานภายในเครื่อง',
      status: batStatus,
      progressValue: healthPct,
      progressLabel: healthPct !== null ? `สุขภาพแบตเตอรี่ ${healthPct}%` : 'ไม่ทราบความจุ',
      metrics: [
        {
          label: 'สุขภาพแบตเตอรี่ (Health)',
          value: healthPct !== null ? `${healthPct}%` : 'ไม่ระบุ',
          isAlert: healthPct !== null && healthPct < 80,
        },
        {
          label: 'ความจุปัจจุบัน / โรงงาน',
          value:
            bat.fullChargedCapacitymWh && bat.designCapacitymWh
              ? `${bat.fullChargedCapacitymWh.toLocaleString()} / ${bat.designCapacitymWh.toLocaleString()} mWh`
              : 'ไม่ระบุ',
        },
        {
          label: 'รอบการชาร์จ (Cycle Count)',
          value: bat.cycleCount !== null ? `${bat.cycleCount} รอบ` : 'ไม่ระบุ',
        },
      ],
      ruleReasons: reasons,
      recommendation,
      actionType,
      urgency,
      estimatedCostTHB: cost,
    });
  }

  // =========================================================
  // 6. ประเมิน Mainboard / BIOS
  // =========================================================
  const mb = report.mainboard;
  if (!mb || (!mb.boardProduct && !mb.biosVersion)) {
    components.push({
      id: 'mainboard',
      category: 'mainboard',
      name: 'Mainboard / BIOS',
      modelName: 'ไม่พบข้อมูลเมนบอร์ดและ BIOS',
      status: 'unknown',
      progressValue: null,
      progressLabel: 'ข้อมูลไม่เพียงพอ',
      metrics: [
        { label: 'รุ่นเมนบอร์ด', value: 'ตรวจสอบไม่ได้' },
        { label: 'เวอร์ชัน BIOS', value: 'ไม่ระบุ' },
        { label: 'วันที่ BIOS', value: 'ไม่ระบุ' },
      ],
      ruleReasons: [mb?.errorReason || 'ไม่พบข้อมูลเมนบอร์ดในรายงาน'],
      recommendation: 'ตรวจสอบไม่ได้ ต้องใช้ไฟล์ pc-report.json จากสคริปต์ PowerShell',
      actionType: 'ดูแลตามปกติ',
      urgency: 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: '-',
    });
  } else {
    let mbStatus: ComponentStatus = 'normal';
    const reasons: string[] = [];

    if (eventLogs.wheaErrorsCount >= 5 && eventLogs.kernelPower41Count >= 3) {
      mbStatus = 'warning';
      reasons.push('พบทั้ง WHEA Error และอาการไฟตัด (Kernel-Power 41) ควรตรวจเช็กภาคจ่ายไฟเมนบอร์ด/PSU และการตั้งค่า BIOS');
    } else {
      reasons.push('เมนบอร์ดและเฟิร์มแวร์ BIOS ทำงานได้ตามปกติ');
    }

    components.push({
      id: 'mainboard',
      category: 'mainboard',
      name: 'Mainboard / BIOS',
      modelName: `${mb.boardManufacturer || ''} ${mb.boardProduct || ''}`.trim() || 'Mainboard มาตรฐาน',
      status: mbStatus,
      progressValue: mbStatus === 'warning' ? 70 : 95,
      progressLabel: `BIOS ${mb.biosVersion || 'ปกติ'}`,
      metrics: [
        { label: 'ผู้ผลิต / รุ่น', value: `${mb.boardManufacturer || '-'} ${mb.boardProduct || ''}`.trim() },
        { label: 'เวอร์ชัน BIOS', value: mb.biosVersion || 'ไม่ระบุ' },
        { label: 'วันที่อัปเดต BIOS', value: mb.biosDate || 'ไม่ระบุ' },
      ],
      ruleReasons: reasons,
      recommendation:
        mbStatus === 'warning'
          ? 'แนะนำให้รีเซ็ตการตั้งค่า BIOS เป็น Default และอัปเดต BIOS/Chipset Driver ให้เสถียร'
          : 'ดูแลตามปกติ ไม่จำเป็นต้องแฟลช BIOS ใหม่หากเครื่องทำงานเสถียรดี',
      actionType: mbStatus === 'warning' ? 'อัปเดต' : 'ดูแลตามปกติ',
      urgency: mbStatus === 'warning' ? 'ควรทำภายใน 1-2 สัปดาห์' : 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: '0 บาท',
    });
  }

  // =========================================================
  // 7. ประเมินระบบระบายความร้อน (Cooling & Thermal)
  // =========================================================
  const cooling = report.cooling;
  const maxCpuOrZoneTemp = cooling?.maxTempC ?? cpu?.temperatureC ?? null;
  const maxDiskTemp =
    report.disks && report.disks.length > 0
      ? Math.max(...report.disks.map((d) => d.temperatureC ?? 0))
      : 0;

  if (maxCpuOrZoneTemp === null && (!cooling || cooling.fanSpeedRPM === null) && maxDiskTemp === 0) {
    components.push({
      id: 'cooling',
      category: 'cooling',
      name: 'ระบบระบายความร้อนและพัดลม',
      modelName: 'เซนเซอร์อุณหภูมิและพัดลม',
      status: 'unknown',
      progressValue: null,
      progressLabel: 'ไม่พบค่าเซนเซอร์ความร้อน',
      metrics: [
        { label: 'อุณหภูมิสูงสุด', value: 'ตรวจสอบไม่ได้' },
        { label: 'สถานะพัดลม', value: 'ไม่ระบุ' },
        { label: 'อุณหภูมิดิสก์', value: 'ไม่ระบุ' },
      ],
      ruleReasons: [
        cooling?.errorReason || 'ไม่สามารถอ่านค่าเซนเซอร์ความร้อนผ่าน WMI ได้ (แนะนำให้วางข้อมูลจาก HWiNFO เพิ่มเติม)',
      ],
      recommendation:
        'หากรู้สึกว่าเครื่องร้อนหรือพัดลมดัง สามารถคัดลอกข้อความจากโปรแกรม HWiNFO มาวางให้แอปช่วยวิเคราะห์ได้',
      actionType: 'ดูแลตามปกติ',
      urgency: 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: '-',
    });
  } else {
    let coolStatus: ComponentStatus = 'normal';
    const reasons: string[] = [];

    if (maxCpuOrZoneTemp !== null) {
      if (maxCpuOrZoneTemp > 95) {
        coolStatus = worseStatus(coolStatus, 'critical');
        reasons.push(`ความร้อนสะสมสูงวิกฤต (${maxCpuOrZoneTemp}°C) ระบบระบายความร้อนเอาไม่อยู่`);
      } else if (maxCpuOrZoneTemp > 85) {
        coolStatus = worseStatus(coolStatus, 'warning');
        reasons.push(`ความร้อนสะสมค่อนข้างสูง (${maxCpuOrZoneTemp}°C) ฝุ่นอาจตันซิงค์พัดลมหรือซิลิโคนแห้ง`);
      }
    }

    if (maxDiskTemp > 75) {
      coolStatus = worseStatus(coolStatus, 'warning');
      reasons.push(`อุณหภูมิดิสก์ภายในเครื่องสูง (${maxDiskTemp}°C) การไหลเวียนอากาศในเคส/ตัวเครื่องไม่ดี`);
    }

    if (reasons.length === 0) {
      reasons.push('การระบายความร้อนอยู่ในเกณฑ์ดี อุณหภูมิไม่เกินเกณฑ์เฝ้าระวัง');
    }

    components.push({
      id: 'cooling',
      category: 'cooling',
      name: 'ระบบระบายความร้อนและพัดลม',
      modelName: cooling?.fanStatus ? `พัดลมสถานะ: ${cooling.fanStatus}` : 'ชุดระบายความร้อนมาตรฐาน',
      status: coolStatus,
      progressValue:
        maxCpuOrZoneTemp !== null
          ? Math.max(10, Math.min(100, Math.round(100 - Math.max(0, maxCpuOrZoneTemp - 40) * 1.4)))
          : 85,
      progressLabel: maxCpuOrZoneTemp !== null ? `อุณหภูมิสูงสุด ${maxCpuOrZoneTemp}°C` : `อุณหภูมิดิสก์ ${maxDiskTemp}°C`,
      metrics: [
        {
          label: 'อุณหภูมิโซนหลัก',
          value: maxCpuOrZoneTemp !== null ? `${maxCpuOrZoneTemp} °C` : 'ไม่ระบุ',
          isAlert: maxCpuOrZoneTemp !== null && maxCpuOrZoneTemp > 85,
        },
        {
          label: 'อุณหภูมิดิสก์สูงสุด',
          value: maxDiskTemp > 0 ? `${maxDiskTemp} °C` : 'ไม่ระบุ',
          isAlert: maxDiskTemp > 70,
        },
        {
          label: 'รอบพัดลม / สถานะ',
          value: cooling?.fanSpeedRPM ? `${cooling.fanSpeedRPM} RPM` : cooling?.fanStatus || 'ทำงานอัตโนมัติ',
        },
      ],
      ruleReasons: reasons,
      recommendation:
        coolStatus === 'critical'
          ? 'เป่าฝุ่นทำความสะอาดพัดลมและฮีตซิงค์ พร้อมเปลี่ยนซิลิโคนระบายความร้อนทันที อย่าวางโน้ตบุ๊กบนที่นอนหรือผ้าที่บังช่องลม'
          : coolStatus === 'warning'
          ? 'ควรทำความสะอาดฝุ่นช่องระบายอากาศและยกท้ายโน้ตบุ๊กให้สูงขึ้นเล็กน้อยเพื่อช่วยระบายลมร้อน'
          : 'ดูแลตามปกติ ทำความสะอาดฝุ่นทุก 6–12 เดือน',
      actionType: coolStatus === 'normal' ? 'ดูแลตามปกติ' : 'ทำความสะอาด',
      urgency:
        coolStatus === 'critical'
          ? 'ด่วนที่สุด (ทันที)'
          : coolStatus === 'warning'
          ? 'ควรทำภายใน 1-2 สัปดาห์'
          : 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: coolStatus === 'normal' ? '0 บาท' : '300 - 700 บาท (ค่าล้างฝุ่นและทาซิลิโคนใหม่)',
    });
  }

  // =========================================================
  // 8. ประเมินระบบปฏิบัติการ (Windows OS & Event Stability)
  // กฎ: Kernel-Power 41 / BugCheck ≥3 ครั้งใน 30 วัน 🟡, ≥10 ครั้ง 🔴; uptime >30 วัน และ startup >20 โปรแกรม 🟡
  // =========================================================
  const sys = report.system;
  if (!sys || (!sys.osName && sys.uptimeDays === null)) {
    components.push({
      id: 'os',
      category: 'os',
      name: 'ระบบปฏิบัติการ (Windows OS)',
      modelName: 'ไม่พบข้อมูลระบบปฏิบัติการ',
      status: 'unknown',
      progressValue: null,
      progressLabel: 'ข้อมูลไม่เพียงพอ',
      metrics: [
        { label: 'เปิดเครื่องต่อเนื่อง (Uptime)', value: 'ไม่ระบุ' },
        { label: 'โปรแกรมเปิดพร้อมเครื่อง', value: 'ไม่ระบุ' },
        { label: 'จอฟ้า / ดับเอง (30 วัน)', value: 'ไม่ระบุ' },
      ],
      ruleReasons: [sys?.errorReason || 'ไม่พบข้อมูลระบบปฏิบัติการและ Event Log'],
      recommendation: 'ตรวจสอบไม่ได้ แนะนำให้อัปโหลดไฟล์ pc-report.json จากสคริปต์',
      actionType: 'ดูแลตามปกติ',
      urgency: 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: '-',
    });
  } else {
    let osStatus: ComponentStatus = 'normal';
    const reasons: string[] = [];

    const kp41 = eventLogs.kernelPower41Count ?? 0;
    const bsod = eventLogs.bugCheck1001Count ?? 0;
    const maxCrash = Math.max(kp41, bsod);

    if (maxCrash >= 10) {
      osStatus = worseStatus(osStatus, 'critical');
      reasons.push(
        `พบประวัติเครื่องดับผิดปกติ (Kernel-Power 41: ${kp41} ครั้ง) หรือจอฟ้า (BugCheck: ${bsod} ครั้ง) สูงถึง ${maxCrash} ครั้งใน 30 วัน`
      );
    } else if (maxCrash >= 3) {
      osStatus = worseStatus(osStatus, 'warning');
      reasons.push(
        `พบประวัติเครื่องดับเอง (Kernel-Power 41: ${kp41} ครั้ง) หรือจอฟ้า (BugCheck: ${bsod} ครั้ง) รวมระดับเฝ้าระวังใน 30 วัน`
      );
    }

    if (sys.uptimeDays !== null && sys.startupProgramsCount !== null) {
      if (sys.uptimeDays > 30 && sys.startupProgramsCount > 20) {
        osStatus = worseStatus(osStatus, 'warning');
        reasons.push(
          `ไม่ได้รีสตาร์ทเครื่องจริงนาน ${sys.uptimeDays} วัน (เกิน 30 วัน) และมีโปรแกรม Startup สูงถึง ${sys.startupProgramsCount} รายการ (เกิน 20 รายการ)`
        );
      } else if (sys.uptimeDays > 30) {
        osStatus = worseStatus(osStatus, 'warning');
        reasons.push(`เปิดเครื่องสะสมต่อเนื่อง ${sys.uptimeDays} วัน (ควรสั่ง Restart เพื่อล้างหน่วยความจำค้าง)`);
      } else if (sys.startupProgramsCount > 20) {
        osStatus = worseStatus(osStatus, 'warning');
        reasons.push(`มีโปรแกรมเปิดอัตโนมัติตอนเปิดเครื่อง (Startup) ถึง ${sys.startupProgramsCount} โปรแกรม ทำให้บูตช้าและกินแรม`);
      }
    }

    if (eventLogs.ntfsErrorsCount > 0) {
      osStatus = worseStatus(osStatus, 'warning');
      reasons.push(`พบข้อผิดพลาดระบบไฟล์ NTFS (${eventLogs.ntfsErrorsCount} ครั้ง) ควรรันคำสั่ง chkdsk และ sfc /scannow`);
    }

    if (reasons.length === 0) {
      reasons.push('ระบบ Windows เสถียรดี ไม่พบประวัติจอฟ้าหรือเครื่องดับผิดปกติซ้ำซ้อน');
    }

    components.push({
      id: 'os',
      category: 'os',
      name: 'ระบบปฏิบัติการ (Windows OS)',
      modelName: `${sys.osName || 'Windows'} ${sys.osVersion ? `(${sys.osVersion})` : ''}`.trim(),
      status: osStatus,
      progressValue: osStatus === 'critical' ? 30 : osStatus === 'warning' ? 65 : 95,
      progressLabel: `ดับเอง ${kp41} ครั้ง · จอฟ้า ${bsod} ครั้ง (30 วัน)`,
      metrics: [
        {
          label: 'Uptime / โปรแกรม Startup',
          value: `${sys.uptimeDays ?? '-'} วัน / ${sys.startupProgramsCount ?? '-'} โปรแกรม`,
          isAlert: (sys.uptimeDays ?? 0) > 30 || (sys.startupProgramsCount ?? 0) > 20,
        },
        {
          label: 'Kernel-Power 41 / BSOD',
          value: `ดับเอง ${kp41} ครั้ง / จอฟ้า ${bsod} ครั้ง`,
          isAlert: maxCrash >= 3,
        },
        {
          label: 'แอปค้าง (App Crash) / Update',
          value: `${eventLogs.appCrashHangCount} ครั้ง / ${sys.windowsUpdateStatus || 'ปกติ'}`,
          isAlert: eventLogs.appCrashHangCount > 15,
        },
      ],
      ruleReasons: reasons,
      recommendation:
        osStatus === 'critical'
          ? 'ตรวจสอบไฟล์ระบบด้วยคำสั่ง "sfc /scannow" ใน Command Prompt (Admin) และตรวจสอบต้นเหตุจอฟ้า/ไฟตกจาก RAM, ความร้อน หรือ PSU'
          : osStatus === 'warning'
          ? 'กด Restart เครื่อง (ไม่ใช่ Shutdown เพราะติด Fast Startup) และเข้าไปที่ Task Manager > Startup Apps เพื่อปิดโปรแกรมที่ไม่จำเป็น'
          : 'ดูแลตามปกติ หมั่นกด Restart สัปดาห์ละ 1 ครั้ง',
      actionType: 'อัปเดต',
      urgency:
        osStatus === 'critical'
          ? 'ด่วนที่สุด (ทันที)'
          : osStatus === 'warning'
          ? 'ควรทำภายใน 1-2 สัปดาห์'
          : 'ไม่ต้องดำเนินการ',
      estimatedCostTHB: '0 บาท (ตั้งค่าและซ่อมไฟล์ระบบเบื้องต้นได้เอง)',
    });
  }

  // =========================================================
  // วิเคราะห์เชื่อมโยง "สาเหตุที่น่าจะเป็นไปได้" (Probable Causes)
  // =========================================================
  const kp41Count = eventLogs.kernelPower41Count ?? 0;
  const bsodCount = eventLogs.bugCheck1001Count ?? 0;
  const wheaCount = eventLogs.wheaErrorsCount ?? 0;
  const diskErrCount = eventLogs.diskErrorsCount ?? 0;
  const cpuTemp = cpu?.temperatureC ?? cooling?.maxTempC ?? null;

  if (kp41Count >= 2 || selectedSymptoms.includes('shutdown')) {
    if (cpuTemp !== null && cpuTemp > 85) {
      probableCauses.push({
        symptom: 'เครื่องดับเอง / รีสตาร์ทเองโดยไม่แจ้งเตือน',
        cause: `พบ Kernel-Power 41 (${kp41Count} ครั้ง) ร่วมกับอุณหภูมิ CPU สูง (${cpuTemp}°C) → น่าจะเกิดจากระบบระบายความร้อนสะสมความร้อนจนเครื่องตัดไฟอัตโนมัติ หรือพาวเวอร์ซัพพลาย (PSU) จ่ายไฟไม่นิ่ง`,
        confidence: 'สูง',
        relatedComponents: ['CPU (หน่วยประมวลผลกลาง)', 'ระบบระบายความร้อนและพัดลม'],
      });
    } else {
      probableCauses.push({
        symptom: 'เครื่องดับเองกะทันหัน (Kernel-Power 41)',
        cause: `พบประวัติ Kernel-Power 41 จำนวน ${kp41Count} ครั้งใน 30 วัน → มักเกิดจากกระแสไฟสะดุด พาวเวอร์ซัพพลาย (PSU) เสื่อมสภาพ สายไฟหลวม หรือแบตเตอรี่โน้ตบุ๊กจ่ายไฟไม่ทันตอนโหลดหนัก`,
        confidence: kp41Count >= 5 ? 'สูง' : 'ปานกลาง',
        relatedComponents: ['ระบบปฏิบัติการ (Windows OS)', 'Mainboard / BIOS', 'แบตเตอรี่ (สำหรับโน้ตบุ๊ก)'],
      });
    }
  }

  if (bsodCount > 0 || wheaCount > 0 || selectedSymptoms.includes('bsod')) {
    const hasRamError =
      typeof ram?.memoryDiagnosticResult === 'string' && ram.memoryDiagnosticResult.toLowerCase().includes('fail');
    probableCauses.push({
      symptom: 'หน้าจอฟ้า (Blue Screen / BugCheck) หรือเครื่องรีสตาร์ทขณะใช้งาน',
      cause: hasRamError
        ? `พบผลตรวจ Memory Diagnostic Fail ร่วมกับ WHEA Error (${wheaCount} ครั้ง) และจอฟ้า (${bsodCount} ครั้ง) → สาเหตุหลักมาจากแถว RAM มีปัญหาหรือสกปรก`
        : `พบ BugCheck จอฟ้า ${bsodCount} ครั้ง และ WHEA Hardware Error ${wheaCount} ครั้ง → น่าจะเกิดจากแรมไม่เสถียร ไดรเวอร์อุปกรณ์ชนกัน หรือ SSD ระบบเริ่มมีปัญหา`,
      confidence: hasRamError || wheaCount >= 3 ? 'สูง' : 'ปานกลาง',
      relatedComponents: ['RAM (หน่วยความจำหลัก)', 'ระบบปฏิบัติการ (Windows OS)', 'CPU (หน่วยประมวลผลกลาง)'],
    });
  }

  if (hasDiskRisk || diskErrCount > 0 || selectedSymptoms.includes('freeze') || selectedSymptoms.includes('slow')) {
    const riskyDisks = components.filter((c) => c.category === 'disk' && (c.status === 'critical' || c.status === 'warning'));
    if (riskyDisks.length > 0) {
      probableCauses.push({
        symptom: 'เครื่องช้า ค้างเป็นพัก ๆ หรือเปิดไฟล์/โปรแกรมไม่ขึ้น',
        cause: `พบความผิดปกติที่ ${riskyDisks.map((d) => d.name).join(', ')} (${diskRiskReasons[0] || 'ค่าความเสื่อมหรือพื้นที่ว่างต่ำ'}) → ทำให้ Windows ต้องรออ่านข้อมูลซ้ำจนหน้าจอค้าง`,
        confidence: 'สูง',
        relatedComponents: riskyDisks.map((d) => d.name),
      });
    } else if (ram?.usagePercent && ram.usagePercent > 85) {
      probableCauses.push({
        symptom: 'เครื่องอืด สลับหน้าต่างช้า หรือค้างเมื่อเปิดหลายแอป',
        cause: `การใช้งาน RAM สูงถึง ${ram.usagePercent}% → เมื่อแรมเต็ม Windows จะดึงพื้นที่ดิสก์มาใช้แทนแรมชั่วคราว (Pagefile) ซึ่งช้ากว่าแรมหลายเท่า`,
        confidence: 'สูง',
        relatedComponents: ['RAM (หน่วยความจำหลัก)', 'ระบบปฏิบัติการ (Windows OS)'],
      });
    }
  }

  if (selectedSymptoms.includes('slow_boot') || ((sys?.startupProgramsCount ?? 0) > 20)) {
    probableCauses.push({
      symptom: 'เปิดเครื่องนานกว่าจะพร้อมใช้งาน',
      cause: `มีโปรแกรมตั้งค่าเปิดอัตโนมัติพร้อม Windows (Startup Apps) ถึง ${sys?.startupProgramsCount ?? 'หลาย'} รายการ และเปิดเครื่องต่อเนื่องมา ${sys?.uptimeDays ?? '-'} วัน`,
      confidence: 'สูง',
      relatedComponents: ['ระบบปฏิบัติการ (Windows OS)', 'ดิสก์ลูกที่ 1 (SSD)'],
    });
  }

  if (selectedSymptoms.includes('stutter') || (eventLogs.gpuDriverCrashCount ?? 0) > 0) {
    probableCauses.push({
      symptom: 'ภาพกระตุก จอดำชั่วขณะ หรือเฟรมเรตตกเวลาใช้งานกราฟิก',
      cause:
        (eventLogs.gpuDriverCrashCount ?? 0) > 0
          ? `พบประวัติไดรเวอร์การ์ดจอหลุด (Event 4101) ${eventLogs.gpuDriverCrashCount} ครั้ง ร่วมกับไดรเวอร์หรือความร้อนสะสม`
          : 'อาจเกิดจากไดรเวอร์การ์ดจอเก่า ความร้อนสะสมทำให้ลดความเร็ว (Thermal Throttling) หรือแรมระบบไม่เพียงพอ',
      confidence: (eventLogs.gpuDriverCrashCount ?? 0) > 0 ? 'สูง' : 'ปานกลาง',
      relatedComponents: ['GPU (การ์ดจอแสดงผล)', 'ระบบระบายความร้อนและพัดลม'],
    });
  }

  if (selectedSymptoms.includes('battery_drain') && bat?.hasBattery) {
    probableCauses.push({
      symptom: 'แบตเตอรี่หมดเร็วกว่าปกติ',
      cause: `ความจุแบตเตอรี่ปัจจุบันเหลือ ${bat.healthPercent ?? '?'}% ของความจุโรงงาน ร่วมกับอาจมีโปรแกรมทำงานเบื้องหลังกินไฟ`,
      confidence: (bat.healthPercent ?? 100) < 80 ? 'สูง' : 'ปานกลาง',
      relatedComponents: ['แบตเตอรี่ (สำหรับโน้ตบุ๊ก)', 'ระบบปฏิบัติการ (Windows OS)'],
    });
  }

  if (probableCauses.length === 0) {
    probableCauses.push({
      symptom: 'ภาพรวมการทำงานทั่วไป',
      cause: 'ไม่พบความเชื่อมโยงของอาการผิดปกติร้ายแรงใน Event Log และเซนเซอร์ฮาร์ดแวร์ เครื่องอยู่ในสภาพพร้อมใช้งาน',
      confidence: 'สูง',
      relatedComponents: ['ระบบปฏิบัติการ (Windows OS)'],
    });
  }

  // คำนวณคะแนนสุขภาพรวม (0–100)
  let score = 100;
  const criticalItems = components.filter((c) => c.status === 'critical');
  const warningItems = components.filter((c) => c.status === 'warning');
  const knownItems = components.filter((c) => c.status !== 'unknown');

  score -= criticalItems.length * 24;
  score -= warningItems.length * 10;
  if (hasDiskRisk) score -= 5;
  if (knownItems.length === 0) score = 50;
  score = Math.max(12, Math.min(100, score));

  // สร้างประโยคสรุป 1 ประโยคที่ชัดเจน
  let summary = 'เครื่องสุขภาพดีเยี่ยม อะไหล่ทุกชิ้นทำงานอยู่ในเกณฑ์ปกติ';
  if (knownItems.length === 0) {
    summary = 'ยังไม่มีข้อมูลฮาร์ดแวร์เพียงพอ กรุณาดาวน์โหลดสคริปต์ตรวจเครื่องหรือเลือกข้อมูลตัวอย่าง';
  } else if (criticalItems.length > 0) {
    const names = criticalItems.map((c) => c.name.split(' ')[0]).join(' และ ');
    summary = `พบจุดที่ควรแก้ไขด่วนที่ ${names} แนะนำให้ตรวจสอบและสำรองข้อมูลสำคัญทันที`;
  } else if (warningItems.length > 0) {
    const names = warningItems.map((c) => c.name.split(' ')[0]).join(', ');
    summary = `เครื่องยังใช้งานได้ดี แต่ควรเฝ้าระวังและดูแล ${names} เพื่อให้เครื่องลื่นไหลต่อเนื่อง`;
  }

  const preventiveTips = [
    'หมั่นสำรองไฟล์สำคัญไว้บน Cloud หรือ External Drive อย่างน้อยเดือนละ 1 ครั้ง',
    'กดสั่ง Restart เครื่องจริง ๆ (ไม่ใช่ Shutdown) อย่างน้อยสัปดาห์ละ 1 ครั้ง เพื่อล้างหน่วยความจำค้าง',
    'ทำความสะอาดฝุ่นบริเวณช่องระบายอากาศและพัดลมทุก 6 เดือน เพื่อลดความร้อนสะสม',
    'เหลือพื้นที่ว่างในไดรฟ์ C: อย่างน้อย 15–20% เสมอ เพื่อให้ SSD และ Windows ทำงานได้เต็มความเร็ว',
  ];

  return {
    overallScore: score,
    summary,
    hasDiskRisk,
    diskRiskReasons,
    components,
    probableCauses,
    preventiveTips,
  };
}

// รวมผลลัพธ์จาก Gemini AI เข้ากับการ์ดอะไหล่เดิมอย่างปลอดภัย (โดยยังคงกฎห้ามเดา unknown เป็น normal)
export function mergeAIWithRuleEvaluation(
  ruleResult: RuleEvaluationResult,
  aiResult: AIAnalysisResult
): RuleEvaluationResult {
  const updatedComponents = ruleResult.components.map((comp) => {
    const matchedAI = (aiResult.components || []).find(
      (ac) =>
        ac.name.toLowerCase() === comp.name.toLowerCase() ||
        comp.name.toLowerCase().includes(ac.name.toLowerCase()) ||
        ac.name.toLowerCase().includes(comp.name.split(' ')[0].toLowerCase())
    );

    if (!matchedAI) return comp;

    // กฎเหล็ก: ถ้าข้อมูลต้นทางเป็น unknown ห้าม AI เปลี่ยนเป็น normal
    const safeStatus: ComponentStatus =
      comp.status === 'unknown'
        ? 'unknown'
        : ['normal', 'warning', 'critical', 'unknown'].includes(matchedAI.status)
        ? (matchedAI.status as ComponentStatus)
        : comp.status;

    return {
      ...comp,
      status: safeStatus,
      ruleReasons: matchedAI.reason ? [matchedAI.reason, ...comp.ruleReasons.slice(0, 1)] : comp.ruleReasons,
      recommendation: matchedAI.recommendation || comp.recommendation,
      urgency: matchedAI.urgency || comp.urgency,
      estimatedCostTHB: matchedAI.estimatedCostTHB || comp.estimatedCostTHB,
    };
  });

  return {
    ...ruleResult,
    overallScore:
      typeof aiResult.overallScore === 'number'
        ? Math.max(5, Math.min(100, aiResult.overallScore))
        : ruleResult.overallScore,
    summary: aiResult.summary || ruleResult.summary,
    components: updatedComponents,
    probableCauses:
      Array.isArray(aiResult.probableCauses) && aiResult.probableCauses.length > 0
        ? aiResult.probableCauses
        : ruleResult.probableCauses,
    preventiveTips:
      Array.isArray(aiResult.preventiveTips) && aiResult.preventiveTips.length > 0
        ? aiResult.preventiveTips
        : ruleResult.preventiveTips,
  };
}

// ลบข้อมูลที่ระบุตัวตน (ชื่อเครื่อง, ชื่อผู้ใช้, Serial Number) ก่อนส่งให้ Gemini
export function sanitizeReportForAI(report: PCReport, stripPersonalIdentifiers: boolean): PCReport {
  const cloned: PCReport = JSON.parse(JSON.stringify(report));
  if (!stripPersonalIdentifiers) return cloned;

  cloned.machineId = 'REDACTED-PC';
  if (cloned.system) {
    cloned.system.computerName = 'REDACTED-PC';
    cloned.system.userName = 'REDACTED-USER';
  }
  if (cloned.mainboard) {
    cloned.mainboard.serialNumber = 'REDACTED-SN';
  }
  if (Array.isArray(cloned.disks)) {
    cloned.disks = cloned.disks.map((d) => ({
      ...d,
      serialNumber: 'REDACTED-DISK-SN',
    }));
  }
  return cloned;
}

// สร้างข้อความสรุปสำหรับคัดลอกส่งให้ช่างซ่อมคอมพิวเตอร์
export function formatTechnicianSummaryText(
  report: PCReport,
  evaluation: RuleEvaluationResult,
  selectedSymptoms: SymptomKey[]
): string {
  const symptomLabels = SYMPTOM_OPTIONS.filter((s) => selectedSymptoms.includes(s.key)).map((s) => s.label);
  const statusIcon: Record<ComponentStatus, string> = {
    normal: '🟢 ปกติ',
    warning: '🟡 เฝ้าระวัง',
    critical: '🔴 ควรแก้ไขด่วน',
    unknown: '⚪ ไม่มีข้อมูล',
  };

  const lines: string[] = [
    '==========================================',
    '📋 รายงานตรวจสุขภาพคอมพิวเตอร์ (PC Health Doctor)',
    '==========================================',
    `วันที่ตรวจ: ${new Date(report.generatedAt).toLocaleString('th-TH')}`,
    `คะแนนสุขภาพรวม: ${evaluation.overallScore}/100`,
    `สรุปผล: ${evaluation.summary}`,
    `อาการที่พบ: ${symptomLabels.length > 0 ? symptomLabels.join(', ') : 'ไม่ได้ระบุ (ตรวจเช็กทั่วไป)'}`,
    '',
    '--- สถานะอะไหล่แต่ละชิ้น ---',
  ];

  evaluation.components.forEach((c) => {
    lines.push(`• ${c.name} (${c.modelName}): ${statusIcon[c.status]}`);
    lines.push(`  - รายละเอียด: ${c.ruleReasons[0] || '-'}`);
    if (c.status === 'critical' || c.status === 'warning') {
      lines.push(`  - คำแนะนำ: ${c.recommendation} (งบประมาณ: ${c.estimatedCostTHB})`);
    }
  });

  lines.push('', '--- สาเหตุที่น่าจะเป็นไปได้ ---');
  evaluation.probableCauses.forEach((pc, idx) => {
    lines.push(`${idx + 1}. [${pc.symptom}] -> ${pc.cause} (ความมั่นใจ: ${pc.confidence})`);
  });

  if (report.eventLogs) {
    lines.push(
      '',
      '--- สถิติ Event Log ย้อนหลัง 30 วัน ---',
      `• Kernel-Power 41 (ดับเอง): ${report.eventLogs.kernelPower41Count} ครั้ง`,
      `• BugCheck 1001 (จอฟ้า): ${report.eventLogs.bugCheck1001Count} ครั้ง`,
      `• WHEA Hardware Error: ${report.eventLogs.wheaErrorsCount} ครั้ง`,
      `• Disk Error (7/11/51/153): ${report.eventLogs.diskErrorsCount} ครั้ง`,
      `• Display Driver Crash (4101): ${report.eventLogs.gpuDriverCrashCount ?? 0} ครั้ง`
    );
  }

  lines.push('==========================================');
  return lines.join('\n');
}
