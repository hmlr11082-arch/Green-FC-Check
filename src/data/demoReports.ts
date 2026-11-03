import { PCReport, SymptomKey } from '../types/pcHealth';

export interface DemoPreset {
  id: string;
  title: string;
  badge: string;
  description: string;
  defaultSymptoms: SymptomKey[];
  report: PCReport;
}

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: 'ssd-degrading',
    title: 'กรณีที่ 1: SSD เริ่มเสื่อมหนัก + เครื่องร้อน',
    badge: 'พบความเสี่ยงดิสก์ 🔴',
    description: 'SSD ไดรฟ์หลักมีค่า Wear 84% เริ่มมี Read Error และอุณหภูมิ CPU สูง 88°C ทำให้เครื่องค้างเป็นพัก ๆ',
    defaultSymptoms: ['freeze', 'slow', 'overheat'],
    report: {
      reportVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: 'demo',
      machineId: 'WORKSTATION-01',
      cpu: {
        model: 'Intel Core i7-11700K @ 3.60GHz',
        cores: 8,
        logicalProcessors: 16,
        maxClockMHz: 3600,
        loadPercent: 42,
        temperatureC: 88,
      },
      ram: {
        totalGB: 16,
        usedGB: 11.4,
        usagePercent: 71.2,
        speedMHz: 3200,
        slotsUsed: 2,
        slotsTotal: 4,
        memoryDiagnosticResult: 'Pass',
      },
      disks: [
        {
          id: '0',
          friendlyName: 'KINGSTON SA2000M8500G (NVMe SSD)',
          mediaType: 'SSD',
          healthStatus: 'Warning',
          sizeGB: 465.8,
          wearPercent: 84,
          temperatureC: 73,
          readErrorsTotal: 14,
          writeErrorsTotal: 2,
          reallocatedSectors: 0,
          powerOnHours: 19420,
          serialNumber: '50026B76840291AA',
        },
        {
          id: '1',
          friendlyName: 'WD Blue WD10EZEX 1TB (SATA HDD)',
          mediaType: 'HDD',
          healthStatus: 'Healthy',
          sizeGB: 931.5,
          wearPercent: null,
          temperatureC: 41,
          readErrorsTotal: 0,
          writeErrorsTotal: 0,
          reallocatedSectors: 0,
          powerOnHours: 24100,
          serialNumber: 'WCC6Y4PL9012',
        },
      ],
      logicalDrives: [
        {
          driveLetter: 'C:',
          label: 'Windows_SSD',
          totalGB: 465.8,
          freeGB: 38.2,
          freePercent: 8.2,
          isSystemDrive: true,
        },
        {
          driveLetter: 'D:',
          label: 'Data_HDD',
          totalGB: 931.5,
          freeGB: 412.0,
          freePercent: 44.2,
          isSystemDrive: false,
        },
      ],
      gpu: {
        name: 'NVIDIA GeForce RTX 3060',
        driverVersion: '31.0.15.3623',
        driverDate: '2024-06-14',
        vramGB: 12,
        status: 'OK',
        temperatureC: 72,
        tdrCrashCount30Days: 0,
      },
      battery: {
        hasBattery: false,
        designCapacitymWh: null,
        fullChargedCapacitymWh: null,
        healthPercent: null,
        cycleCount: null,
        errorReason: 'เครื่องตั้งโต๊ะ (Desktop PC)',
      },
      mainboard: {
        boardManufacturer: 'ASUSTeK COMPUTER INC.',
        boardProduct: 'TUF GAMING B560-PLUS WIFI',
        biosVersion: '2001',
        biosDate: '2023-03-10',
        serialNumber: 'MB-992817263',
      },
      cooling: {
        fanSpeedRPM: 2150,
        fanStatus: 'OK',
        thermalZonesC: [88, 79],
        maxTempC: 88,
      },
      eventLogs: {
        diskErrorsCount: 9,
        wheaErrorsCount: 0,
        kernelPower41Count: 1,
        bugCheck1001Count: 0,
        appCrashHangCount: 8,
        ntfsErrorsCount: 2,
        gpuDriverCrashCount: 0,
        categories: [
          {
            category: 'Disk Errors (7, 11, 51, 153)',
            eventIds: [7, 11, 51, 153],
            count30Days: 9,
            samples: [
              {
                timeCreated: '2026-10-30 14:22',
                id: 153,
                message: 'The IO operation at logical block address 0x1a4f820 for Disk 0 (PDO name: \\Device\\0000003a) was retried.',
              },
              {
                timeCreated: '2026-10-28 21:05',
                id: 51,
                message: 'An error was detected on device \\Device\\Harddisk0\\DR0 during a paging operation.',
              },
            ],
          },
          {
            category: 'NTFS File System Errors (55, 98)',
            eventIds: [55, 98],
            count30Days: 2,
            samples: [
              {
                timeCreated: '2026-10-29 09:12',
                id: 98,
                message: 'Volume C: (\\Device\\HarddiskVolume3) needs to be taken offline for a short time to perform a Spot Fix.',
              },
            ],
          },
        ],
      },
      system: {
        osName: 'Microsoft Windows 11 Home Single Language',
        osVersion: '10.0.22631',
        computerName: 'WORKSTATION-01',
        userName: 'Somchai_PC',
        uptimeDays: 14.5,
        startupProgramsCount: 15,
        windowsUpdateStatus: 'UpToDate',
        lastUpdateDate: '2026-10-18',
      },
    },
  },
  {
    id: 'battery-worn',
    title: 'กรณีที่ 2: โน้ตบุ๊กแบตเตอรี่เสื่อม + บูตเครื่องช้า',
    badge: 'แบตเตอรี่เสื่อม 🔴',
    description: 'ความจุแบตเตอรี่โน้ตบุ๊กเหลือเพียง 52% ถอดสายชาร์จแล้วหมดไว เปิดค้าง 38 วัน และมีโปรแกรม Startup 26 ตัว',
    defaultSymptoms: ['battery_drain', 'slow_boot', 'slow'],
    report: {
      reportVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: 'demo',
      machineId: 'NOTEBOOK-OFFICE',
      cpu: {
        model: 'AMD Ryzen 5 5600U with Radeon Graphics',
        cores: 6,
        logicalProcessors: 12,
        maxClockMHz: 2300,
        loadPercent: 28,
        temperatureC: 64,
      },
      ram: {
        totalGB: 8,
        usedGB: 7.1,
        usagePercent: 88.8,
        speedMHz: 3200,
        slotsUsed: 1,
        slotsTotal: 2,
        memoryDiagnosticResult: 'None',
      },
      disks: [
        {
          id: '0',
          friendlyName: 'WDC PC SN530 SDBPNPZ-512G',
          mediaType: 'SSD',
          healthStatus: 'Healthy',
          sizeGB: 476.9,
          wearPercent: 18,
          temperatureC: 46,
          readErrorsTotal: 0,
          writeErrorsTotal: 0,
          reallocatedSectors: 0,
          powerOnHours: 8920,
          serialNumber: '21145X802911',
        },
      ],
      logicalDrives: [
        {
          driveLetter: 'C:',
          label: 'OS',
          totalGB: 476.9,
          freeGB: 142.5,
          freePercent: 29.9,
          isSystemDrive: true,
        },
      ],
      gpu: {
        name: 'AMD Radeon(TM) Graphics',
        driverVersion: '31.0.12027.9001',
        driverDate: '2025-03-20',
        vramGB: 2,
        status: 'OK',
        temperatureC: 59,
        tdrCrashCount30Days: 0,
      },
      battery: {
        hasBattery: true,
        name: 'L20M3PF0 Li-Polymer',
        designCapacitymWh: 45000,
        fullChargedCapacitymWh: 23400,
        healthPercent: 52.0,
        cycleCount: 685,
        chargePercent: 34,
      },
      mainboard: {
        boardManufacturer: 'LENOVO',
        boardProduct: '82LN (IdeaPad Slim 5)',
        biosVersion: 'H2CN26WW',
        biosDate: '2024-05-12',
        serialNumber: 'PF38K91L',
      },
      cooling: {
        fanSpeedRPM: null,
        fanStatus: 'OK',
        thermalZonesC: [64],
        maxTempC: 64,
      },
      eventLogs: {
        diskErrorsCount: 0,
        wheaErrorsCount: 0,
        kernelPower41Count: 4,
        bugCheck1001Count: 0,
        appCrashHangCount: 5,
        ntfsErrorsCount: 0,
        gpuDriverCrashCount: 0,
        categories: [
          {
            category: 'Kernel-Power 41 (เครื่องดับ/รีสตาร์ทผิดปกติ)',
            eventIds: [41],
            count30Days: 4,
            samples: [
              {
                timeCreated: '2026-10-27 16:40',
                id: 41,
                message: 'The system has rebooted without cleanly shutting down first. This error could be caused if the system stopped responding, crashed, or lost power unexpectedly.',
              },
            ],
          },
        ],
      },
      system: {
        osName: 'Microsoft Windows 11 Home',
        osVersion: '10.0.22631',
        computerName: 'NOTEBOOK-OFFICE',
        userName: 'Nattapong',
        uptimeDays: 38.2,
        startupProgramsCount: 26,
        windowsUpdateStatus: 'UpToDate',
        lastUpdateDate: '2026-10-15',
      },
    },
  },
  {
    id: 'ram-whea-bsod',
    title: 'กรณีที่ 3: RAM Error + จอฟ้าและเครื่องดับบ่อย',
    badge: 'จอฟ้า / RAM มีปัญหา 🔴',
    description: 'พบผลตรวจ Windows Memory Diagnostic Fail, WHEA-Logger 9 ครั้ง และจอฟ้า BugCheck 1001 พร้อมเครื่องดับเอง 11 ครั้ง',
    defaultSymptoms: ['bsod', 'shutdown', 'freeze'],
    report: {
      reportVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: 'demo',
      machineId: 'GAMING-RIG-X',
      cpu: {
        model: 'AMD Ryzen 7 5800X 8-Core Processor',
        cores: 8,
        logicalProcessors: 16,
        maxClockMHz: 3800,
        loadPercent: 93,
        temperatureC: 96,
      },
      ram: {
        totalGB: 32,
        usedGB: 30.8,
        usagePercent: 96.2,
        speedMHz: 3600,
        slotsUsed: 4,
        slotsTotal: 4,
        memoryDiagnosticResult: 'Fail: The Windows Memory Diagnostic tested the computer memory and detected hardware errors',
      },
      disks: [
        {
          id: '0',
          friendlyName: 'Samsung SSD 980 PRO 1TB',
          mediaType: 'SSD',
          healthStatus: 'Healthy',
          sizeGB: 931.5,
          wearPercent: 12,
          temperatureC: 54,
          readErrorsTotal: 0,
          writeErrorsTotal: 0,
          reallocatedSectors: 0,
          powerOnHours: 6200,
          serialNumber: 'S5GXNF0R918234',
        },
      ],
      logicalDrives: [
        {
          driveLetter: 'C:',
          label: 'NVMe_Main',
          totalGB: 931.5,
          freeGB: 280.0,
          freePercent: 30.1,
          isSystemDrive: true,
        },
      ],
      gpu: {
        name: 'NVIDIA GeForce RTX 3080',
        driverVersion: '32.0.15.6094',
        driverDate: '2026-08-20',
        vramGB: 10,
        status: 'OK',
        temperatureC: 87,
        tdrCrashCount30Days: 6,
      },
      battery: {
        hasBattery: false,
        designCapacitymWh: null,
        fullChargedCapacitymWh: null,
        healthPercent: null,
        cycleCount: null,
        errorReason: 'เครื่องตั้งโต๊ะ (Desktop PC)',
      },
      mainboard: {
        boardManufacturer: 'Micro-Star International Co., Ltd.',
        boardProduct: 'MAG B550 TOMAHAWK (MS-7C91)',
        biosVersion: 'A.G0',
        biosDate: '2024-03-11',
      },
      cooling: {
        fanSpeedRPM: 2850,
        fanStatus: 'Warning',
        thermalZonesC: [96, 87],
        maxTempC: 96,
      },
      eventLogs: {
        diskErrorsCount: 0,
        wheaErrorsCount: 9,
        kernelPower41Count: 11,
        bugCheck1001Count: 8,
        appCrashHangCount: 24,
        ntfsErrorsCount: 0,
        gpuDriverCrashCount: 6,
        categories: [
          {
            category: 'WHEA Hardware Errors (17, 18, 19, 20)',
            eventIds: [17, 18, 19, 20],
            count30Days: 9,
            samples: [
              {
                timeCreated: '2026-10-31 22:18',
                id: 18,
                message: 'A fatal hardware error has occurred. Reported by component: Processor Core. Error Source: Machine Check Exception.',
              },
              {
                timeCreated: '2026-10-30 20:11',
                id: 19,
                message: 'A corrected hardware error has occurred. Memory hierarchy error detected.',
              },
            ],
          },
          {
            category: 'BugCheck 1001 (จอฟ้า BSOD)',
            eventIds: [1001],
            count30Days: 8,
            samples: [
              {
                timeCreated: '2026-10-31 22:19',
                id: 1001,
                message: 'The computer has rebooted from a bugcheck. The bugcheck was: 0x0000001a (MEMORY_MANAGEMENT).',
              },
            ],
          },
          {
            category: 'Kernel-Power 41 (เครื่องดับ/รีสตาร์ทผิดปกติ)',
            eventIds: [41],
            count30Days: 11,
            samples: [
              {
                timeCreated: '2026-10-31 22:19',
                id: 41,
                message: 'The system has rebooted without cleanly shutting down first.',
              },
            ],
          },
        ],
      },
      system: {
        osName: 'Microsoft Windows 11 Pro',
        osVersion: '10.0.22631',
        computerName: 'GAMING-RIG-X',
        userName: 'GamerTH',
        uptimeDays: 2.1,
        startupProgramsCount: 12,
        windowsUpdateStatus: 'UpToDate',
        lastUpdateDate: '2026-10-25',
      },
    },
  },
  {
    id: 'healthy-pc',
    title: 'กรณีที่ 4: เครื่องสุขภาพดีเยี่ยม (ปกติทุกชิ้นส่วน)',
    badge: 'สุขภาพดี 🟢',
    description: 'ตัวอย่างเครื่องที่ได้รับการดูแลรักษาอย่างดี อุณหภูมิเย็น SSD สภาพ 96% และไม่มีประวัติ Error ร้ายแรง',
    defaultSymptoms: [],
    report: {
      reportVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: 'demo',
      machineId: 'CREATOR-PC-PRO',
      cpu: {
        model: 'Intel Core i5-13500',
        cores: 14,
        logicalProcessors: 20,
        maxClockMHz: 4800,
        loadPercent: 18,
        temperatureC: 48,
      },
      ram: {
        totalGB: 32,
        usedGB: 10.2,
        usagePercent: 31.9,
        speedMHz: 5600,
        slotsUsed: 2,
        slotsTotal: 4,
        memoryDiagnosticResult: 'Pass',
      },
      disks: [
        {
          id: '0',
          friendlyName: 'WD_BLACK SN850X 1000GB',
          mediaType: 'SSD',
          healthStatus: 'Healthy',
          sizeGB: 931.5,
          wearPercent: 4,
          temperatureC: 42,
          readErrorsTotal: 0,
          writeErrorsTotal: 0,
          reallocatedSectors: 0,
          powerOnHours: 2150,
          serialNumber: '23194A801920',
        },
      ],
      logicalDrives: [
        {
          driveLetter: 'C:',
          label: 'System_NVMe',
          totalGB: 931.5,
          freeGB: 540.2,
          freePercent: 58.0,
          isSystemDrive: true,
        },
      ],
      gpu: {
        name: 'NVIDIA GeForce RTX 4070 SUPER',
        driverVersion: '32.0.15.6590',
        driverDate: '2026-10-05',
        vramGB: 12,
        status: 'OK',
        temperatureC: 45,
        tdrCrashCount30Days: 0,
      },
      battery: {
        hasBattery: false,
        designCapacitymWh: null,
        fullChargedCapacitymWh: null,
        healthPercent: null,
        cycleCount: null,
        errorReason: 'เครื่องตั้งโต๊ะ (Desktop PC)',
      },
      mainboard: {
        boardManufacturer: 'Gigabyte Technology Co., Ltd.',
        boardProduct: 'B760M AORUS ELITE AX',
        biosVersion: 'F15',
        biosDate: '2026-04-18',
      },
      cooling: {
        fanSpeedRPM: 1120,
        fanStatus: 'OK',
        thermalZonesC: [48, 42],
        maxTempC: 48,
      },
      eventLogs: {
        diskErrorsCount: 0,
        wheaErrorsCount: 0,
        kernelPower41Count: 0,
        bugCheck1001Count: 0,
        appCrashHangCount: 1,
        ntfsErrorsCount: 0,
        gpuDriverCrashCount: 0,
        categories: [],
      },
      system: {
        osName: 'Microsoft Windows 11 Pro',
        osVersion: '10.0.22631',
        computerName: 'CREATOR-PC-PRO',
        userName: 'StudioUser',
        uptimeDays: 3.4,
        startupProgramsCount: 8,
        windowsUpdateStatus: 'UpToDate',
        lastUpdateDate: '2026-10-28',
      },
    },
  },
];

export const SAMPLE_CRYSTALDISK_TEXT = `----------------------------------------------------------------------------
CrystalDiskInfo 9.2.1 (C) 2008-2026 hiyohiyo
----------------------------------------------------------------------------
           Model : KINGSTON SA2000M8500G
        Firmware : S5Z42105
   Serial Number : 50026B76840291AA
       Disk Size : 500.1 GB
       Interface : NVM Express
   Transfer Mode : PCIe 3.0 x4 | PCIe 3.0 x4
  Drive Letter(s): C:
   Health Status : Caution (38 %)
     Temperature : 74 C (165 F)
   Power On Hours : 18450 hours
   Power On Count : 3120 count
       Host Reads : 48210 GB
      Host Writes : 69400 GB

-- HWiNFO64 Sensor Summary --
CPU: Intel Core i7-10750H @ 2.60GHz (6 Cores / 12 Threads)
CPU Package Temperature: 89 C (Max: 94 C)
Total CPU Usage: 34 %
Physical Memory: 16 GB DDR4-2933 (Used: 87 %)
GPU: NVIDIA GeForce GTX 1660 Ti (Driver: 2024-04-11, Temp: 78 C)
Battery: Designed Capacity 52500 mWh, Full Charged Capacity 34125 mWh, Cycle Count: 420`;
