/**
 * 🔒 Production Auth Service - ตรวจสอบตัวตนผู้ใช้ผ่าน RADIUS Server (Group 1)
 * และรองรับการเชื่อมต่อกับกลุ่มพันธมิตรบน Proxmox VE (vmbr1)
 * 
 * โปรโตคอลหลัก: RADIUS (RFC 2865 - Access-Request via UDP Port 1812)
 * โปรโตคอลสำรอง: HTTP/REST Auth API
 */

const dgram = require('dgram');
const path = require('path');
const fs = require('fs');

// โหลดไลบรารี RADIUS
let radius = null;
try {
    radius = require('radius');
} catch (e) {
    console.warn('[AUTH] คำเตือน: ไม่พบโมดูล radius จะใช้งานโหมด UDP/REST สำรอง');
}

// การตั้งค่าสำหรับการเชื่อมต่อกลุ่ม 1 (RADIUS Server)
const RADIUS_HOST = process.env.RADIUS_HOST || '10.10.10.11';
const RADIUS_PORT = parseInt(process.env.RADIUS_PORT || '1812', 10);
const RADIUS_SECRET = process.env.RADIUS_SECRET || 'testing123';
const NAS_IP = process.env.NAS_IP || '10.10.10.16'; // IP ของ VM กลุ่ม 6 บน Proxmox
const AUTH_TIMEOUT_MS = parseInt(process.env.AUTH_TIMEOUT_MS || '3000', 10);

// การตั้งค่าสำหรับการเชื่อมต่อผ่าน REST API (ถ้ากลุ่ม 1 หรือกลุ่ม 4 ให้บริการ HTTP)
const AUTH_API_URL = process.env.AUTH_API_URL || 'http://10.10.10.11:4000/api/auth/login';

// โหมดการทำงาน: 'PRODUCTION' (ค่าเริ่มต้นใช้งานจริง) หรือ 'MOCK' (สำหรับทดสอบออฟไลน์)
const AUTH_MODE = process.env.AUTH_MODE || 'PRODUCTION';

// ไฟล์สำรองข้อมูลจำลอง (เฉพาะกรณีเปิด AUTH_MODE=MOCK ออฟไลน์)
const BACKUP_MOCK_PATH = path.join(__dirname, '..', 'mock-data-backup', 'users.json');

/**
 * 1. ฟังก์ชันยืนยันตัวตนผ่าน RADIUS Server (กลุ่ม 1) โดยตรงผ่าน UDP 1812
 */
function authenticateViaRadius(studentId, password) {
    return new Promise((resolve) => {
        if (!radius) {
            return resolve({ isValid: false, message: 'โมดูล RADIUS ยังไม่พร้อมใช้งาน' });
        }

        const client = dgram.createSocket('udp4');
        let isResolved = false;

        const timer = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                try { client.close(); } catch (_) {}
                console.warn(`[RADIUS TIMEOUT] หมดเวลาเชื่อมต่อ RADIUS Server (${RADIUS_HOST}:${RADIUS_PORT})`);
                resolve({ isValid: false, message: 'เซิร์ฟเวอร์ RADIUS ไม่ตอบสนอง (Timeout)' });
            }
        }, AUTH_TIMEOUT_MS);

        try {
            const packet = radius.encode({
                code: 'Access-Request',
                secret: RADIUS_SECRET,
                attributes: [
                    ['User-Name', String(studentId)],
                    ['User-Password', String(password)],
                    ['NAS-IP-Address', NAS_IP]
                ]
            });

            client.on('message', (msg) => {
                if (isResolved) return;
                isResolved = true;
                clearTimeout(timer);
                try { client.close(); } catch (_) {}

                try {
                    const response = radius.decode({ packet: msg, secret: RADIUS_SECRET });
                    console.log(`[RADIUS RESPONSE] ได้รับผลลัพธ์: ${response.code} สำหรับผู้ใช้: ${studentId}`);

                    if (response.code === 'Access-Accept') {
                        // ดึงชื่อนักศึกษาจาก Attribute ถ้ามี
                        let studentName = `นศ. ${studentId}`;
                        if (response.attributes && response.attributes['Reply-Message']) {
                            studentName = String(response.attributes['Reply-Message']);
                        }
                        resolve({
                            isValid: true,
                            studentId: String(studentId),
                            studentName: studentName,
                            source: 'RADIUS_SERVER_GROUP_1'
                        });
                    } else {
                        resolve({
                            isValid: false,
                            message: 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง (ปฏิเสธโดย RADIUS)'
                        });
                    }
                } catch (decodeErr) {
                    console.error('[RADIUS ERROR] ถอดรหัส Packet ไม่สำเร็จ:', decodeErr.message);
                    resolve({ isValid: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ RADIUS' });
                }
            });

            client.on('error', (err) => {
                if (isResolved) return;
                isResolved = true;
                clearTimeout(timer);
                try { client.close(); } catch (_) {}
                console.error('[RADIUS SOCKET ERROR]:', err.message);
                resolve({ isValid: false, message: 'ไม่สามารถส่งข้อมูลไปยัง RADIUS Server ได้' });
            });

            client.send(packet, 0, packet.length, RADIUS_PORT, RADIUS_HOST, (err) => {
                if (err && !isResolved) {
                    isResolved = true;
                    clearTimeout(timer);
                    try { client.close(); } catch (_) {}
                    console.error('[RADIUS SEND ERROR]:', err.message);
                    resolve({ isValid: false, message: 'ไม่สามารถส่ง Packet ไปยัง RADIUS ได้' });
                }
            });

        } catch (encodeErr) {
            clearTimeout(timer);
            try { client.close(); } catch (_) {}
            console.error('[RADIUS ENCODE ERROR]:', encodeErr.message);
            resolve({ isValid: false, message: 'ไม่สามารถสร้าง RADIUS Packet ได้' });
        }
    });
}

/**
 * 2. ฟังก์ชันยืนยันตัวตนผ่าน REST Auth API สำรอง (ถ้ากลุ่ม 1 เปิดเป็น HTTP Webhook)
 */
async function authenticateViaRestApi(studentId, password) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

        const response = await fetch(AUTH_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, password }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return {
                isValid: true,
                studentId: String(studentId),
                studentName: data.name || data.studentName || `นศ. ${studentId}`,
                source: 'CENTRAL_AUTH_API'
            };
        } else {
            return { isValid: false, message: 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง' };
        }
    } catch (err) {
        return { isValid: false, message: `ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ตรวจสอบสิทธิ์ (${err.message})` };
    }
}

/**
 * 3. ฟังก์ชันหลักสำหรับตรวจสอบสิทธิ์ (Export ให้ doorController ใช้งาน)
 */
async function verifyCredentials(studentId, password) {
    console.log(`[AUTH] ตรวจสอบสิทธิ์ผู้ใช้: ${studentId} (โหมด: ${AUTH_MODE})`);

    // 🔹 โหมดใช้งานจริง (Production: ยิงตรวจสอบกับ RADIUS Server กลุ่ม 1)
    if (AUTH_MODE !== 'MOCK') {
        // ขั้นแรก: ลองยืนยันตัวตนผ่าน RADIUS Protocol (UDP 1812)
        if (radius) {
            const radiusResult = await authenticateViaRadius(studentId, password);
            if (radiusResult.isValid) return radiusResult;

            // ถ้า RADIUS ปฏิเสธ (Access-Reject) ให้คืนค่าไม่ผ่านทันที
            if (radiusResult.message && radiusResult.message.includes('ปฏิเสธ')) {
                return radiusResult;
            }
        }

        // ขั้นที่สอง: ถ้าระบบ RADIUS UDP ขัดข้อง ให้ลองเชื่อมต่อผ่าน REST API
        if (AUTH_API_URL) {
            console.log(`[AUTH] พยายามเชื่อมต่อผ่าน REST API สำรอง: ${AUTH_API_URL}`);
            const apiResult = await authenticateViaRestApi(studentId, password);
            if (apiResult.isValid) return apiResult;
        }

        return {
            isValid: false,
            message: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ RADIUS/Authentication กลางได้ กรุณาลองใหม่อีกครั้ง'
        };
    }

    // 🔹 โหมดจำลองฉุกเฉิน (เฉพาะเมื่อตั้งใจเปิด AUTH_MODE=MOCK ออฟไลน์)
    try {
        if (fs.existsSync(BACKUP_MOCK_PATH)) {
            const raw = fs.readFileSync(BACKUP_MOCK_PATH, 'utf8');
            const db = JSON.parse(raw);
            const user = db.users ? db.users[String(studentId)] : null;
            if (user && user.password === password) {
                return {
                    isValid: true,
                    studentId: user.studentId,
                    studentName: user.name,
                    source: 'BACKUP_MOCK_DATABASE'
                };
            }
        }
    } catch (e) {}

    return { isValid: false, message: 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง' };
}

module.exports = {
    verifyCredentials,
    authenticateViaRadius,
    authenticateViaRestApi
};
