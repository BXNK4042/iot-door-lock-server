/**
 * MQTT Service - จัดการส่งคำสั่งปลดล็อคกลอนประตู
 * 
 * ⚠️ สภาพปัจจุบัน: ตัดการเชื่อมต่อ MQTT จริงออกไปก่อนตามข้อกำหนด
 * เนื่องจากยังไม่เชื่อมต่อกับ Hardware ESP32 แต่ทำระบบและโครงสร้างรองรับไว้พร้อม 100%
 */

// ตั้งค่าสถานะ: false = โหมดจำลอง (Simulation Mode) ไม่พยายามเชื่อมต่อ Broker ให้เปลืองทรัพยากร
// เมื่อถึงเวลาเชื่อมต่อฮาร์ดแวร์จริงในอนาคต เพียงเปลี่ยนค่านี้เป็น true
const ENABLE_MQTT_CONNECTION = process.env.ENABLE_MQTT === 'true' || false;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';

let mqttClient = null;
let isConnected = false;

if (ENABLE_MQTT_CONNECTION) {
    try {
        const mqtt = require('mqtt');
        mqttClient = mqtt.connect(MQTT_BROKER_URL, {
            reconnectPeriod: 5000,
            connectTimeout: 3000
        });

        mqttClient.on('connect', () => {
            isConnected = true;
            console.log(`[MQTT] เชื่อมต่อ MQTT Broker สำเร็จที่ ${MQTT_BROKER_URL}`);
        });

        mqttClient.on('error', (err) => {
            console.log(`[MQTT WARNING] แจ้งเตือน: ${err.message}`);
        });
    } catch (e) {
        console.log('[MQTT] ไม่สามารถโหลดไลบรารี MQTT ได้ ใช้งานโหมดจำลอง');
    }
} else {
    console.log('[MQTT SERVICE] ⚠️ ทำงานในโหมดจำลอง (Hardware Offline Mode): ไม่เชื่อมต่อ Broker แต่สร้างคำสั่งปลดล็อคเสมือนรองรับไว้');
}

/**
 * ฟังก์ชันสั่งปลดล็อคกลอนประตูห้อง (ทำงานได้ทั้งโหมดจำลองและโหมดต่อจริง)
 */
function sendDoorUnlockCommand(roomId, duration = 5, reason = 'CHECK_IN') {
    const topic = `iot/door/${roomId}/command`;
    const payload = JSON.stringify({
        action: 'UNLOCK',
        room: roomId,
        durationSeconds: duration,
        reason: reason,
        timestamp: new Date().toISOString()
    });

    if (ENABLE_MQTT_CONNECTION && mqttClient && isConnected) {
        mqttClient.publish(topic, payload, { qos: 1 });
        console.log(`[MQTT HARDWARE] ส่งสัญญาณปลดล็อคไปยัง ESP32 หน้าห้อง ${roomId} สำเร็จ!`);
    } else {
        // โหมดจำลอง (Default ณ ตอนนี้):
        console.log('------------------------------------------------------------');
        console.log(`🟢 [DOOR SIMULATOR] สั่งปลดล็อคกลอนประตูห้อง: ${roomId}`);
        console.log(`⏱️ ระยะเวลาเปิด: ${duration} วินาที | เหตุผล: ${reason}`);
        console.log(`📡 MQTT Topic (จำลอง): ${topic}`);
        console.log(`📦 Payload: ${payload}`);
        console.log('------------------------------------------------------------');
    }

    return {
        success: true,
        topic: topic,
        payload: payload,
        mode: ENABLE_MQTT_CONNECTION ? 'REAL_MQTT' : 'SIMULATION'
    };
}

module.exports = {
    sendDoorUnlockCommand
};
