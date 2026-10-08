# 🖥️ Backend Documentation (ระบบหลังบ้าน)
## โฟลเดอร์ `backend/` มีไว้ทำไม และทำงานอย่างไร?

### 1. วัตถุประสงค์
โฟลเดอร์นี้คือ "สมองส่วนกลาง" ของระบบกลุ่มที่ 6 ทำหน้าที่รับคำขอจากหน้าเว็บสแกน QR Code, ตรวจสอบตัวตนกับ RADIUS จำลอง, ตัดสินใจปลดล็อคกลอนประตู, จัดการ State เวลาผู้ใช้สลับห้อง และบันทึกประวัติลง `log.txt`

---

## ✅ ทำแล้ว (DONE / DO IT)
รายการงานฝั่ง Backend ที่พัฒนาเสร็จสมบูรณ์ 100% พร้อมใช้งาน:
- [x] **สร้างโครงสร้าง Pure Node.js (ไม่ใช้ Docker):** รันตรงผ่าน `node backend/server.js` ปลอดภัยต่อ Windows
- [x] **จำลองฐานข้อมูล RADIUS (Single User Demo):** เก็บใน `backend/mock-data/users.json` เฉพาะ `user: 67200412` / `pass: rujinat_fah`
- [x] **ระบบ Auto Check-In V2:** เมื่อล็อกอินผ่าน จะถือว่าเข้าห้องทันที และเริ่มนับเวลา Real-time
- [x] **ระบบ Smart Timestamp Comparison (สลับห้องอัตโนมัติ):** ถ้า นศ. ลืมกดออกจากห้องเดิมแล้วไปสแกนห้องใหม่ ระบบจะนำเวลาปัจจุบันตัดออกห้องเดิมลง `log.txt` ทันที และเข้าห้องใหม่ให้อัตโนมัติ
- [x] **ระบบ Logging 5 คอลัมน์:** บันทึกข้อมูลลง `logs/log.txt` (Timestamp | รหัส นศ. | ชื่อ | ห้อง | สถานะ)
- [x] **ตัด MQTT จริงออกชั่วคราว:** ไม่พยายามเชื่อมต่อ Broker ให้เปลืองทรัพยากร แต่ทำ Door Simulator รองรับไว้ 100%
- [x] **แก้ไข Timestamp ให้เป็นเวลาประเทศไทย (Asia/Bangkok, UTC+7):** ใช้ `Intl.DateTimeFormat` จัดฟอร์แมตเวลาไทย YYYY-MM-DD HH:mm:ss ทำให้เวลาใน `log.txt` ตรงกับเวลาจริง 100% ไม่ย้อนหลัง 7 ชั่วโมง
- [x] **ระบบ Room Mismatch Protection:** ตรวจสอบว่าห้องที่ขอกดออกต้องตรงกับห้องปัจจุบันเท่านั้น ป้องกันแท็บห้องเก่าไปลบ Session ห้องใหม่เด็ดขาด
- [x] **ทำเอกสารส่งมอบงาน Frontend:** จัดทำไฟล์ `backend/Send-to-front.md` สัญญา API ชัดเจน

---

### 2. โครงสร้างไฟล์ภายใน `backend/`
```text
backend/
├── server.js                  # ตัวเริ่มต้น Express Server และเสิร์ฟไฟล์ Frontend
├── Send-to-front.md           # สัญญา API และข้อตกลงส่งมอบงานให้ Frontend
├── mock-data/                 # ฐานข้อมูล RADIUS จำลอง (user: 67200412 / pass: rujinat_fah)
│   ├── README.md
│   └── users.json
├── routes/
│   └── apiRoutes.js           # จัดการ URL Endpoints ต่างๆ
├── controllers/
│   └── doorController.js      # Logic การทำงาน: Auto Check-In, Check-Out, สลับห้อง
└── services/
    ├── stateService.js        # เก็บตารางสถานะผู้ใช้และเวลาเข้า (In-Memory Map)
    ├── loggerService.js       # ฟังก์ชันเขียนไฟล์ logs/log.txt (5 คอลัมน์)
    ├── authService.js         # ตรวจสอบรหัสผ่านกับ mock-data/users.json (รองรับสลับไป API จริง)
    └── mqttService.js         # จำลองการส่งคำสั่งปลดล็อคกลอนประตู (รองรับเชื่อมต่อ Hardware จริง)
```

---

### 3. Data Flow ภายใน Backend (เมื่อมีคำขอ Login เข้ามา)
```text
1. คำขอ HTTP POST เข้ามาที่ server.js
   │
2. ส่งต่อให้ routes/apiRoutes.js ➔ controllers/doorController.js
   │
3. doorController เรียก services/authService.js (เช็คสิทธิ์กับ mock-data/users.json)
   ├── ถ้าไม่ตรงกับ 67200412 / rujinat_fah ➔ ตอบกลับ 401 ทันที
   └── ถ้าถูกต้อง ➔ ได้ชื่อ Rujinat Fah ดำเนินการต่อ
       │
4. doorController ตรวจสอบกับ services/stateService.js
   ├── ถ้าพบว่ามีประวัติอยู่ห้องเดิมอื่น
   │     └── เรียก services/loggerService.js บันทึก [OUT] ห้องเดิม
   └── บันทึก Session เข้าห้องใหม่ใน stateService.js
       │
5. doorController เรียก services/mqttService.js
   └── จำลองคำสั่ง UNLOCK 5 วินาที
       │
6. doorController เรียก services/loggerService.js
   └── บันทึกเหตุการณ์ [IN] ห้องใหม่ลง logs/log.txt
       │
7. ส่ง Response 200 OK กลับไปให้ Frontend พร้อม enteredAt และชื่อ Rujinat Fah
```

---

### 4. การรันเซิร์ฟเวอร์ (Native Node.js - ปลอดภัย ไม่ใช้ Docker)
```powershell
# จากโฟลเดอร์ Group-6-IOT-Server
npm start
```
เซิร์ฟเวอร์จะเปิดทำงานที่ `http://localhost:3000` โดยอัตโนมัติ
