// สคริปต์ PowerShell (pc-check.ps1) สำหรับตรวจสุขภาพคอมพิวเตอร์ Windows แบบอ่านอย่างเดียว (Read-Only)
// ออกแบบให้ทำงานได้ในตัวทันที (Self-contained) โดยไม่ต้องง้อไฟล์ภายนอก
// - ไม่มีเครื่องหมาย Double Quote (") แม้แต่ตัวเดียว (ป้องกัน TerminatorExpectedAtEndOfString 100%)
// - ปิดท้ายทุกบรรทัดและ Hashtable ด้วย ; เพื่อให้วางรันได้ทั้งแบบหลายบรรทัดและบรรทัดเดียว (One-Liner)
// - เมื่อสแกนเสร็จ จะทั้งบันทึกไฟล์ pc-report.json ลง Desktop, เปิดโฟลเดอร์ชี้ไฟล์ และคัดลอกผล JSON เข้า Clipboard อัตโนมัติ

export const POWERSHELL_SCRIPT_CONTENT = `$ErrorActionPreference = 'SilentlyContinue';
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;

Write-Host '============================================================' -ForegroundColor Cyan;
Write-Host '   PC Health Doctor - Windows Hardware Diagnostic Script' -ForegroundColor Cyan;
Write-Host '   (Read-Only Mode - No external file required)' -ForegroundColor Gray;
Write-Host '============================================================' -ForegroundColor Cyan;

$Report = [ordered]@{
    reportVersion = '1.0.0';
    generatedAt   = (Get-Date).ToString('o');
    source        = 'powershell';
    machineId     = [string]$env:COMPUTERNAME;
    cpu           = $null;
    ram           = $null;
    disks         = @();
    logicalDrives = @();
    gpu           = $null;
    battery       = $null;
    mainboard     = $null;
    cooling       = $null;
    eventLogs     = $null;
    system        = $null;
};

Write-Host '[1/9] Checking CPU and thermal sensors...' -ForegroundColor Yellow;
try {
    $cpuObj = Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop | Select-Object -First 1;
    $cpuTemp = $null;
    $tempError = $null;

    try {
        $thermal = Get-CimInstance -Namespace 'root/wmi' -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | Select-Object -First 1;
        if ($null -ne $thermal -and $thermal.CurrentTemperature -gt 0) {
            $cpuTemp = [math]::Round(($thermal.CurrentTemperature / 10.0) - 273.15, 1);
        }
    } catch {
        try {
            $perfTemp = Get-CimInstance -ClassName Win32_PerfFormattedData_Counters_ThermalZoneInformation -ErrorAction Stop | Select-Object -First 1;
            if ($null -ne $perfTemp -and $perfTemp.Temperature -gt 0) {
                $cpuTemp = [math]::Round($perfTemp.Temperature - 273.15, 1);
            }
        } catch {
            $tempError = 'Thermal zone sensor not exposed by BIOS or requires Administrator';
        }
    }

    $Report.cpu = [ordered]@{
        model             = if ($cpuObj.Name) { [string]$cpuObj.Name.Trim() } else { $null };
        cores             = $cpuObj.NumberOfCores;
        logicalProcessors = $cpuObj.NumberOfLogicalProcessors;
        maxClockMHz       = $cpuObj.MaxClockSpeed;
        loadPercent       = $cpuObj.LoadPercentage;
        temperatureC      = $cpuTemp;
        errorReason       = $tempError;
    };
} catch {
    $Report.cpu = [ordered]@{
        model             = $null;
        cores             = $null;
        logicalProcessors = $null;
        maxClockMHz       = $null;
        loadPercent       = $null;
        temperatureC      = $null;
        errorReason       = 'Unable to read CPU information via WMI';
    };
}

Write-Host '[2/9] Checking RAM capacity, speed, and Memory Diagnostic logs...' -ForegroundColor Yellow;
try {
    $osMem = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop;
    $physMem = @(Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue);
    $memArray = Get-CimInstance -ClassName Win32_PhysicalMemoryArray -ErrorAction SilentlyContinue | Select-Object -First 1;

    $totalGB = [math]::Round(($osMem.TotalVisibleMemorySize / 1MB), 1);
    $freeGB  = [math]::Round(($osMem.FreePhysicalMemory / 1MB), 1);
    $usedGB  = [math]::Round(($totalGB - $freeGB), 1);
    $usagePct = if ($totalGB -gt 0) { [math]::Round(($usedGB / $totalGB) * 100, 1) } else { $null };

    $speedMHz = if ($physMem.Count -gt 0) { $physMem[0].Speed } else { $null };
    $slotsUsed = $physMem.Count;
    $slotsTotal = if ($null -ne $memArray) { $memArray.MemoryDevices } else { $slotsUsed };

    $memDiagResult = 'None';
    try {
        $memEvent = Get-WinEvent -FilterHashtable @{
            LogName      = 'System';
            ProviderName = 'Microsoft-Windows-MemoryDiagnostics-Results';
        } -MaxEvents 1 -ErrorAction Stop;
        if ($null -ne $memEvent) {
            if ($memEvent.Message -match 'no errors' -or $memEvent.Id -eq 1101) {
                $memDiagResult = 'Pass';
            } else {
                $memDiagResult = 'Fail';
            }
        }
    } catch {
        $memDiagResult = 'None';
    }

    $Report.ram = [ordered]@{
        totalGB                = $totalGB;
        usedGB                 = $usedGB;
        usagePercent           = $usagePct;
        speedMHz               = $speedMHz;
        slotsUsed              = $slotsUsed;
        slotsTotal             = $slotsTotal;
        memoryDiagnosticResult = $memDiagResult;
        errorReason            = $null;
    };
} catch {
    $Report.ram = [ordered]@{
        totalGB                = $null;
        usedGB                 = $null;
        usagePercent           = $null;
        speedMHz               = $null;
        slotsUsed              = $null;
        slotsTotal             = $null;
        memoryDiagnosticResult = $null;
        errorReason            = 'Unable to read RAM information';
    };
}

Write-Host '[3/9] Checking SSD/HDD health and drive free space...' -ForegroundColor Yellow;
try {
    $physDisks = @(Get-PhysicalDisk -ErrorAction Stop);
    foreach ($d in $physDisks) {
        $wear = $null;
        $temp = $null;
        $readErr = $null;
        $writeErr = $null;
        $powerHours = $null;
        $relError = $null;

        try {
            $rel = $d | Get-StorageReliabilityCounter -ErrorAction Stop;
            if ($null -ne $rel) {
                $wear       = $rel.Wear;
                $temp       = $rel.Temperature;
                $readErr    = $rel.ReadErrorsTotal;
                $writeErr   = $rel.WriteErrorsTotal;
                $powerHours = $rel.PowerOnHours;
            }
        } catch {
            $relError = 'Run PowerShell as Administrator to read SMART reliability counters';
        }

        $Report.disks += [ordered]@{
            id                 = [string]$d.DeviceId;
            friendlyName       = [string]$d.FriendlyName;
            mediaType          = [string]$d.MediaType;
            healthStatus       = [string]$d.HealthStatus;
            sizeGB             = if ($d.Size -gt 0) { [math]::Round($d.Size / 1GB, 1) } else { $null };
            wearPercent        = $wear;
            temperatureC       = $temp;
            readErrorsTotal    = $readErr;
            writeErrorsTotal   = $writeErr;
            reallocatedSectors = $null;
            powerOnHours       = $powerHours;
            serialNumber       = [string]$d.SerialNumber;
            errorReason        = $relError;
        };
    }
} catch {
    $Report.disks += [ordered]@{
        id                 = '0';
        friendlyName       = 'Unknown Disk';
        mediaType          = 'Unspecified';
        healthStatus       = 'Unknown';
        sizeGB             = $null;
        wearPercent        = $null;
        temperatureC       = $null;
        readErrorsTotal    = $null;
        writeErrorsTotal   = $null;
        reallocatedSectors = $null;
        powerOnHours       = $null;
        errorReason        = 'Unable to read PhysicalDisk information';
    };
}

try {
    $drives = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction Stop);
    foreach ($drv in $drives) {
        $tot = if ($drv.Size -gt 0) { [math]::Round($drv.Size / 1GB, 1) } else { 0 };
        $free = if ($drv.FreeSpace -gt 0) { [math]::Round($drv.FreeSpace / 1GB, 1) } else { 0 };
        $freePct = if ($tot -gt 0) { [math]::Round(($free / $tot) * 100, 1) } else { 0 };
        $Report.logicalDrives += [ordered]@{
            driveLetter   = [string]$drv.DeviceID;
            label         = [string]$drv.VolumeName;
            totalGB       = $tot;
            freeGB        = $free;
            freePercent   = $freePct;
            isSystemDrive = ($drv.DeviceID -eq $env:SystemDrive);
        };
    }
} catch {}

Write-Host '[4/9] Checking GPU and graphics driver...' -ForegroundColor Yellow;
try {
    $gpus = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction Stop);
    $selectedGpu = $gpus | Where-Object { $_.Name -notmatch 'Basic|Remote|Virtual' } | Select-Object -First 1;
    if ($null -eq $selectedGpu -and $gpus.Count -gt 0) {
        $selectedGpu = $gpus[0];
    }

    $driverDateStr = $null;
    if ($null -ne $selectedGpu.DriverDate) {
        $driverDateStr = ([DateTime]$selectedGpu.DriverDate).ToString('yyyy-MM-dd');
    }

    $vramGB = $null;
    if ($null -ne $selectedGpu.AdapterRAM -and $selectedGpu.AdapterRAM -gt 0) {
        $vramGB = [math]::Round($selectedGpu.AdapterRAM / 1GB, 1);
    }

    $Report.gpu = [ordered]@{
        name                = [string]$selectedGpu.Name;
        driverVersion       = [string]$selectedGpu.DriverVersion;
        driverDate          = $driverDateStr;
        vramGB              = $vramGB;
        status              = [string]$selectedGpu.Status;
        temperatureC        = $null;
        tdrCrashCount30Days = 0;
        errorReason         = $null;
    };
} catch {
    $Report.gpu = [ordered]@{
        name          = $null;
        driverVersion = $null;
        driverDate    = $null;
        vramGB        = $null;
        status        = $null;
        temperatureC  = $null;
        errorReason   = 'Unable to read GPU information';
    };
}

Write-Host '[5/9] Checking battery health...' -ForegroundColor Yellow;
try {
    $winBat = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1;
    if ($null -eq $winBat) {
        $Report.battery = [ordered]@{
            hasBattery             = $false;
            name                   = $null;
            designCapacitymWh      = $null;
            fullChargedCapacitymWh = $null;
            healthPercent          = $null;
            cycleCount             = $null;
            chargePercent          = $null;
            errorReason            = 'No battery detected (Desktop PC)';
        };
    } else {
        $designCap = $null;
        $fullCap = $null;
        $cycles = $null;

        try {
            $staticData = Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryStaticData -ErrorAction Stop | Select-Object -First 1;
            $fullData   = Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryFullChargedCapacity -ErrorAction Stop | Select-Object -First 1;
            $cycleData  = Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryCycleCount -ErrorAction SilentlyContinue | Select-Object -First 1;
            if ($null -ne $staticData) { $designCap = $staticData.DesignedCapacity };
            if ($null -ne $fullData)   { $fullCap   = $fullData.FullChargedCapacity };
            if ($null -ne $cycleData)  { $cycles    = $cycleData.CycleCount };
        } catch {
            $designCap = $winBat.DesignCapacity;
            $fullCap   = $winBat.FullChargeCapacity;
        }

        $healthPct = $null;
        if ($null -ne $designCap -and $designCap -gt 0 -and $null -ne $fullCap -and $fullCap -gt 0) {
            $healthPct = [math]::Round(($fullCap / $designCap) * 100, 1);
            if ($healthPct -gt 100) { $healthPct = 100 };
        }

        $Report.battery = [ordered]@{
            hasBattery             = $true;
            name                   = [string]$winBat.Name;
            designCapacitymWh      = $designCap;
            fullChargedCapacitymWh = $fullCap;
            healthPercent          = $healthPct;
            cycleCount             = $cycles;
            chargePercent          = $winBat.EstimatedChargeRemaining;
            errorReason            = $null;
        };
    }
} catch {
    $Report.battery = [ordered]@{
        hasBattery             = $false;
        designCapacitymWh      = $null;
        fullChargedCapacitymWh = $null;
        healthPercent          = $null;
        cycleCount             = $null;
        errorReason            = 'Unable to read battery information';
    };
}

Write-Host '[6/9] Checking Mainboard and BIOS...' -ForegroundColor Yellow;
try {
    $board = Get-CimInstance -ClassName Win32_BaseBoard -ErrorAction Stop | Select-Object -First 1;
    $bios  = Get-CimInstance -ClassName Win32_BIOS -ErrorAction Stop | Select-Object -First 1;
    $biosDateStr = if ($null -ne $bios.ReleaseDate) { ([DateTime]$bios.ReleaseDate).ToString('yyyy-MM-dd') } else { $null };

    $Report.mainboard = [ordered]@{
        boardManufacturer = [string]$board.Manufacturer;
        boardProduct      = [string]$board.Product;
        biosVersion       = [string]$bios.SMBIOSBIOSVersion;
        biosDate          = $biosDateStr;
        serialNumber      = [string]$board.SerialNumber;
        errorReason       = $null;
    };
} catch {
    $Report.mainboard = [ordered]@{
        boardManufacturer = $null;
        boardProduct      = $null;
        biosVersion       = $null;
        biosDate          = $null;
        errorReason       = 'Unable to read Mainboard/BIOS information';
    };
}

Write-Host '[7/9] Checking cooling fans and thermal zones...' -ForegroundColor Yellow;
try {
    $fan = Get-CimInstance -ClassName Win32_Fan -ErrorAction SilentlyContinue | Select-Object -First 1;
    $zones = @();
    try {
        $tzList = @(Get-CimInstance -Namespace 'root/wmi' -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop);
        foreach ($z in $tzList) {
            if ($z.CurrentTemperature -gt 0) {
                $zones += [math]::Round(($z.CurrentTemperature / 10.0) - 273.15, 1);
            }
        }
    } catch {}

    $maxZoneTemp = if ($zones.Count -gt 0) { ($zones | Measure-Object -Maximum).Maximum } else { $Report.cpu.temperatureC };

    $Report.cooling = [ordered]@{
        fanSpeedRPM   = if ($null -ne $fan) { $fan.DesiredSpeed } else { $null };
        fanStatus     = if ($null -ne $fan) { [string]$fan.Status } else { $null };
        thermalZonesC = $zones;
        maxTempC      = $maxZoneTemp;
        errorReason   = if ($null -eq $maxZoneTemp -and $null -eq $fan) { 'WMI thermal/fan sensors not exposed by motherboard' } else { $null };
    };
} catch {
    $Report.cooling = [ordered]@{
        fanSpeedRPM   = $null;
        fanStatus     = $null;
        thermalZonesC = @();
        maxTempC      = $null;
        errorReason   = 'Unable to read cooling sensors';
    };
}

Write-Host '[8/9] Scanning Windows Event Logs for the last 30 days (please wait 5-15 seconds)...' -ForegroundColor Yellow;
try {
    $startTime = (Get-Date).AddDays(-30);

    function Get-EventCategorySummary {
        param(
            [string]$CategoryName,
            [string]$LogName,
            [int[]]$EventIds
        )
        try {
            $events = @(Get-WinEvent -FilterHashtable @{
                LogName   = $LogName;
                Id        = $EventIds;
                StartTime = $startTime;
            } -ErrorAction SilentlyContinue);

            $samples = @();
            foreach ($ev in ($events | Select-Object -First 5)) {
                $msg = if ($ev.Message) { ($ev.Message -replace '[\r\n]+', ' ').Trim() } else { 'Event ID ' + [string]$ev.Id };
                if ($msg.Length -gt 200) { $msg = $msg.Substring(0, 200) + '...' };
                $samples += [ordered]@{
                    timeCreated = $ev.TimeCreated.ToString('yyyy-MM-dd HH:mm');
                    id          = $ev.Id;
                    message     = $msg;
                };
            }
            return [ordered]@{
                category    = $CategoryName;
                eventIds    = $EventIds;
                count30Days = $events.Count;
                samples     = $samples;
            };
        } catch {
            return [ordered]@{
                category    = $CategoryName;
                eventIds    = $EventIds;
                count30Days = 0;
                samples     = @();
            };
        }
    }

    $catDisk   = Get-EventCategorySummary -CategoryName 'Disk Errors (7, 11, 51, 153)' -LogName 'System' -EventIds @(7, 11, 51, 153);
    $catWhea   = Get-EventCategorySummary -CategoryName 'WHEA Hardware Errors (17, 18, 19, 20)' -LogName 'System' -EventIds @(17, 18, 19, 20);
    $catKp41   = Get-EventCategorySummary -CategoryName 'Kernel-Power 41' -LogName 'System' -EventIds @(41);
    $catBsod   = Get-EventCategorySummary -CategoryName 'BugCheck 1001 (BSOD)' -LogName 'System' -EventIds @(1001);
    $catNtfs   = Get-EventCategorySummary -CategoryName 'NTFS Errors (55, 98)' -LogName 'System' -EventIds @(55, 98);
    $catGpuTdr = Get-EventCategorySummary -CategoryName 'Display Driver Crash (4101)' -LogName 'System' -EventIds @(4101);
    $catApp    = Get-EventCategorySummary -CategoryName 'Application Crash/Hang (1000, 1002)' -LogName 'Application' -EventIds @(1000, 1002);

    if ($null -ne $Report.gpu) {
        $Report.gpu.tdrCrashCount30Days = $catGpuTdr.count30Days;
    }

    $Report.eventLogs = [ordered]@{
        diskErrorsCount     = $catDisk.count30Days;
        wheaErrorsCount     = $catWhea.count30Days;
        kernelPower41Count  = $catKp41.count30Days;
        bugCheck1001Count   = $catBsod.count30Days;
        appCrashHangCount   = $catApp.count30Days;
        ntfsErrorsCount     = $catNtfs.count30Days;
        gpuDriverCrashCount = $catGpuTdr.count30Days;
        categories          = @($catDisk, $catWhea, $catKp41, $catBsod, $catNtfs, $catGpuTdr, $catApp);
        errorReason         = $null;
    };
} catch {
    $Report.eventLogs = [ordered]@{
        diskErrorsCount     = 0;
        wheaErrorsCount     = 0;
        kernelPower41Count  = 0;
        bugCheck1001Count   = 0;
        appCrashHangCount   = 0;
        ntfsErrorsCount     = 0;
        gpuDriverCrashCount = 0;
        categories          = @();
        errorReason         = 'Unable to read Windows Event Logs';
    };
}

Write-Host '[9/9] Checking Windows OS, Uptime, and Startup programs...' -ForegroundColor Yellow;
try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop;
    $uptimeSpan = (Get-Date) - $os.LastBootUpTime;
    $uptimeDays = [math]::Round($uptimeSpan.TotalDays, 1);

    $startupCmds = @(Get-CimInstance -ClassName Win32_StartupCommand -ErrorAction SilentlyContinue);
    $startupNames = @($startupCmds | ForEach-Object { [string]$_.Name } | Select-Object -First 25);

    $wuStatus = 'Unknown';
    $lastUpdateDate = $null;
    try {
        $hotfix = Get-HotFix -ErrorAction Stop | Sort-Object InstalledOn -Descending | Select-Object -First 1;
        if ($null -ne $hotfix -and $null -ne $hotfix.InstalledOn) {
            $lastUpdateDate = ([DateTime]$hotfix.InstalledOn).ToString('yyyy-MM-dd');
            $daysSinceUpdate = ((Get-Date) - ([DateTime]$hotfix.InstalledOn)).TotalDays;
            $wuStatus = if ($daysSinceUpdate -le 45) { 'UpToDate' } else { 'Outdated' };
        }
    } catch {
        $wuStatus = 'Unknown';
    }

    $Report.system = [ordered]@{
        osName               = [string]$os.Caption;
        osVersion            = [string]$os.Version;
        computerName         = [string]$env:COMPUTERNAME;
        userName             = [string]$env:USERNAME;
        uptimeDays           = $uptimeDays;
        startupProgramsCount = $startupCmds.Count;
        startupProgramsList  = $startupNames;
        windowsUpdateStatus  = $wuStatus;
        lastUpdateDate       = $lastUpdateDate;
        errorReason          = $null;
    };
} catch {
    $Report.system = [ordered]@{
        osName               = $null;
        osVersion            = $null;
        uptimeDays           = $null;
        startupProgramsCount = $null;
        windowsUpdateStatus  = 'Unknown';
        errorReason          = 'Unable to read operating system info';
    };
}

$DesktopPath = [Environment]::GetFolderPath('Desktop');
if (-not (Test-Path $DesktopPath)) {
    $DesktopPath = $HOME;
}
$OutputPath = Join-Path -Path $DesktopPath -ChildPath 'pc-report.json';

$JsonOutput = $Report | ConvertTo-Json -Depth 8;
[System.IO.File]::WriteAllText($OutputPath, $JsonOutput, [System.Text.Encoding]::UTF8);

try {
    Set-Clipboard -Value $JsonOutput;
    Write-Host '';
    Write-Host ' [OK] Copied JSON report directly to your Clipboard!' -ForegroundColor Cyan;
} catch {}

Write-Host '============================================================' -ForegroundColor Green;
Write-Host ' Scan Completed! Report saved to:' -ForegroundColor Green;
Write-Host (' ' + $OutputPath) -ForegroundColor White;
Write-Host ' -> Go back to PC Health Doctor web app and press Ctrl+V (or upload pc-report.json)' -ForegroundColor Yellow;
Write-Host '============================================================' -ForegroundColor Green;

try {
    $selectArg = '/select,' + $OutputPath;
    Start-Process -FilePath 'explorer.exe' -ArgumentList $selectArg;
} catch {}
`;

// คำสั่งแบบบรรทัดเดียว (Self-Contained One-Liner) ที่รันสคริปต์ตรวจเครื่องทั้งหมดได้ทันทีโดยไม่ต้องมีไฟล์ pc-check.ps1 ในเครื่อง!
export const POWERSHELL_RUN_FILE_COMMAND = POWERSHELL_SCRIPT_CONTENT
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'))
  .join(' ') + '\r\n';

// ฟังก์ชันคัดลอกข้อความลง Clipboard ที่รองรับทั้ง Clipboard API และ Fallback สำหรับ iFrame
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // หากถูกบล็อกจากนโยบาย iframe ให้ข้ามไปใช้ fallback ด้านล่าง
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export function downloadPowerShellScript() {
  const utf8Bom = '\uFEFF';
  const blob = new Blob([utf8Bom + POWERSHELL_SCRIPT_CONTENT], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pc-check.ps1';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
