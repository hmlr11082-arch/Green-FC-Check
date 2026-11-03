import React, { useState, useEffect } from 'react';
import {
  Gauge,
  Cpu,
  MonitorPlay,
  RefreshCw,
  ArrowUpRight,
} from 'lucide-react';
import { BrowserProbeResult, PCReport } from '../types/pcHealth';

interface BrowserProbeProps {
  onApplyToDashboard: (report: PCReport) => void;
}

// คอมโพเนนต์ตรวจเช็กข้อมูลเครื่องเบื้องต้นจาก Browser API ทันทีโดยไม่ต้องอัปโหลดไฟล์
// พร้อมระบบทดสอบความเร็ว CPU ใน Web Worker และทดสอบเฟรมเรต (FPS) ของหน้าจอ
export const BrowserProbe: React.FC<BrowserProbeProps> = ({ onApplyToDashboard }) => {
  const [probe, setProbe] = useState<BrowserProbeResult>({
    scannedAt: new Date().toISOString(),
    cores: null,
    deviceMemoryGB: null,
    deviceMemorySupported: false,
    gpuVendor: null,
    gpuRenderer: null,
    storageQuotaGB: null,
    storageUsageGB: null,
    storageSupported: false,
    batterySupported: false,
    batteryLevelPercent: null,
    batteryCharging: null,
    cpuBenchmarkScore: null,
    cpuBenchmarkDurationMs: null,
    cpuBenchmarkOpsPerSec: null,
    fpsAverage: null,
    fpsMin: null,
    fpsSmoothnessRating: null,
  });

  const [isRunningCpuBench, setIsRunningCpuBench] = useState(false);
  const [isRunningFpsTest, setIsRunningFpsTest] = useState(false);

  const collectBrowserSpecs = async () => {
    // 1. จำนวนคอร์ CPU (hardwareConcurrency)
    const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null;

    // 2. ขนาด RAM โดยประมาณ (deviceMemory)
    const navAny = navigator as any;
    const deviceMemoryGB = typeof navAny.deviceMemory === 'number' ? navAny.deviceMemory : null;
    const deviceMemorySupported = deviceMemoryGB !== null;

    // 3. ข้อมูลการ์ดจอผ่าน WebGL Renderer
    let gpuVendor: string | null = null;
    let gpuRenderer: string | null = null;
    try {
      const canvas = document.createElement('canvas');
      const gl =
        (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || null;
          gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || null;
        } else {
          gpuRenderer = gl.getParameter(gl.RENDERER) || null;
        }
      }
    } catch {
      gpuRenderer = null;
    }

    // 4. พื้นที่จัดเก็บที่เบราว์เซอร์มองเห็น (storage.estimate)
    let storageQuotaGB: number | null = null;
    let storageUsageGB: number | null = null;
    let storageSupported = false;
    try {
      if (navigator.storage && typeof navigator.storage.estimate === 'function') {
        const est = await navigator.storage.estimate();
        if (typeof est.quota === 'number') {
          storageQuotaGB = Math.round((est.quota / (1024 ** 3)) * 10) / 10;
          storageUsageGB = typeof est.usage === 'number' ? Math.round((est.usage / (1024 ** 3)) * 100) / 100 : 0;
          storageSupported = true;
        }
      }
    } catch {
      storageSupported = false;
    }

    // 5. สถานะแบตเตอรี่ผ่าน Battery Status API
    let batterySupported = false;
    let batteryLevelPercent: number | null = null;
    let batteryCharging: boolean | null = null;
    try {
      if (typeof navAny.getBattery === 'function') {
        const bat = await navAny.getBattery();
        if (bat) {
          batterySupported = true;
          batteryLevelPercent = typeof bat.level === 'number' ? Math.round(bat.level * 100) : null;
          batteryCharging = typeof bat.charging === 'boolean' ? bat.charging : null;
        }
      }
    } catch {
      batterySupported = false;
    }

    setProbe((prev) => ({
      ...prev,
      scannedAt: new Date().toISOString(),
      cores,
      deviceMemoryGB,
      deviceMemorySupported,
      gpuVendor,
      gpuRenderer,
      storageQuotaGB,
      storageUsageGB,
      storageSupported,
      batterySupported,
      batteryLevelPercent,
      batteryCharging,
    }));
  };

  useEffect(() => {
    collectBrowserSpecs();
  }, []);

  // รัน Benchmark ทดสอบความเร็ว CPU สั้น ๆ ใน Web Worker (ไม่ทำให้หน้าเว็บค้าง)
  const runCpuBenchmarkInWorker = () => {
    if (isRunningCpuBench) return;
    setIsRunningCpuBench(true);

    const workerCode = `
      self.onmessage = function() {
        const start = performance.now();
        const durationTarget = 1200; // 1.2 วินาที
        let operations = 0;
        let acc = 1.000001;
        while ((performance.now() - start) < durationTarget) {
          for (let i = 1; i <= 50000; i++) {
            acc = Math.sqrt(acc * i + 1.2345) + Math.sin(i);
          }
          operations += 50000;
        }
        const elapsed = performance.now() - start;
        const opsPerSec = Math.round((operations / elapsed) * 1000);
        const score = Math.min(100, Math.max(20, Math.round(opsPerSec / 450000)));
        self.postMessage({ score, elapsed: Math.round(elapsed), opsPerSec, acc });
      };
    `;

    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      worker.onmessage = (e) => {
        const { score, elapsed, opsPerSec } = e.data;
        setProbe((prev) => ({
          ...prev,
          cpuBenchmarkScore: score,
          cpuBenchmarkDurationMs: elapsed,
          cpuBenchmarkOpsPerSec: opsPerSec,
        }));
        setIsRunningCpuBench(false);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      };

      worker.onerror = () => {
        setIsRunningCpuBench(false);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      };

      worker.postMessage('start');
    } catch {
      setIsRunningCpuBench(false);
    }
  };

  // ทดสอบความลื่นไหลของจอและเฟรมเรต (FPS Test) เป็นเวลา 1.5 วินาที
  const runDisplayFpsTest = () => {
    if (isRunningFpsTest) return;
    setIsRunningFpsTest(true);

    const frameDeltas: number[] = [];
    let lastTime = performance.now();
    const startTime = lastTime;

    const step = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      if (delta > 0 && delta < 500) {
        frameDeltas.push(delta);
      }

      if (now - startTime < 1500) {
        requestAnimationFrame(step);
      } else {
        if (frameDeltas.length > 5) {
          const avgDelta = frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length;
          const maxDelta = Math.max(...frameDeltas);
          const avgFps = Math.round(1000 / avgDelta);
          const minFps = Math.max(1, Math.round(1000 / maxDelta));

          let rating = 'ลื่นไหลดีมาก (ไม่พบอาการเฟรมกระตุก)';
          if (avgFps < 35 || minFps < 20) {
            rating = 'พบอาการเฟรมเรตตก/กระตุก (ควรเช็กไดรเวอร์จอหรือโปรแกรมเบื้องหลัง)';
          } else if (avgFps >= 100) {
            rating = 'จอความถี่สูง ลื่นไหลระดับดีเยี่ยม';
          }

          setProbe((prev) => ({
            ...prev,
            fpsAverage: avgFps,
            fpsMin: minFps,
            fpsSmoothnessRating: rating,
          }));
        }
        setIsRunningFpsTest(false);
      }
    };

    requestAnimationFrame(step);
  };

  // ส่งข้อมูลที่อ่านได้จาก Browser API ขึ้นไปแสดงบน Dashboard หลัก
  const handleSendToDashboard = () => {
    const browserReport: PCReport = {
      reportVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: 'browser_only',
      machineId: 'BROWSER-LIVE-CHECK',
      cpu: {
        model: `CPU (${probe.cores ?? '?'} Logical Cores จาก Browser API)`,
        cores: probe.cores,
        logicalProcessors: probe.cores,
        maxClockMHz: null,
        loadPercent: null,
        temperatureC: null,
        errorReason: 'เบราว์เซอร์ถูกจำกัดสิทธิ์การอ่านอุณหภูมิ CPU เพื่อความปลอดภัย (ต้องใช้สคริปต์ PowerShell)',
      },
      ram: {
        totalGB: probe.deviceMemoryGB,
        usedGB: null,
        usagePercent: null,
        speedMHz: null,
        slotsUsed: null,
        slotsTotal: null,
        memoryDiagnosticResult: 'None',
        errorReason: probe.deviceMemorySupported
          ? null
          : 'เบราว์เซอร์นี้ไม่รองรับ navigator.deviceMemory (แสดงเฉพาะเมื่อใช้ Chrome/Edge)',
      },
      disks: [],
      logicalDrives: probe.storageSupported
        ? [
            {
              driveLetter: 'Browser Storage Quota',
              label: 'พื้นที่โควตาเบราว์เซอร์',
              totalGB: probe.storageQuotaGB,
              freeGB:
                probe.storageQuotaGB !== null && probe.storageUsageGB !== null
                  ? Math.round((probe.storageQuotaGB - probe.storageUsageGB) * 10) / 10
                  : null,
              freePercent: 85,
              isSystemDrive: true,
            },
          ]
        : [],
      gpu: {
        name: probe.gpuRenderer || 'ไม่พบข้อมูล WebGL Renderer',
        driverVersion: null,
        driverDate: null,
        vramGB: null,
        status: 'OK',
        temperatureC: null,
      },
      battery: {
        hasBattery: probe.batterySupported,
        name: 'แบตเตอรี่ (ผ่าน Browser API)',
        designCapacitymWh: null,
        fullChargedCapacitymWh: null,
        healthPercent: null,
        cycleCount: null,
        chargePercent: probe.batteryLevelPercent,
        isCharging: probe.batteryCharging,
        errorReason: probe.batterySupported
          ? 'Browser API อ่านได้เฉพาะระดับแบตเตอรี่ปัจจุบัน (%) แต่ไม่สามารถอ่านค่าความเสื่อมโรงงาน (DesignCapacity) ได้'
          : 'เบราว์เซอร์ไม่รองรับ Battery Status API หรือเป็นเครื่องตั้งโต๊ะ',
      },
      mainboard: {
        boardManufacturer: null,
        boardProduct: null,
        biosVersion: null,
        biosDate: null,
        errorReason: 'เบราว์เซอร์ไม่สามารถอ่านข้อมูล Mainboard/BIOS ได้โดยตรง',
      },
      cooling: {
        fanSpeedRPM: null,
        fanStatus: null,
        thermalZonesC: [],
        maxTempC: null,
        errorReason: 'เบราว์เซอร์ไม่สามารถอ่านเซนเซอร์พัดลมและความร้อนได้',
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
        errorReason: 'ต้องรันสคริปต์ PowerShell เพื่ออ่าน Windows Event Log',
      },
      system: {
        osName: navigator.userAgent.includes('Win') ? 'Windows (ตรวจผ่านเบราว์เซอร์)' : navigator.platform,
        osVersion: null,
        uptimeDays: null,
        startupProgramsCount: null,
        windowsUpdateStatus: 'Unknown',
      },
    };

    onApplyToDashboard(browserReport);
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 no-print">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>ตรวจเช็กด่วนผ่านเบราว์เซอร์ (Browser API & Quick Benchmark)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            ทำงานทันทีบนเครื่องนี้โดยไม่ต้องรันสคริปต์ (อ่านข้อมูลเท่าที่เบราว์เซอร์อนุญาต พร้อมทดสอบความเร็ว CPU และความลื่นของจอ)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={collectBrowserSpecs}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            รีเฟรชค่าเบราว์เซอร์
          </button>
          <button
            type="button"
            onClick={handleSendToDashboard}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white cursor-pointer"
          >
            นำค่านี้ไปแสดงบนหน้าปัดหลัก
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ตารางค่าพื้นฐานที่อ่านได้จาก Browser API */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">จำนวนคอร์ประมวลผล (Logical Cores)</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {probe.cores !== null ? `${probe.cores} เธรด (Threads)` : 'เบราว์เซอร์ไม่เปิดเผยข้อมูลนี้'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">ผ่าน navigator.hardwareConcurrency</div>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">หน่วยความจำ (RAM โดยประมาณ)</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {probe.deviceMemorySupported ? `≈ ${probe.deviceMemoryGB} GB` : 'เบราว์เซอร์ไม่รองรับการอ่านค่า'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {probe.deviceMemorySupported
              ? 'ผ่าน navigator.deviceMemory (ค่าประมาณ)'
              : 'บางเบราว์เซอร์ซ่อนค่านี้เพื่อความเป็นส่วนตัว'}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">ชิปกราฟิก (WebGL Renderer)</div>
          <div
            className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate"
            title={probe.gpuRenderer || ''}
          >
            {probe.gpuRenderer || 'ไม่พบข้อมูลการ์ดจอผ่าน WebGL'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            โควตาจัดเก็บ: {probe.storageSupported ? `${probe.storageQuotaGB} GB` : 'ไม่รองรับ storage.estimate'}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">สถานะแบตเตอรี่ (Battery API)</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {probe.batterySupported && probe.batteryLevelPercent !== null
              ? `${probe.batteryLevelPercent}% (${probe.batteryCharging ? 'กำลังชาร์จ' : 'ใช้ไฟแบต'})`
              : 'ไม่รองรับ / เครื่องตั้งโต๊ะ'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {probe.batterySupported
              ? 'อ่านระดับไฟปัจจุบันจากเบราว์เซอร์สำเร็จ'
              : 'หากต้องการดูเปอร์เซ็นต์แบตเสื่อม ให้ใช้สคริปต์ PowerShell'}
          </div>
        </div>
      </div>

      {/* ส่วนทดสอบความเร็ว CPU (Web Worker) และความลื่นไหลของจอ (FPS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>ทดสอบความเร็ว CPU (Web Worker Benchmark)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {probe.cpuBenchmarkOpsPerSec !== null
                ? `ความเร็วคำนวณ: ${(probe.cpuBenchmarkOpsPerSec / 1_000_000).toFixed(1)} ล้านคำสั่ง/วินาที (${probe.cpuBenchmarkDurationMs} ms)`
                : 'ทดสอบการคำนวณทางคณิตศาสตร์เบื้องหลัง 1.2 วินาที โดยไม่ทำให้หน้าจอค้าง'}
            </p>
          </div>
          <button
            type="button"
            onClick={runCpuBenchmarkInWorker}
            disabled={isRunningCpuBench}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            {isRunningCpuBench
              ? 'กำลังทดสอบ...'
              : probe.cpuBenchmarkScore !== null
              ? 'ทดสอบ CPU อีกครั้ง'
              : 'เริ่มเทสความเร็ว CPU'}
          </button>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MonitorPlay className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>ทดสอบเฟรมเรตและความลื่นของจอ (FPS Test)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {probe.fpsAverage !== null
                ? `ค่าเฉลี่ย ${probe.fpsAverage} FPS (ต่ำสุด ${probe.fpsMin} FPS) · ${probe.fpsSmoothnessRating}`
                : 'วัดความเสถียรของอัตราการวาดภาพหน้าจอ (Refresh Rate & Frame Drop) 1.5 วินาที'}
            </p>
          </div>
          <button
            type="button"
            onClick={runDisplayFpsTest}
            disabled={isRunningFpsTest}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            {isRunningFpsTest
              ? 'กำลังวัดเฟรมเรต...'
              : probe.fpsAverage !== null
              ? 'ทดสอบจออีกครั้ง'
              : 'เริ่มทดสอบความลื่นจอ'}
          </button>
        </div>
      </div>
    </section>
  );
};
