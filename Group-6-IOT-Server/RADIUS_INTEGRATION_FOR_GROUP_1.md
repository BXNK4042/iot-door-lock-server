# 🔐 คู่มือและข้อกำหนดการเชื่อมต่อ RADIUS Server
### ข้อตกลงการเชื่อมต่อระหว่าง กลุ่ม 6 (IoT Server) ➔ กลุ่ม 1 (RADIUS Server)

> **จาก:** ทีมกลุ่ม 6 (IoT Server & Door Access System)  
> **ถึง:** ทีมกลุ่ม 1 (RADIUS Authentication Server)  
> **วัตถุประสงค์:** ประสานงานรายละเอียดการลงทะเบียน NAS Client, IP/Port, Shared Secret และรูปแบบ Packet ในการส่งตรวจสอบสิทธิ์นักศึกษาผ่านโปรโตคอล RADIUS (RFC 2865)

---

## 🌐 1. ข้อมูลเครือข่ายและการเชื่อมต่อ (Network Configuration)

กลุ่ม 6 ทำหน้าที่เป็น **NAS Client (Network Access Server)** ส่งแพ็กเกจ `Access-Request` ไปยัง RADIUS Server ของกลุ่ม 1 บน Proxmox VE วงแลนเสมือน `vmbr1`:

| รายการ | ค่าที่ใช้ | คำอธิบาย |
|---|---|---|
| **NAS Client IP (กลุ่ม 6)** | `10.10.10.16` | IP ของเซิร์ฟเวอร์กลุ่ม 6 (VM 106 บน Proxmox) |
| **RADIUS Server IP (กลุ่ม 1)** | `10.10.10.11` | *(หรือ IP ที่กลุ่ม 1 กำหนดบนวงแลนเดียวกัน)* |
| **Authentication Port** | `UDP 1812` | พอร์ตมาตรฐาน RADIUS Authentication |
| **Accounting Port** | `UDP 1813` | พอร์ตมาตรฐาน RADIUS Accounting |
| **Shared Secret** | `testing123` | คีย์ลับร่วมกันระหว่างกลุ่ม 6 กับกลุ่ม 1 *(สามารถปรับเปลี่ยนได้ตามที่กลุ่ม 1 กำหนด)* |
| **Authentication Protocol** | `PAP` (Password Authentication Protocol) | ส่ง User-Password ตรวจสอบโดยตรง |

---

## ⚙️ 2. สิ่งที่กลุ่ม 1 ต้องตั้งค่าใน RADIUS Server (`clients.conf`)

เพื่อให้ RADIUS Server ยอมรับแพ็กเกจจากกลุ่ม 6 ทีมกลุ่ม 1 ต้องเพิ่มการตั้งค่าต่อไปนี้ลงในไฟล์ `/etc/freeradius/3.0/clients.conf` (หรือตำแหน่งคอนฟิกของ FreeRADIUS):

```text
client 10.10.10.16 {
    ipaddr      = 10.10.10.16
    secret      = testing123
    shortname   = iot-door-server-group6
    nas_type    = other
}
```

> **สำคัญ:** หลังจากแก้ไขไฟล์ `clients.conf` กรุณารีสตาร์ตบริการ FreeRADIUS:  
> `sudo systemctl restart freeradius`

---

## 📦 3. รูปแบบ RADIUS Packet ที่กลุ่ม 6 ส่งไป (Access-Request)

เมื่อผู้ใช้กรอกรหัสนักศึกษาและรหัสผ่านผ่านหน้าเว็บเพื่อเข้าห้อง เซิร์ฟเวอร์กลุ่ม 6 จะสร้าง RADIUS Packet ด้วย Attributes ดังนี้:

```text
Code: Access-Request (1)
Secret: testing123
Attributes:
  • User-Name (1)       = "67200412"         # รหัสนักศึกษาของผู้ใช้งาน
  • User-Password (2)   = "password_here"   # รหัสผ่านของนักศึกษา
  • NAS-IP-Address (4)  = 10.10.10.16       # IP ของเครื่องกลุ่ม 6
```

---

## 📬 4. ผลตอบกลับที่กลุ่ม 6 คาดหวังจาก RADIUS Server

RADIUS Server ของกลุ่ม 1 ต้องดึงข้อมูลไปตรวจสอบกับ **MySQL Database (กลุ่ม 3)** แล้วตอบกลับ:

### กรณีที่ 1: ตรวจสอบผ่านสำเร็จ (Authentication Success)
* **Packet Code:** `Access-Accept` (2)
* **Attributes ที่แนะนำให้ส่งกลับมาด้วย (Optional):**
  * `Reply-Message` = ชื่อ-นามสกุลของนักศึกษา (เช่น `"Rujinat Fah"`)  
    *(เพื่อให้กลุ่ม 6 นำชื่อไปแสดงบน Dashboard ต้อนรับ และบันทึกลง Log)*

### กรณีที่ 2: รหัสไม่ถูกต้อง หรือไม่มีสิทธิ์ (Authentication Failed)
* **Packet Code:** `Access-Reject` (3)
* กลุ่ม 6 จะปฏิเสธการเข้าห้อง กลอนประตูไม่เปิด และแจ้งเตือนผู้ใช้งานหน้าเว็บ

---

## 🧪 5. คำสั่งทดสอบการเชื่อมต่อ (Verification Test)

กลุ่ม 1 และกลุ่ม 6 สามารถใช้คำสั่ง `radtest` ทดสอบการเชื่อมต่อได้โดยตรงจาก Terminal:

```bash
# รูปแบบ: radtest <username> <password> <radius-server-ip> <port> <shared-secret>
radtest 67200412 rujinat_fah 10.10.10.11 1812 testing123
```

**ผลลัพธ์ที่ถูกต้อง:**
```text
Received Access-Accept Id 1 from 10.10.10.11:1812 to 10.10.10.16:xxxxx length xx
```

---
*จัดทำขึ้นโดยทีมวิศวกร กลุ่มที่ 6 เพื่อให้การประสานงานเชื่อมต่อระบบ Authentication เป็นไปตามมาตรฐาน RFC 2865 ถูกต้อง 100%*
