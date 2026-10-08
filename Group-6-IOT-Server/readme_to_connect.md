# 🚀 readme_to_connect.md
## คู่มือการล้างข้อมูลจำลอง (Cleanup) และเชื่อมต่อระบบจริงกับกลุ่มต่างๆ บน Proxmox VE

> **สำหรับ:** AI หรือทีมวิศวกรที่นำโค้ด `Group-6-IOT-Server` ขึ้นรันบน **Proxmox VM 106 (IP: 10.10.10.16)**  
> **วัตถุประสงค์:** ทำตามขั้นตอนในเอกสารนี้เพื่อ **ลบระบบจำลอง (Mock) ทั้งหมดออก** และเปิดสวิตช์เชื่อมต่อกับระบบจริงของกลุ่ม 1, 2, 3, 4 แบบอัตโนมัติ

---

## 📋 สารบัญขั้นตอนการเปลี่ยนผ่านสู่ Production (Migration Steps)
1. [สิ่งที่ต้องลบออก (Files to Delete)](#1-สิ่งที่ต้องลบออก-files-to-delete)
2. [การสลับโค้ดจาก Mock เป็น Production (Code Configuration)](#2-การสลับโค้ดจาก-mock-เป็น-production)
3. [สิ่งที่กลุ่มเรา (กลุ่ม 6) ต้องส่งต่อให้กลุ่มอื่น](#3-สิ่งที่กลุ่มเรา-กลุ่ม-6-ต้องส่งต่อให้กลุ่มอื่น)
4. [สิ่งที่กลุ่มอื่นต้องเตรียมให้เรา (Dependencies from other groups)](#4-สิ่งที่กลุ่มอื่นต้องเตรียมให้เรา)
5. [คำสั่งล้างและเริ่มรันระบบจริง (Quick Terminal Commands)](#5-คำสั่งล้างและเริ่มรันระบบจริง)

---

## 🗑️ 1. สิ่งที่ต้องลบออก (Files to Delete)

เมื่อขึ้น Production จริงบน Proxmox ให้ลบส่วนจำลองต่อไปนี้ทิ้ง:

### 1.1 ลบโฟลเดอร์ฐานข้อมูลจำลอง:
* ลบโฟลเดอร์: `backend/mock-data/` ทั้งโฟลเดอร์  
  *(เพราะจะใช้ฐานข้อมูลนักศึกษาจริงของกลุ่ม 1 และกลุ่ม 2 ผ่านระบบของกลุ่ม 3)*

### 1.2 ล้างข้อมูลประวัติใน `logs/log.txt`:
* เคลียร์เนื้อหาใน `logs/log.txt` ให้เป็นไฟล์ว่าง เพื่อเริ่มเก็บบันทึกประวัติจริงของนักศึกษาตั้งแต่วันเริ่มใช้งาน

---

## ⚙️ 2. การสลับโค้ดจาก Mock เป็น Production

### 2.1 สลับระบบยืนยันตัวตน (Auth Service):
เปิดไฟล์ [`backend/services/authService.js`](./backend/services/authService.js) แล้วเปลี่ยนค่าตัวแปร:

```javascript
// เปลี่ยนจาก MOCK_DEMO เป็น PRODUCTION_API
const AUTH_MODE = 'PRODUCTION_API';

// ยืนยันว่า IP ชี้ไปยัง VM 103 ของกลุ่ม 3 บนวง vmbr1
const PRODUCTION_AUTH_API_URL = 'http://10.10.10.13:4000/api/auth/login';
```

### 2.2 สลับระบบ MQTT (เมื่อมีฮาร์ดแวร์ ESP32 กลุ่ม 7):
เปิดไฟล์ [`backend/services/mqttService.js`](./backend/services/mqttService.js) แล้วเปลี่ยนค่าตัวแปร:

```javascript
// เปลี่ยนจาก false เป็น true เพื่อเชื่อมต่อ MQTT Broker จริง
const ENABLE_MQTT_CONNECTION = true;
const MQTT_BROKER_URL = 'mqtt://127.0.0.1:1883'; // หรือ IP ของ Broker
```

---

## 📤 3. สิ่งที่กลุ่มเรา (กลุ่ม 6) ต้องส่งต่อให้กลุ่มอื่น

เมื่อรันระบบบน Proxmox VM 106 (IP: `10.10.10.16`):

### 3.1 ส่งให้กลุ่มที่ 4 (Web Application):
* **Endpoint สำหรับดึงข้อมูล Log:**
  ```text
  GET http://10.10.10.16:3000/api/logs
  ```
* **หน้าที่ของกลุ่ม 4:** ยิง HTTP GET มาที่ URL นี้เป็นระยะ หรือทำระบบ Polling เพื่อนำข้อมูลข้อความ 5 คอลัมน์ไป Parse และแสดงกราฟสถิติบน Dashboard รวมของมหาวิทยาลัย

### 3.2 สำหรับนักศึกษาผู้ใช้งาน (QR Code หน้าห้อง):
* **URL ที่ต้องนำไปสร้าง QR Code แปะหน้าห้อง:**
  * หากใช้ **Cloudflare Tunnel:** `https://door.myproject.com/?room=LAB-401`
  * หากใช้ **Playit.gg:** `http://door-app.at.ply.gg:xxxxx/?room=LAB-401`
  * หากใช้ **Public IP:** `http://[PUBLIC_IP]:3000/?room=LAB-401`

---

## 📥 4. สิ่งที่กลุ่มอื่นต้องเตรียมให้เรา

เพื่อให้กลุ่ม 6 ทำงานได้สมบูรณ์ กลุ่มพันธมิตรต้องเปิดบริการดังนี้:

### 4.1 กลุ่มที่ 3 (Authentication API Server) - VM 103 (IP: `10.10.10.13`):
* ต้องเปิดให้บริการ API ที่พอร์ต `4000` (หรือพอร์ตที่ตกลงกัน)
* ต้องรับ `POST /api/auth/login` ที่มี Body:
  ```json
  { "studentId": "...", "password": "..." }
  ```
* และตอบกลับเมื่อรหัสผ่านถูกต้อง (HTTP 200):
  ```json
  { "success": true, "studentName": "ชื่อนักศึกษา", "studentId": "รหัส นศ." }
  ```

### 4.2 กลุ่มที่ 1 & 2 (RADIUS & MySQL):
* ต้องเชื่อมต่อฐานข้อมูลให้เรียบร้อย เพื่อให้กลุ่ม 3 สามารถดึงข้อมูลรหัสนักศึกษามาตรวจสอบได้

---

## 🚀 5. คำสั่งล้างและเริ่มรันระบบจริง (Quick Terminal Commands)

เมื่อ AI หรือผู้ดูแลระบบเข้ามาที่ VM 106 บน Proxmox ให้รันคำสั่งชุดนี้ได้ทันที:

```bash
# 1. เข้าสู่โฟลเดอร์โปรเจกต์
cd /path/to/Group-6-IOT-Server

# 2. ลบโฟลเดอร์จำลองออก
rm -rf backend/mock-data

# 3. ล้างไฟล์ log ให้พร้อมใช้งานจริง
> logs/log.txt

# 4. ติดตั้ง dependencies (Pure Node.js ไม่ใช้ Docker)
npm install --production

# 5. เริ่มรันระบบแบบ Production (ด้วยโหมด API จริง)
export AUTH_MODE="PRODUCTION_API"
export AUTH_API_URL="http://10.10.10.13:4000/api/auth/login"
npm start
```

---
*จัดทำขึ้นเพื่อให้การส่งมอบงานเข้าสู่ Proxmox VM และการเชื่อมต่อข้ามกลุ่มเป็นไปอย่างราบรื่นและแม่นยำ 100%*
