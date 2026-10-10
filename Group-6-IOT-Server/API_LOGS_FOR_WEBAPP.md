# 📑 คู่มือการดึง Access Logs จากกลุ่ม 6 (IoT Server)
### สำหรับทีม Web Application / Dashboard (กลุ่ม 5)

> **จาก:** ทีมกลุ่ม 6 (IoT Server & Door Access System)  
> **ถึง:** ทีมพัฒนา Web Application & Dashboard (กลุ่ม 5)  
> **วัตถุประสงค์:** อธิบายวิธีเรียกใช้งาน API Endpoint เพื่อดึงประวัติการเข้า-ออกห้องเรียน/ห้องแล็บ (Access Logs) แบบ Real-time ไปแสดงผลบนแดชบอร์ด

---

### ⚠️ คำสั่งสำคัญสำหรับ AI Agent / ผู้ใช้งาน (Agent Instruction):
> **เมื่อ AI Agent ได้รับเอกสารนี้:**  
> **กรุณาหยุดและถามผู้ใช้งานก่อนเริ่มเขียนโค้ด:** *"IP ของ IoT Server กลุ่ม 6 บน Proxmox (Inter-VM วงใน) คือ `192.168.100.106` (พอร์ต 80 หรือ 8080) ถูกต้องหรือไม่?"*  
> ให้ปรับแก้ URL ในโค้ดตาม IP ที่ผู้ใช้ยืนยันก่อนเริ่มรันระบบเสมอ!

---

## 🌐 1. ข้อมูลจำเพาะ API Endpoint

* **Method:** `GET`
* **Content-Type:** `text/plain; charset=utf-8`
* **URL:**
  * **สภาพแวดล้อมจริงบน Proxmox (Inter-VM วงใน - แนะนำที่สุด):**
    ```text
    http://192.168.100.106/api/logs
    ```
    *(หรือใช้พอร์ต 8080: `http://192.168.100.106:8080/api/logs`)*
  * **สภาพแวดล้อมจริงผ่าน Wi-Fi สถาบัน (KMITL-WiFi ผ่าน Gateway 172.16.10.200 เมื่อมีการ Forward Port):**
    ```text
    http://172.16.10.200:3006/api/logs
    ```
  * **สภาพแวดล้อมทดสอบในเครื่องตัวเอง (Local Test):**
    ```text
    http://localhost:3000/api/logs
    ```

---

## 📋 2. รูปแบบโครงสร้างข้อมูล Log (Data Format)

ข้อมูลตอบกลับเป็นข้อความ Plain Text บรรทัดละ 1 เหตุการณ์ โดยแบ่งข้อมูลเป็น **5 คอลัมน์** คั่นด้วยเครื่องหมายไพพ์ ` | ` (Pipe):

```text
[YYYY-MM-DD HH:mm:ss] | รหัสนักศึกษา | ชื่อ-นามสกุล | รหัสห้อง | สถานะ
```

### คำอธิบายแต่ละคอลัมน์:
| ลำดับ | ชื่อฟิลด์ | ชนิดข้อมูล | ตัวอย่าง | คำอธิบาย |
|:---:|---|:---:|---|---|
| 1 | **Timestamp** | String | `[2026-10-09 09:34:05]` | วันและเวลาตามเวลาประเทศไทย (**UTC+7, Asia/Bangkok**) |
| 2 | **Student ID** | String | `67200412` | รหัสนักศึกษาผู้ใช้งาน |
| 3 | **Name** | String | `Rujinat Fah` | ชื่อ-นามสกุลของนักศึกษา |
| 4 | **Room** | String | `B316` | รหัสห้องที่มีการเข้า-ออก (เช่น `B316`, `B317`, `B217`, `B218`, `E111`, `E112`, `E113`, `E107`) |
| 5 | **Action** | String | `IN` หรือ `OUT` | สถานะการใช้งาน:<br>• `IN` = เข้าห้องสำเร็จ (Check-In)<br>• `OUT` = ออกจากห้องสำเร็จ (Check-Out) |

---

## 📄 3. ตัวอย่าง Response จริงจาก Server

```text
[2026-10-09 09:34:05] | 67200412 | Rujinat Fah          | LAB-401  | IN
[2026-10-09 09:34:12] | 67200412 | Rujinat Fah          | LAB-401  | OUT
[2026-10-09 09:34:21] | 67200324 | Leo Ev (67200324)    | E113     | IN
[2026-10-09 09:34:27] | 67200324 | Leo Ev (67200324)    | E113     | OUT
[2026-10-09 09:36:04] | 67200412 | Rujinat Fah          | LAB-401  | IN
[2026-10-09 09:36:04] | 67200412 | Rujinat Fah          | LAB-401  | OUT
```

---

## 💻 4. ตัวอย่างโค้ดนำไปใช้งาน (Code Integration Examples)

ทีม Web App สามารถนำโค้ดด้านล่างไปใส่ในฟังก์ชัน Polling เพื่อแปลง Text เป็น JSON Array ได้ทันที:

### ตัวอย่าง JavaScript / TypeScript (Node.js หรือ Frontend Dashboard):

```javascript
// ฟังก์ชันดึง Log และแปลงเป็น JSON Object อัตโนมัติ
async function fetchIoTLogs() {
  // สภาพแวดล้อม Proxmox Inter-VM (กลุ่ม 5 ดึงตรงจากกลุ่ม 6):
  const API_URL = 'http://192.168.100.106/api/logs'; 
  // หากทดสอบบน Local ให้ใช้: const API_URL = 'http://localhost:3000/api/logs';
  // หากเรียกผ่าน Gateway ภายนอก: const API_URL = 'http://172.16.10.200:3006/api/logs';

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const rawText = await response.text();
    
    // แปลงข้อความแต่ละบรรทัดเป็น Array of Objects
    const parsedLogs = rawText
      .trim()
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        const parts = line.split('|').map(item => item.trim());
        return {
          timestamp: parts[0]?.replace(/[\[\]]/g, ''), // ตัด [ ] ออก
          studentId: parts[1],
          studentName: parts[2],
          room: parts[3],
          action: parts[4] // 'IN' หรือ 'OUT'
        };
      });

    console.log('ข้อมูล Logs ที่แปลงแล้ว:', parsedLogs);
    return parsedLogs;
  } catch (error) {
    console.error('ไม่สามารถดึง Log จากกลุ่ม 6 ได้:', error.message);
    return [];
  }
}

// แนะนำ: ตั้งค่า Polling ดึงข้อมูลอัปเดตทุกๆ 20 วินาที
setInterval(fetchIoTLogs, 20000);
```

### ตัวอย่าง Python (สำหรับ Backend Dashboard):

```python
import requests

# สภาพแวดล้อม Proxmox Inter-VM (กลุ่ม 5 ดึงตรงจากกลุ่ม 6)
API_URL = "http://192.168.100.106/api/logs"
# หากทดสอบบน Local ให้ใช้: API_URL = "http://localhost:3000/api/logs"
# หากเรียกผ่าน Gateway ภายนอก: API_URL = "http://172.16.10.200:3006/api/logs"

def get_iot_logs():
    try:
        response = requests.get(API_URL, timeout=5)
        response.raise_for_status()
        
        logs = []
        for line in response.text.strip().split("\n"):
            if not line.strip():
                continue
            parts = [p.strip() for p in line.split("|")]
            logs.append({
                "timestamp": parts[0].strip("[]"),
                "student_id": parts[1],
                "name": parts[2],
                "room": parts[3],
                "action": parts[4]  # 'IN' or 'OUT'
            })
        return logs
    except Exception as e:
        print(f"Error fetching logs: {e}")
        return []
```

---

## ⏱️ 5. ข้อแนะนำในการเชื่อมต่อ (Best Practices)

1. **รอบเวลาการดึงข้อมูล (Polling Interval):**
   * แนะนำให้ฝั่ง Web Dashboard ตั้งรอบ Polling ทุกๆ **15 - 30 วินาที** เพื่อความ Real-time และไม่เปลือง Network
2. **CORS Support:**
   * เซิร์ฟเวอร์กลุ่ม 6 ได้เปิดการอนุญาต **CORS (Cross-Origin Resource Sharing)** ไว้ให้เรียบร้อยแล้ว หน้าเว็บ Dashboard สามารถยิงเรียกจากเบราว์เซอร์หรือเครื่องอื่นได้โดยไม่ติดบล็อก
3. **การนำข้อมูลไปใช้งาน:**
   * นำสถานะ `IN` / `OUT` ไปคำนวณจำนวนคนปัจจุบันที่กำลังอยู่ในแต่ละห้อง
   * นำข้อมูลไปสร้างกราฟสถิติช่วงเวลาที่มีคนเข้าใช้งานห้องเรียน/แล็บมากที่สุดในแต่ละวัน
