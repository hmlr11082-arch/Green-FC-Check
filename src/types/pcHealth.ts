// ชนิดข้อมูลหลักสำหรับแอป PC Health Doctor

export type ComponentStatus = 'normal' | 'warning' | 'critical' | 'unknown';

export type SymptomKey =
  | 'slow'
  | 'freeze'
  | 'bsod'
  | 'shutdown'
  | 'overheat'
  | 'slow_boot'
  | 'battery_drain'
  | 'stutter';

export interface SymptomOption {
  key: SymptomKey;
  label: string;
  description: string;
}

export interface CPUInfo {
  model: string | null;
  cores: number | null;
  logicalProcessors: number | null;
  maxClockMHz: number | null;
  loadPercent: number | null;
  temperatureC: number | null;
  errorReason?: string | null;
}

export interface RAMModuleInfo {
  manufacturer?: string | null;
  capacityGB: number | null;
  speedMHz: number | null;
  partNumber?: string | null;
}

export interface RAMInfo {
  totalGB: number | null;
  usedGB: number | null;
  usagePercent: number | null;
  speedMHz: number | null;
  slotsUsed: number | null;
  slotsTotal: number | null;
  memoryDiagnosticResult: 'Pass' | 'Fail' | 'None' | string | null;
  modules?: RAMModuleInfo[];
  errorReason?: string | null;
}

export interface PhysicalDiskInfo {
  id: string;
  friendlyName: string;
  mediaType: 'SSD' | 'HDD' | 'NVMe' | 'Unspecified' | string;
  healthStatus: 'Healthy' | 'Warning' | 'Unhealthy' | 'Unknown' | string;
  sizeGB: number | null;
  wearPercent: number | null; // 0-100 (เปอร์เซ็นต์การสึกหรอของ SSD)
  temperatureC: number | null;
  readErrorsTotal: number | null;
  writeErrorsTotal: number | null;
  reallocatedSectors: number | null;
  powerOnHours: number | null;
  serialNumber?: string | null;
  errorReason?: string | null;
}

export interface LogicalDriveInfo {
  driveLetter: string;
  label?: string | null;
  totalGB: number | null;
  freeGB: number | null;
  freePercent: number | null;
  isSystemDrive?: boolean;
}

export interface GPUInfo {
  name: string | null;
  driverVersion: string | null;
  driverDate: string | null; // ISO or YYYY-MM-DD
  vramGB: number | null;
  status: string | null;
  temperatureC: number | null;
  tdrCrashCount30Days?: number | null; // Event 4101
  errorReason?: string | null;
}

export interface BatteryInfo {
  hasBattery: boolean;
  name?: string | null;
  designCapacitymWh: number | null;
  fullChargedCapacitymWh: number | null;
  healthPercent: number | null;
  cycleCount: number | null;
  chargePercent?: number | null;
  isCharging?: boolean | null;
  errorReason?: string | null;
}

export interface MainboardBiosInfo {
  boardManufacturer: string | null;
  boardProduct: string | null;
  biosVersion: string | null;
  biosDate: string | null;
  serialNumber?: string | null;
  errorReason?: string | null;
}

export interface CoolingSensorInfo {
  fanSpeedRPM: number | null;
  fanStatus: string | null;
  thermalZonesC: number[];
  maxTempC: number | null;
  errorReason?: string | null;
}

export interface EventLogCategorySummary {
  category: string;
  eventIds: number[];
  count30Days: number;
  samples: {
    timeCreated: string;
    id: number;
    message: string;
  }[];
}

export interface EventLogReport {
  diskErrorsCount: number; // ID 7, 11, 51, 153
  wheaErrorsCount: number; // ID 17, 18, 19, 20
  kernelPower41Count: number; // ID 41
  bugCheck1001Count: number; // ID 1001
  appCrashHangCount: number; // ID 1000, 1002
  ntfsErrorsCount: number; // ID 55, 98
  gpuDriverCrashCount: number; // ID 4101
  categories: EventLogCategorySummary[];
  errorReason?: string | null;
}

export interface SystemOSInfo {
  osName: string | null;
  osVersion: string | null;
  computerName?: string | null;
  userName?: string | null;
  uptimeDays: number | null;
  startupProgramsCount: number | null;
  startupProgramsList?: string[];
  windowsUpdateStatus: 'UpToDate' | 'Pending' | 'Outdated' | 'Unknown' | string | null;
  lastUpdateDate?: string | null;
  errorReason?: string | null;
}

export interface PCReport {
  reportVersion: string;
  generatedAt: string;
  source: 'powershell' | 'raw_paste' | 'demo' | 'browser_only';
  machineId?: string;
  cpu: CPUInfo;
  ram: RAMInfo;
  disks: PhysicalDiskInfo[];
  logicalDrives: LogicalDriveInfo[];
  gpu: GPUInfo;
  battery: BatteryInfo;
  mainboard: MainboardBiosInfo;
  cooling: CoolingSensorInfo;
  eventLogs: EventLogReport;
  system: SystemOSInfo;
}

export interface ComponentMetricItem {
  label: string;
  value: string;
  isAlert?: boolean;
}

export interface EvaluatedComponent {
  id: string;
  category: 'cpu' | 'ram' | 'disk' | 'gpu' | 'battery' | 'mainboard' | 'cooling' | 'os';
  name: string;
  modelName: string;
  status: ComponentStatus;
  progressValue: number | null; // 0-100 สำหรับแสดงแถบความเสี่ยงหรือสุขภาพ
  progressLabel: string;
  metrics: ComponentMetricItem[];
  ruleReasons: string[];
  recommendation: string;
  actionType: 'ซ่อม' | 'เปลี่ยน' | 'ทำความสะอาด' | 'อัปเดต' | 'สำรองข้อมูลก่อน' | 'ดูแลตามปกติ' | string;
  urgency: 'ด่วนที่สุด (ทันที)' | 'ควรทำภายใน 1-2 สัปดาห์' | 'เฝ้าระวัง' | 'ไม่ต้องดำเนินการ' | string;
  estimatedCostTHB: string;
  rawDetails?: Record<string, unknown>;
}

export interface ProbableCause {
  symptom: string;
  cause: string;
  confidence: 'สูง' | 'ปานกลาง' | 'ต่ำ' | string;
  relatedComponents: string[];
  evidence?: string;
}

export interface RuleEvaluationResult {
  overallScore: number;
  summary: string;
  hasDiskRisk: boolean;
  diskRiskReasons: string[];
  components: EvaluatedComponent[];
  probableCauses: ProbableCause[];
  preventiveTips: string[];
}

export interface AIComponentOutput {
  name: string;
  status: ComponentStatus;
  reason: string;
  recommendation: string;
  urgency: string;
  estimatedCostTHB: string;
}

export interface AIAnalysisResult {
  overallScore: number;
  summary: string;
  components: AIComponentOutput[];
  probableCauses: {
    symptom: string;
    cause: string;
    confidence: string;
    relatedComponents: string[];
  }[];
  preventiveTips: string[];
}

export interface ScanHistoryItem {
  id: string;
  timestamp: string;
  machineLabel: string;
  source: string;
  overallScore: number;
  summary: string;
  maxSsdWearPercent: number | null;
  batteryHealthPercent: number | null;
  cpuTempC: number | null;
  ramUsagePercent: number | null;
  diskRisk: boolean;
  reportSnapshot: PCReport;
}

export interface BrowserProbeResult {
  scannedAt: string;
  cores: number | null;
  deviceMemoryGB: number | null;
  deviceMemorySupported: boolean;
  gpuVendor: string | null;
  gpuRenderer: string | null;
  storageQuotaGB: number | null;
  storageUsageGB: number | null;
  storageSupported: boolean;
  batterySupported: boolean;
  batteryLevelPercent: number | null;
  batteryCharging: boolean | null;
  cpuBenchmarkScore: number | null;
  cpuBenchmarkDurationMs: number | null;
  cpuBenchmarkOpsPerSec: number | null;
  fpsAverage: number | null;
  fpsMin: number | null;
  fpsSmoothnessRating: string | null;
}

export interface MaintenanceItem {
  id: string;
  title: string;
  description: string;
  intervalText: string;
  category: 'ทำความสะอาด' | 'ซอฟต์แวร์' | 'ฮาร์ดแวร์' | 'ข้อมูล';
  checked: boolean;
  lastDoneDate: string | null;
}
