# 🏢 Group-6-IOT-Server
## โครงสร้างระบบควบคุมประตูอัจฉริยะ (IoT Smart Door Access Server)
### โฟลเดอร์หลักสำหรับทีมพัฒนา กลุ่มที่ 6

> **⚠️ ข้อบังคับสำคัญด้านความปลอดภัยของเครื่อง (System Safety Rule):**  
> โปรเจกต์นี้ทำงานด้วย **Pure Native Node.js 100% ไม่ใช้ Docker หรือ Container ใดๆ ทั้งสิ้น** เพื่อป้องกันปัญหาความเข้ากันไม่ได้ของ Windows และป้องกันปัญหาจอฟ้า (BSOD) สามารถรันได้โดยตรงด้วยคำสั่ง `node` ธรรมดา

---

## ✅ ทำแล้ว (DONE / DO IT)
สรุปสถานะการทำงานทั้งหมดของโปรเจกต์กลุ่มที่ 6 ณ ปัจจุบัน:
- [x] **โครงสร้างระบบ Pure Native Node.js (ไม่มี Docker 100%):** พร้อมรันได้ทุกที่ทั้ง Windows และ Linux บน Proxmox
- [x] **จำลองฐานข้อมูล RADIUS (Single User Demo):** เก็บใน `backend/mock-data/users.json` สำหรับผู้ใช้ทดสอบคนเดียว: `user: 67200412` / `pass: rujinat_fah`
- [x] **ตัดระบบ MQTT ฮาร์ดแวร์จริงออกชั่วคราว:** ไม่เชื่อมต่อ Broker ให้เสียเวลา แต่ทำระบบ Door Simulator รองรับไว้ 100%
- [x] **ระบบ Auto Check-In V2:** เมื่อกรอกรหัสถูกต้อง จะถือว่าเข้าห้องทันที ประตูปลดล็อคเสมือน และบันทึก `logs/log.txt`
- [x] **ระบบ Dashboard & นาฬิกา Real-time Stopwatch:** นับเวลาที่อยู่ในห้อง (HH:MM:SS) เดินหน้าแบบเรียลไทม์
- [x] **ระบบ Smart Timestamp Comparison (สลับห้องอัตโนมัติ):** เมื่อผู้ใช้ลืมกดออกจากห้องเดิมแล้วไปสแกนห้องใหม่ ระบบจะนำเวลาปัจจุบันตัดออกห้องเดิมอัตโนมัติ และเข้าห้องใหม่ทันที
- [x] **แก้ไข Timestamp ให้เป็นเวลาประเทศไทย (Asia/Bangkok, UTC+7):** ใช้ `Intl.DateTimeFormat` จัดฟอร์แมตเวลาไทย YYYY-MM-DD HH:mm:ss ทำให้เวลาใน `log.txt` ตรงกับเวลาจริง 100% ไม่ย้อนหลัง 7 ชั่วโมง
- [x] **เปลี่ยนโลโก้ด้านบนเป็นโลโก้สถาบัน KMITL:** นำภาพ `Main Logo KMITL_Thai Orange.webp` มาแสดงที่ส่วนหัวของหน้า Login และ Dashboard แทนรูปประตูเดิม
- [x] **เพิ่มปุ่มดู/ซ่อนรหัสผ่าน (Show/Hide Password Toggle):** เพิ่มปุ่มรูปดวงตา (`👁️` / `🙈`) ข้างช่องรหัสผ่าน พร้อมสลับโหมด type ระหว่าง password และ text
- [x] **เอกสารคู่มือการนำเสนอและการดู Log:** จัดทำ `test.md` อธิบายขั้นตอนการสาธิตสด และตำแหน่งไฟล์ log.txt ที่ส่งให้กลุ่มอื่น
- [x] **คู่มือเตรียมส่งมอบขึ้น VM และเชื่อมกลุ่มอื่น:** จัดทำ `readme_to_connect.md` สำหรับให้ AI หรือทีมงานอ่านเพื่อล้าง Mock และเชื่อมระบบจริง
- [x] **ระบบป้องกัน Session ข้ามห้องและ Real-time Sync (Room Mismatch & Stale Tab Protection):** แก้ปัญหาแท็บห้องเก่าค้างนับเวลาอยู่ โดยหน้าเว็บมีระบบเช็คสถานะทุก 2.5 วินาที หากถูกตัดออกจากห้องเดิม แท็บห้องเดิมจะหยุดจับเวลา แจ้งเตือน และเด้งกลับไปหน้า Login อัตโนมัติ พร้อมฝั่ง Backend บล็อกการกด Check-Out ข้ามห้อง ป้องกันไม่ให้ไปลบ Session ห้องใหม่เด็ดขาด
- [x] **ปรับมาตรฐานสถานะการเข้า-ออกให้มีเพียง IN และ OUT เท่านั้น:** แก้ไขให้การสลับห้องบันทึกเป็นสถานะ OUT ปกติ ไม่แสดงคำว่า Auto-Switch หรือคำว่าลืมใดๆ ทั้งสิ้น ข้อมูลที่บันทึกลง `logs/log.txt` และส่งต่อให้กลุ่ม 4 มีเพียงสถานะ IN และ OUT เท่านั้น

---

## 📁 1. แผนผังโครงสร้างโฟลเดอร์สำหรับ Backend (Directory Structure)

```text
Group-6-IOT-Server/
├── package.json               # จัดการไลบรารีของ Node.js (express, cors, mqtt)
├── README.md                  # คู่มือภาพรวมส่วน Backend (ไฟล์นี้)
│
└── backend/                   # 🖥️ ฝั่งหลังบ้าน (Node.js REST API + State + Logger + Simulation)
    ├── README.md              # คู่มืออธิบายโค้ดและสถาปัตยกรรมของ Backend
    ├── Send-to-front.md       # 📑 เอกสารสัญญา API ส่งมอบให้ทีม Frontend นำไปเชื่อมต่อ
    ├── server.js              # จุดเริ่มต้นการรันเซิร์ฟเวอร์ (Entry Point)
    ├── mock-data/             # ฐานข้อมูลจำลอง (user: 67200412 / pass: rujinat_fah)
    │   ├── README.md
    │   └── users.json
    ├── routes/
    │   └── apiRoutes.js       # จัดการเส้นทาง API Endpoint (/api/door/access, /checkout, /logs)
    ├── controllers/
    │   └── doorController.js  # ตรรกะ Auto Check-In, Check-Out, และ Room Switch
    └── services/
        ├── stateService.js    # จัดการ In-Memory State ของผู้ใช้ในห้อง
        ├── loggerService.js   # โมดูลบันทึกประวัติ (เวลาไทย, มีเฉพาะ IN/OUT, สร้างโฟลเดอร์ logs อัตโนมัติ)
        ├── authService.js     # ตรวจสอบสิทธิ์ (รองรับทั้ง Mock และ RADIUS จริง)
        └── mqttService.js     # จำลองการส่งคำสั่งปลดล็อคกลอนประตู (Door Simulator)
```

---

## 🎯 2. รายละเอียดไฟล์และส่วนประกอบ Backend

| โฟลเดอร์/ไฟล์ | คืออะไร | มีไว้ทำไม | ข้อมูลที่เก็บภายใน |
|---|---|---|---|
| **`backend/`** | เซิร์ฟเวอร์หลักของกลุ่ม 6 | ประมวลผลคำขอ สั่งการประตู บันทึกประวัติ | โค้ด Logic, State Management, MQTT Client, Logger |
| **`backend/Send-to-front.md`** | สัญญา API สำหรับทีมหน้าบ้าน | ส่งมอบให้เพื่อนทีม Frontend นำไปเชื่อมต่อหน้าเว็บ | รูปแบบ JSON Request/Response, Endpoints ทั้งหมด |
| **`backend/mock-data/`** | ฐานข้อมูลผู้ใช้จำลอง | จำลองข้อมูล RADIUS/MySQL ทดสอบในกลุ่ม | ข้อมูล `67200412` / `rujinat_fah` |
| **`package.json`** | จัดการ Dependencies | กำหนด Express, CORS, MQTT สำหรับรันเซิร์ฟเวอร์ | รายชื่อไลบรารีและคำสั่งรันระบบ (`npm start`) |

---

## 🔄 3. Flow การไหลของข้อมูลในระบบ (End-to-End System Flow)

```text
[1. ผู้ใช้สแกน QR Code หน้าห้อง] 
        │ URL: https://door.domain/?room=LAB-401
        ▼
[2. frontend/public/index.html] 
        │ ดึงค่า room=LAB-401 มาแสดง ➔ ผู้ใช้กรอกรหัส นศ. 67200412 / rujinat_fah
        ▼ HTTP POST /api/door/access (studentId, password, targetRoom)
[3. backend/server.js ➔ doorController.js]
        │ 
        ├──> [3.1 authService.js] ➔ เช็คกับ mock-data/users.json ➔ ได้ผลว่าผ่าน (Rujinat Fah)
        │
        ├──> [3.2 stateService.js] ➔ ตรวจสอบสถานะ:
        │       • หากค้างอยู่ห้องอื่น (ลืมกดออก) ➔ นำเวลาปัจจุบันตัดจบห้องเดิมทันที
        │       • ทำการบันทึกสถานะ Check-In ห้องใหม่
        │
        ├──> [3.3 mqttService.js] ➔ จำลองคำสั่ง UNLOCK 5 วินาที
        │
        └──> [3.4 loggerService.js] ➔ บันทึกเหตุการณ์ลง logs/log.txt ทันที
        ▼
[4. Frontend ตอบสนองทันที]
        │ เปลี่ยนหน้าเป็น "ขอต้อนรับเข้าสู่ห้อง LAB-401"
        │ แสดงชื่อ Rujinat Fah (รหัส: 67200412)
        │ เริ่มนาฬิกา Live Stopwatch นับเวลาอยู่ในห้องแบบ Real-time
        │ มีปุ่ม "ออกจากห้อง" เพียงปุ่มเดียว
        ▼
[5. เมื่อผู้ใช้กดปุ่ม "ออกจากห้อง"]
        │ ยิง HTTP POST /api/door/checkout
        │ backend สั่งปลดล็อคประตู ➔ ล้าง Session ➔ บันทึก logs/log.txt เป็น [OUT]
```

---

## 🚀 4. วิธีการรันโปรเจกต์และทดสอบ (Native Node.js ปลอดภัย 100%)

### ขั้นตอนที่ 1: ติดตั้ง Dependencies
เปิด Terminal (PowerShell) เข้ามาที่โฟลเดอร์นี้:
```powershell
cd "C:\Users\Asus\OneDrive\เดสก์ท็อป\IOT-Door\iot-door-lock-server\Group-6-IOT-Server"
npm install
```

### ขั้นตอนที่ 2: รันเซิร์ฟเวอร์
```powershell
npm start
```

### ขั้นตอนที่ 3: เปิดทดสอบผ่านเบราว์เซอร์
เปิดเบราว์เซอร์แล้วเข้า URL:
👉 **`http://localhost:3000/?room=LAB-401`**

* **รหัสนักศึกษา:** `67200412`
* **รหัสผ่าน:** `rujinat_fah`
