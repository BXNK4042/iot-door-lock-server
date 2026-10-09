# 📡 คู่มือและข้อกำหนดการเชื่อมต่อ MQTT สำหรับระบบปลดล็อกประตู
### ข้อตกลงการเชื่อมต่อระหว่าง กลุ่ม 6 (IoT Server) ➔ กลุ่ม 7 (Door Unlock Device / ESP32)

> **จาก:** ทีมกลุ่ม 6 (IoT Server & Door Management)  
> **ถึง:** ทีมกลุ่ม 7 (Hardware Controller & Door Unlock Device)  
> **วัตถุประสงค์:** กำหนดหัวข้อ MQTT Topic, โครงสร้างข้อมูล JSON Payload และข้อกำหนดการทำงานของฮาร์ดแวร์ ESP32 ในการรับคำสั่งสั่งปลดล็อกกลอนประตูไฟฟ้า

---

## 🌐 1. ข้อมูลการเชื่อมต่อ MQTT Broker

* **Protocol:** `MQTT` (TCP / Port `1883`)
* **Broker Host / IP:**
  * **สภาพแวดล้อมทดสอบ Local:** `127.0.0.1:1883`
  * **สภาพแวดล้อมจริงบน Proxmox (`vmbr1`):** `10.10.10.17:1883` *(หรือ IP Broker ที่ตกลงกัน)*
* **Client ID แนะนำของ ESP32:** `esp32_door_{roomId}` *(เช่น `esp32_door_B316`)*
* **QoS Level:** `1` (At least once delivery)
* **Keep Alive:** `60` วินาที

---

## 📬 2. โครงสร้าง Topic สำหรับสั่งการ (Command Topic)

เมื่อมีนักศึกษาสแกนและยืนยันตัวตนสำเร็จผ่านหน้าเว็บ เซิร์ฟเวอร์กลุ่ม 6 จะ Publish คำสั่งไปยัง Topic ของห้องนั้นๆ:

```text
iot/door/{roomId}/command
```

### รายการห้องที่รองรับในระบบ (8 ห้อง):
* `iot/door/B316/command` *(ห้องหลัก)*
* `iot/door/B317/command`
* `iot/door/B217/command`
* `iot/door/B218/command`
* `iot/door/E111/command`
* `iot/door/E112/command`
* `iot/door/E113/command`
* `iot/door/E107/command`

> **หมายเหตุ:** ESP32 ประจำแต่ละห้อง ให้ทำการ `subscribe` เฉพาะ Topic ห้องของตนเอง เช่น บอร์ดหน้าห้อง B316 ให้ subscribe `iot/door/B316/command`

---

## 📦 3. รูปแบบข้อมูล JSON Payload ที่ส่งจากกลุ่ม 6

ข้อมูลจะถูกส่งในรูปแบบ JSON Object:

```json
{
  "action": "UNLOCK",
  "room": "B316",
  "durationSeconds": 5,
  "reason": "CHECK_IN",
  "timestamp": "2026-10-09T08:30:00.000Z"
}
```

### คำอธิบายฟิลด์ข้อมูล:
| ฟิลด์ | ชนิดข้อมูล | ตัวอย่าง | คำอธิบาย |
|---|:---:|---|---|
| `action` | String | `"UNLOCK"` | คำสั่งการทำงาน (ปัจจุบันคือคำสั่งปลดล็อก) |
| `room` | String | `"B316"` | รหัสห้องที่ต้องปลดล็อก |
| `durationSeconds` | Integer | `5` | ระยะเวลาที่ต้องจ่ายไฟปลดล็อกกลอน (ปกติ 5 วินาที) |
| `reason` | String | `"CHECK_IN"` หรือ `"CHECK_OUT"` | เหตุผลการปลดล็อก (เข้าห้อง หรือ ออกจากห้อง) |
| `timestamp` | String | `"2026-10-09T08:30:00.000Z"` | เวลาที่ส่งคำสั่งในรูปแบบ ISO 8601 |

---

## ⚙️ 4. พฤติกรรมที่บอร์ด ESP32 (กลุ่ม 7) ต้องตอบสนอง

1. เมื่อได้รับ Message ที่มี `"action": "UNLOCK"`:
   * **สั่ง Relay ทำงาน (Active):** จ่ายไฟ 12V ให้ Solenoid Lock / Magnetic Lock คลายกลอน
   * **สัญญาณแสดงผล (Indicators):**
     * เปิดไฟ LED สีเขียว
     * ส่งเสียง Buzzer สั้น 1 ครั้ง (Beep!)
   * **หน่วงเวลา:** ค้างสถานะปลดล็อกไว้ตามจำนวนวินาทีใน `durationSeconds` (ปกติ 5 วินาที)
   * **ตัดไฟ Relay (Deactivate):** ล็อกกลอนประตูกลับสู่สภาวะปกติ ดับไฟ LED สีเขียว

---

## 💻 5. ตัวอย่างโค้ด Arduino C++ สำหรับ ESP32 (PubSubClient)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// กำหนดพินฮาร์ดแวร์
const int RELAY_PIN  = 23; // พินควบคุม Relay กลอนประตู
const int LED_PIN    = 2;  // LED สีเขียวแสดงสถานะ
const int BUZZER_PIN = 4;  // Buzzer

// ตั้งค่าห้องประจำบอร์ดนี้
const char* ROOM_ID = "B316";

// ตั้งค่าเครือข่ายและ MQTT Broker
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASS";
const char* mqtt_server = "10.10.10.17"; // IP ของ Broker บน Proxmox
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

// ฟังก์ชัน Callback เมื่อได้รับคำสั่งจากกลุ่ม 6
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println("[MQTT] ได้รับคำสั่ง: " + message);

  // Parse ข้อมูล JSON
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) return;

  const char* action = doc["action"];
  int duration = doc["durationSeconds"] | 5;

  if (String(action) == "UNLOCK") {
    Serial.printf("🔓 ปลดล็อกประตูห้อง %s เป็นเวลา %d วินาที\n", ROOM_ID, duration);
    
    // สั่ง Relay ปลดล็อก + สัญญาณไฟ/เสียง
    digitalWrite(RELAY_PIN, HIGH);
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);

    // เปิดค้างไว้ตามเวลาที่กลุ่ม 6 กำหนด
    delay((duration * 1000) - 200);

    // ล็อกประตูกลับ
    digitalWrite(RELAY_PIN, LOW);
    digitalWrite(LED_PIN, LOW);
    Serial.println("🔒 ล็อกประตูกลับเรียบร้อย");
  }
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "ESP32_Door_" + String(ROOM_ID);
    if (client.connect(clientId.c_str())) {
      // Subscribe Topic ประจำห้อง
      String subTopic = "iot/door/" + String(ROOM_ID) + "/command";
      client.subscribe(subTopic.c_str(), 1);
      Serial.println("เชื่อมต่อ MQTT สำเร็จ! Subscribed: " + subTopic);
    } else {
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();
}
```

---
*จัดทำขึ้นโดยทีมวิศวกร กลุ่มที่ 6 เพื่อให้การเชื่อมต่อระหว่าง IoT Server และ Hardware ESP32 เป็นไปอย่างราบรื่น 100%*
