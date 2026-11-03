import { EvaluatedComponent } from '../types/pcHealth';

export interface OfficialDriverLink {
  label: string;
  provider: string;
  url: string;
  isPrimary?: boolean;
  description?: string;
}

// คืนค่ารายการลิงก์ดาวน์โหลดไดรเวอร์และเฟิร์มแวร์จากเว็บไซต์ทางการของผู้ผลิตตามรุ่นอุปกรณ์ที่ตรวจพบจริง
export function getDriverUpdateLinksForComponent(
  component: EvaluatedComponent
): OfficialDriverLink[] {
  const model = (component.modelName || '').toLowerCase();
  const rec = (component.recommendation || '').toLowerCase();
  const links: OfficialDriverLink[] = [];

  // 1. การ์ดจอ (GPU)
  if (component.category === 'gpu') {
    if (model.includes('nvidia') || model.includes('geforce') || model.includes('rtx') || model.includes('gtx')) {
      links.push({
        label: 'อัปเดตไดรเวอร์ NVIDIA (เว็บทางการ)',
        provider: 'NVIDIA Official',
        url: 'https://www.nvidia.com/Download/index.aspx',
        isPrimary: true,
        description: 'ดาวน์โหลด Game Ready / Studio Driver ล่าสุดสำหรับการ์ดจอ NVIDIA GeForce',
      });
      links.push({
        label: 'ดาวน์โหลด NVIDIA App (อัปเดตอัตโนมัติ)',
        provider: 'NVIDIA',
        url: 'https://www.nvidia.com/en-us/software/nvidia-app/',
        description: 'โปรแกรมตรวจหาและติดตั้งไดรเวอร์การ์ดจอ NVIDIA อัตโนมัติ',
      });
    } else if (model.includes('amd') || model.includes('radeon')) {
      links.push({
        label: 'อัปเดตไดรเวอร์ AMD Radeon (เว็บทางการ)',
        provider: 'AMD Official',
        url: 'https://www.amd.com/en/support/download/drivers.html',
        isPrimary: true,
        description: 'ดาวน์โหลด AMD Software: Adrenalin Edition และระบบตรวจหาไดรเวอร์อัตโนมัติ',
      });
    } else if (model.includes('intel') || model.includes('arc') || model.includes('iris') || model.includes('uhd')) {
      links.push({
        label: 'อัปเดตไดรเวอร์ Intel Graphics (Auto-Detect)',
        provider: 'Intel Official',
        url: 'https://www.intel.com/content/www/us/en/support/detect.html',
        isPrimary: true,
        description: 'Intel Driver & Support Assistant ตรวจสอบและอัปเดตไดรเวอร์กราฟิกอัตโนมัติ',
      });
    } else {
      // กรณีไม่ทราบรุ่นแน่ชัด ให้แสดงทั้ง 3 ค่ายหลัก
      links.push(
        {
          label: 'อัปเดตไดรเวอร์ NVIDIA',
          provider: 'NVIDIA',
          url: 'https://www.nvidia.com/Download/index.aspx',
          isPrimary: true,
        },
        {
          label: 'อัปเดตไดรเวอร์ AMD Radeon',
          provider: 'AMD',
          url: 'https://www.amd.com/en/support/download/drivers.html',
        },
        {
          label: 'อัปเดตไดรเวอร์ Intel Graphics',
          provider: 'Intel',
          url: 'https://www.intel.com/content/www/us/en/support/detect.html',
        }
      );
    }

    if (rec.includes('ddu') || component.status === 'critical') {
      links.push({
        label: 'ดาวน์โหลดโปรแกรม DDU (ลบไดรเวอร์เก่าอย่างสะอาด)',
        provider: 'Wagnardsoft Official',
        url: 'https://www.wagnardsoft.com/display-driver-uninstaller-ddu-',
        description: 'ใช้สำหรับถอนการติดตั้งไดรเวอร์การ์ดจอเดิมเมื่อเกิดอาการไดรเวอร์หลุด (Event 4101)',
      });
    }
  }

  // 2. เมนบอร์ด และ BIOS (Mainboard / Chipset / Notebook OEM)
  if (component.category === 'mainboard') {
    if (model.includes('asus') || model.includes('tuf') || model.includes('rog') || model.includes('prime')) {
      links.push({
        label: 'อัปเดต BIOS & Chipset (ASUS Official)',
        provider: 'ASUS Support',
        url: 'https://www.asus.com/th/support/download-center/',
        isPrimary: true,
        description: 'ศูนย์ดาวน์โหลด BIOS, Chipset, Audio และ LAN Driver ของเมนบอร์ดและโน้ตบุ๊ก ASUS',
      });
    } else if (model.includes('msi') || model.includes('micro-star') || model.includes('tomahawk') || model.includes('mag') || model.includes('mpg')) {
      links.push({
        label: 'อัปเดต BIOS & ไดรเวอร์ (MSI Official)',
        provider: 'MSI Support',
        url: 'https://www.msi.com/support/download',
        isPrimary: true,
        description: 'ศูนย์ดาวน์โหลด BIOS และไดรเวอร์เมนบอร์ด/โน้ตบุ๊ก MSI อย่างเป็นทางการ',
      });
    } else if (model.includes('gigabyte') || model.includes('aorus')) {
      links.push({
        label: 'อัปเดต BIOS & ไดรเวอร์ (GIGABYTE Official)',
        provider: 'GIGABYTE Support',
        url: 'https://www.gigabyte.com/th/Support/Consumer/Download',
        isPrimary: true,
        description: 'ศูนย์ดาวน์โหลด BIOS และไดรเวอร์เมนบอร์ด GIGABYTE / AORUS',
      });
    } else if (model.includes('asrock')) {
      links.push({
        label: 'อัปเดต BIOS & ไดรเวอร์ (ASRock Official)',
        provider: 'ASRock Support',
        url: 'https://www.asrock.com/support/index.th.asp?cat=Drivers',
        isPrimary: true,
        description: 'ศูนย์ดาวน์โหลด BIOS และไดรเวอร์เมนบอร์ด ASRock',
      });
    } else if (model.includes('lenovo') || model.includes('ideapad') || model.includes('thinkpad') || model.includes('legion')) {
      links.push({
        label: 'อัปเดตไดรเวอร์ & BIOS (Lenovo Support)',
        provider: 'Lenovo Official',
        url: 'https://pcsupport.lenovo.com/',
        isPrimary: true,
        description: 'ตรวจหาและอัปเดตไดรเวอร์โน้ตบุ๊ก Lenovo อัตโนมัติ (Lenovo System Update)',
      });
    } else if (model.includes('dell') || model.includes('alienware') || model.includes('inspiron')) {
      links.push({
        label: 'อัปเดตไดรเวอร์ & BIOS (Dell Support)',
        provider: 'Dell Official',
        url: 'https://www.dell.com/support/home/th-th?app=drivers',
        isPrimary: true,
        description: 'ศูนย์ดาวน์โหลดไดรเวอร์และ BIOS ของ Dell SupportAssist',
      });
    } else if (model.includes('hp') || model.includes('victus') || model.includes('omen') || model.includes('pavilion')) {
      links.push({
        label: 'อัปเดตไดรเวอร์ & BIOS (HP Support)',
        provider: 'HP Official',
        url: 'https://support.hp.com/th-th/drivers',
        isPrimary: true,
        description: 'ศูนย์ดาวน์โหลดไดรเวอร์และเฟิร์มแวร์อย่างเป็นทางการของ HP',
      });
    } else if (model.includes('acer') || model.includes('nitro') || model.includes('predator')) {
      links.push({
        label: 'อัปเดตไดรเวอร์ & BIOS (Acer Support)',
        provider: 'Acer Official',
        url: 'https://www.acer.com/th-th/support/drivers-and-manuals',
        isPrimary: true,
        description: 'ศูนย์ดาวน์โหลดไดรเวอร์และ BIOS อย่างเป็นทางการของ Acer',
      });
    } else {
      links.push(
        {
          label: 'อัปเดต Intel Chipset / Driver Assistant',
          provider: 'Intel Official',
          url: 'https://www.intel.com/content/www/us/en/support/detect.html',
          isPrimary: true,
        },
        {
          label: 'อัปเดต AMD Chipset Drivers',
          provider: 'AMD Official',
          url: 'https://www.amd.com/en/support/download/drivers.html',
        }
      );
    }
  }

  // 3. หน่วยประมวลผล (CPU & Chipset Driver)
  if (component.category === 'cpu') {
    if (model.includes('intel') || model.includes('core')) {
      links.push({
        label: 'อัปเดตไดรเวอร์ Intel (Driver & Support Assistant)',
        provider: 'Intel Official',
        url: 'https://www.intel.com/content/www/us/en/support/detect.html',
        isPrimary: component.actionType === 'อัปเดต',
        description: 'สแกนและอัปเดตไดรเวอร์ชิปเซ็ต การ์ดจอออนบอร์ด Wi-Fi และ Bluetooth ของ Intel',
      });
    } else if (model.includes('amd') || model.includes('ryzen')) {
      links.push({
        label: 'อัปเดตไดรเวอร์ AMD Chipset (เว็บทางการ)',
        provider: 'AMD Official',
        url: 'https://www.amd.com/en/support/download/drivers.html',
        isPrimary: component.actionType === 'อัปเดต',
        description: 'อัปเดต AMD Chipset Driver เพื่อเพิ่มความเสถียรของ CPU Ryzen และการจัดการพลังงาน',
      });
    }
  }

  // 4. ดิสก์ SSD / HDD (อัปเดตเฟิร์มแวร์ SSD และโปรแกรมตรวจสุขภาพของผู้ผลิต)
  if (component.category === 'disk') {
    if (model.includes('samsung')) {
      links.push({
        label: 'อัปเดตเฟิร์มแวร์ SSD (Samsung Magician)',
        provider: 'Samsung Official',
        url: 'https://semiconductor.samsung.com/consumer-storage/support/tools/',
        isPrimary: true,
        description: 'โปรแกรมทางการของ Samsung สำหรับอัปเดตเฟิร์มแวร์และเช็กสุขภาพ SSD',
      });
    } else if (model.includes('wd') || model.includes('western') || model.includes('sandisk') || model.includes('sn')) {
      links.push({
        label: 'อัปเดตเฟิร์มแวร์ SSD (WD Dashboard)',
        provider: 'Western Digital Official',
        url: 'https://support-en.wd.com/app/products/downloads/softwaredownloads',
        isPrimary: true,
        description: 'โปรแกรมทางการของ WD สำหรับอัปเดตเฟิร์มแวร์และเช็กสุขภาพ WD Blue / WD_BLACK',
      });
    } else if (model.includes('kingston')) {
      links.push({
        label: 'อัปเดตเฟิร์มแวร์ SSD (Kingston SSD Manager)',
        provider: 'Kingston Official',
        url: 'https://www.kingston.com/th/support/technical/ssdmanager',
        isPrimary: true,
        description: 'โปรแกรมทางการของ Kingston สำหรับตรวจสอบและอัปเดตเฟิร์มแวร์ SSD',
      });
    } else if (model.includes('crucial')) {
      links.push({
        label: 'อัปเดตเฟิร์มแวร์ SSD (Crucial Storage Executive)',
        provider: 'Crucial Official',
        url: 'https://www.crucial.com/support/storage-executive',
        isPrimary: true,
      });
    } else if (model.includes('seagate')) {
      links.push({
        label: 'ดาวน์โหลด Seagate SeaTools',
        provider: 'Seagate Official',
        url: 'https://www.seagate.com/support/downloads/seatools/',
        isPrimary: true,
      });
    }
  }

  // 5. ระบบปฏิบัติการ (Windows OS & Windows Update)
  if (component.category === 'os') {
    links.push(
      {
        label: 'เปิดหน้า Windows Update บนเครื่องทันที',
        provider: 'Windows Settings',
        url: 'ms-settings:windowsupdate',
        isPrimary: true,
        description: 'เปิดหน้าต่างตั้งค่า Windows Update ในเครื่องของคุณโดยตรงเพื่อกด Check for updates',
      },
      {
        label: 'ดาวน์โหลด Windows 11 Update Assistant (Microsoft)',
        provider: 'Microsoft Official',
        url: 'https://www.microsoft.com/software-download/windows11',
        description: 'เครื่องมืออัปเดตและซ่อมแซมระบบ Windows 11 จากเว็บไซต์ทางการของ Microsoft',
      }
    );
  }

  // 6. แรม (RAM Diagnostic Tool)
  if (component.category === 'ram' && component.status !== 'normal') {
    links.push({
      label: 'ดาวน์โหลด MemTest86 (ตัวทดสอบแรมมาตรฐาน)',
      provider: 'PassMark Official',
      url: 'https://www.memtest86.com/download.htm',
      isPrimary: false,
      description: 'เครื่องมือสร้าง USB สำหรับทดสอบหาจุดเสียของแถว RAM อย่างละเอียด',
    });
  }

  return links;
}
