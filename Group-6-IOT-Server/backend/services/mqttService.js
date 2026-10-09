/**
 * 📡 MQTT Service - เชื่อมต่อ MQTT Broker และส่งคำสั่งปลดล็อคกลอนประตูไปยัง ESP32 (กลุ่ม 7)
 * 
 * พร้อมเชื่อมต่อกับ MQTT Broker จริงบน Proxmox (vmbr1) หรือ Local Broker
 * มีระบบ Fail-safe ป้องกันเซิร์ฟเวอร์หยุดทำงานกรณี Broker ยังไม่เปิดใช้งาน
 */

// เปิดใช้งานการเชื่อมต่อ MQTT เป็นค่าเริ่มต้น (ตั้ง ENABLE_MQTT=false หากต้องการปิด)
const ENABLE_MQTT_CONNECTION = process.env.ENABLE_MQTT !== 'false';

// URL ของ MQTT Broker บน Proxmox หรือในระบบ
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://10.10.10.17:1883';

let mqttClient = null;
let isConnected = false;

if (ENABLE_MQTT_CONNECTION) {
    try {
        const mqtt = require('mqtt');
        console.log(`[MQTT] กำลังเชื่อมต่อ MQTT Broker ที่: ${MQTT_BROKER_URL}`);
        
        mqttClient = mqtt.connect(MQTT_BROKER_URL, {
            reconnectPeriod: 5000,
            connectTimeout: 4000,
            clientId: `iot_door_server_${Math.random().toString(16).substring(2, 8)}`
        });

        mqttClient.on('connect', () => {
            isConnected = true;
            console.log(`[MQTT] ✅ เชื่อมต่อ MQTT Broker สำเร็จที่ ${MQTT_BROKER_URL}`);
        });

        mqttClient.on('error', (err) => {
            console.warn(`[MQTT NOTICE] สถานะการเชื่อมต่อ: ${err.message} (กำลังพยายามเชื่อมต่อใหม่...)`);
        });

        mqttClient.on('offline', () => {
            isConnected = false;
        });

        mqttClient.on('reconnect', () => {
            console.log('[MQTT] กำลังพยายามเชื่อมต่อ Broker ใหม่อัตโนมัติ...');
        });

    } catch (e) {
        console.warn('[MQTT WARNING] ไม่สามารถเริ่มตัวเชื่อมต่อ MQTT ได้:', e.message);
    }
} else {
    console.log('[MQTT] ⚠️ โหมดออฟไลน์: ปิดการเชื่อมต่อ Broker ตามการตั้งค่า ENABLE_MQTT=false');
}

/**
 * ฟังก์ชันสั่งปลดล็อคกลอนประตูห้องไปยัง ESP32
 * @param {string} roomId รหัสห้อง เช่น 'B316', 'B317'
 * @param {number} duration ระยะเวลาเปิด (วินาที) ปกติ 5 วินาที
 * @param {string} reason เหตุผล เช่น 'CHECK_IN', 'CHECK_OUT'
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
        try {
            mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
                if (err) {
                    console.error(`[MQTT ERROR] ไม่สามารถส่งคำสั่งไปยัง ${topic}:`, err.message);
                } else {
                    console.log(`[MQTT HARDWARE] 🚀 ส่งสัญญาณปลดล็อคไปยัง ESP32 หน้าห้อง ${roomId} สำเร็จ! (Topic: ${topic})`);
                }
            });
        } catch (publishErr) {
            console.error('[MQTT PUBLISH ERROR]:', publishErr.message);
        }
    } else {
        // บันทึกคำสั่งกรณี Broker ยังไม่พร้อม (Fail-safe Simulation)
        console.log('------------------------------------------------------------');
        console.log(`🟢 [DOOR COMMAND] สั่งปลดล็อคกลอนประตูห้อง: ${roomId}`);
        console.log(`⏱️ ระยะเวลาเปิด: ${duration} วินาที | เหตุผล: ${reason}`);
        console.log(`📡 MQTT Topic: ${topic}`);
        console.log(`📦 Payload: ${payload}`);
        console.log(`⚡ สถานะ Broker: ${isConnected ? 'ONLINE' : 'OFFLINE (รอเชื่อมต่อ)'}`);
        console.log('------------------------------------------------------------');
    }

    return {
        success: true,
        topic: topic,
        payload: payload,
        isMqttConnected: isConnected
    };
}

module.exports = {
    sendDoorUnlockCommand,
    isMqttConnected: () => isConnected
};
