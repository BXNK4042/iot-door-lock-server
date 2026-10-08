# 📑 Send-to-front.md (เอกสารส่งมอบงานจาก Backend ถึง Frontend)
## คู่มือสัญญา API และขอบเขตการทำงานร่วมกัน เพื่อไม่ให้ระบบพัง

> **จาก:** ทีม Backend (ผู้ดูแลระบบ API, State, MQTT และ Logger)  
> **ถึง:** ทีม Frontend (ผู้พัฒนาหน้าเว็บและ UI)  
> **วัตถุประสงค์:** ชี้แจงสิ่งที่ Backend เตรียมไว้ให้, กฎเหล็กที่ห้ามแก้ไข และวิธีการเชื่อมต่อ

---

### 1. สิ่งที่ Backend ทำเสร็จสมบูรณ์แล้วในระบบ
1. **Express Server:** รันที่ Port `3000` และเปิด CORS รองรับการเชื่อมต่อจากทุกอุปกรณ์
2. **Auto Check-In V2:** เมื่อรับคำขอ Login แล้วตรวจผ่าน จะบันทึกเข้าห้องทันที ปลดล็อคกลอน และบันทึก `log.txt [IN]`
3. **Smart Timestamp Comparison:** หากผู้ใช้ลืมออกห้องเดิม แล้วสแกนห้องใหม่ ระบบหลังบ้านจะตัดออกห้องเดิมให้เองอัตโนมัติ โดยที่หน้าบ้านไม่ต้องเขียนเงื่อนไขนี้เอง!
4. **Mock Authentication ในตัว:** ตรวจสอบกับ `backend/mock-data/users.json` สำหรับผู้ใช้ทดสอบคนเดียว:
   * รหัสนักศึกษาทดสอบ: `67200412`
   * รหัสผ่าน: `rujinat_fah`

---

### 2. สัญญา API ที่ Frontend ต้องเรียกใช้ (API Contract)

#### 🔹 API 1: สแกน Login เข้าห้อง (Auto Check-In)
* **Method:** `POST`
* **URL:** `/api/door/access` (หรือ `http://localhost:3000/api/door/access`)
* **Headers:** `Content-Type: application/json`
* **Request Body ที่ Frontend ต้องส่งมา (JSON):**
```json
{
  "studentId": "64010123",
  "password": "password123",
  "targetRoom": "LAB-401"
}
```
* **Response เมื่อสำเร็จ (HTTP 200):**
```json
{
  "success": true,
  "status": "CHECKED_IN",
  "message": "ขอต้อนรับเข้าสู่ห้อง LAB-401",
  "room": "LAB-401",
  "studentId": "64010123",
  "studentName": "Somchai Jaidee",
  "enteredAt": "2026-10-07T00:30:00.000Z"
}
```
*(⚠️ ให้ Frontend นำค่า `enteredAt` นี้ไปเริ่มนาฬิกานับเวลา Real-time Stopwatch บนหน้า Dashboard)*

* **Response เมื่อรหัสผิด (HTTP 401):**
```json
{
  "success": false,
  "message": "รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง"
}
```

---

#### 🔹 API 2: กดปุ่มออกจากห้อง (Check-Out)
* **Method:** `POST`
* **URL:** `/api/door/checkout`
* **Headers:** `Content-Type: application/json`
* **Request Body ที่ Frontend ต้องส่งมา (JSON):**
```json
{
  "studentId": "64010123",
  "room": "LAB-401"
}
```
* **Response เมื่อสำเร็จ (HTTP 200):**
```json
{
  "success": true,
  "status": "CHECKED_OUT",
  "message": "ออกจากห้อง LAB-401 เรียบร้อยแล้ว ขอบคุณที่ใช้บริการ",
  "room": "LAB-401",
  "studentId": "67200412",
  "leftAt": "2026-10-07T01:15:00.000Z"
}
```
* **Response เมื่อเกิด Room Mismatch (แท็บเก่าค้างอยู่ แต่ย้ายไปห้องอื่นแล้ว) (HTTP 400):**
```json
{
  "success": false,
  "status": "ROOM_MISMATCH",
  "message": "คุณไม่ได้อยู่ในห้อง LAB-401 แล้ว เนื่องจากระบบได้ตัดคุณเข้าสู่ห้อง LAB-402 เรียบร้อยแล้ว",
  "currentActiveRoom": "LAB-402"
}
```

---

#### 🔹 API 3: ตรวจสอบสถานะ Session แบบ Real-time (Session Heartbeat Sync)
* **Method:** `GET`
* **URL:** `/api/session/:studentId?room=LAB-401`
* **Response (HTTP 200):**
```json
{
  "success": true,
  "hasActiveSession": true,
  "isCurrentRoom": true,
  "currentRoom": "LAB-401",
  "session": { ... }
}
```
*(⚠️ หาก `isCurrentRoom === false` หรือ `hasActiveSession === false` หมายความว่าผู้ใช้ถูก auto-switch ไปห้องอื่นหรือออกจากระบบแล้ว ให้ Frontend รีเซ็ตกลับหน้า Login ทันที)*

---

### 3. 🛡️ ขอบเขตที่ Frontend แก้ไขได้ vs ห้ามแก้เด็ดขาด (Security & Stability Boundaries)

| สิ่งที่ Frontend **ทำได้และปรับแต่งได้อิสระ** ✅ | สิ่งที่ Frontend **ห้ามแก้ไขเด็ดขาด** ❌ *(เสี่ยงทำระบบพัง)* |
|---|---|
| • ออกแบบ CSS สีสัน เลย์เอาต์ หน้าตาปุ่ม โลโก้ | ❌ **ห้ามเปลี่ยนชื่อ Key ใน JSON:** ห้ามเปลี่ยน `studentId`, `password`, `targetRoom` เป็นชื่ออื่น |
| • เพิ่มลูกเล่น Animation หรือเสียงแจ้งเตือนบนเว็บ | ❌ **ห้ามเปลี่ยนชื่อ URL API:** ต้องใช้ `/api/door/access`, `/api/door/checkout`, `/api/session` เท่านั้น |
| • ปรับแต่งรูปแบบการแสดงเวลานับถอยหลัง / เดินหน้า | ❌ **ห้ามคิด Logic การสลับห้องเอง:** ปล่อยให้ Backend จัดการเรื่อง Timestamp สลับห้อง เพราะ Backend ต้องเป็นคนเขียน `log.txt` |
| • ย้ายไฟล์ใน `frontend/public/` ได้ตามสะดวก | ❌ **ห้ามลบโฟลเดอร์ `logs/` หรือย้ายไฟล์ `server.js`** |

---

### 4. วิธีทดสอบเชื่อมต่อสำหรับ Frontend
1. ให้ Backend รันเซิร์ฟเวอร์ด้วยคำสั่ง `npm start` (จะเปิดที่ `http://localhost:3000`)
2. ฝั่ง Frontend เปิดหน้าเว็บ `http://localhost:3000/?room=LAB-401`
3. ลองกรอกรหัส `67200412` และรหัสผ่าน `rujinat_fah`
4. หน้าเว็บควรได้รับ JSON สำเร็จ และเปลี่ยนเป็นหน้า Dashboard ต้อนรับทันที!

