/**
 * Auth Service - ตรวจสอบตัวตนผู้ใช้
 * ในสถานะการพัฒนาปัจจุบัน: จำลองฐานข้อมูล RADIUS/MySQL จาก backend/mock-data/users.json
 * ข้อมูลที่รองรับ: user: 67200412 | pass: rujinat_fah (เพียงคนเดียวเท่านั้น)
 */

const fs = require('fs');
const path = require('path');

// เส้นทางไฟล์ฐานข้อมูลจำลอง
const MOCK_DB_PATH = path.join(__dirname, '..', 'mock-data', 'users.json');

// URL สำหรับการเชื่อมต่อจริงในอนาคต (เมื่อขึ้น Production บน Proxmox vmbr1)
const PRODUCTION_AUTH_API_URL = process.env.AUTH_API_URL || 'http://10.10.10.13:4000/api/auth/login';

// โหมดการทำงาน: 'MOCK_DEMO' (ปัจจุบัน) หรือ 'PRODUCTION_API' (เมื่อขึ้นจริง)
const AUTH_MODE = process.env.AUTH_MODE || 'MOCK_DEMO';

async function verifyCredentials(studentId, password) {
    console.log(`[AUTH] ตรวจสอบสิทธิ์ผู้ใช้: ${studentId} (โหมด: ${AUTH_MODE})`);

    // 1. โหมดใช้งานจริง (Production: เมื่อเชื่อมต่อกับกลุ่ม 3 / RADIUS)
    if (AUTH_MODE === 'PRODUCTION_API') {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(PRODUCTION_AUTH_API_URL, {
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
                    studentId: studentId,
                    studentName: data.name || data.studentName || 'Student Verified',
                    source: 'REAL_RADIUS_API'
                };
            } else {
                return { isValid: false, message: 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง (จาก RADIUS กลาง)' };
            }
        } catch (err) {
            console.error(`[AUTH ERROR] ไม่สามารถเชื่อมต่อกับ RADIUS/Auth API ได้:`, err.message);
            return { isValid: false, message: 'เซิร์ฟเวอร์ตรวจสอบสิทธิ์ขัดข้อง กรุณาลองใหม่' };
        }
    }

    // 2. โหมดจำลอง Demo (ปัจจุบัน): ตรวจสอบจาก backend/mock-data/users.json
    try {
        if (!fs.existsSync(MOCK_DB_PATH)) {
            return { isValid: false, message: 'ไม่พบไฟล์ฐานข้อมูลจำลอง users.json' };
        }

        const rawData = fs.readFileSync(MOCK_DB_PATH, 'utf8');
        const db = JSON.parse(rawData);
        const user = db.users ? db.users[String(studentId)] : null;

        if (!user) {
            return {
                isValid: false,
                message: `ไม่พบรหัสนักศึกษา ${studentId} ในฐานข้อมูล RADIUS จำลอง (ระบบเปิดให้เฉพาะ 67200412 ทดสอบ)`
            };
        }

        if (user.password !== password) {
            return {
                isValid: false,
                message: 'รหัสผ่านไม่ถูกต้อง'
            };
        }

        // ยืนยันผ่านสำเร็จ
        return {
            isValid: true,
            studentId: user.studentId,
            studentName: user.name,
            source: 'DEMO_RADIUS_DATABASE'
        };

    } catch (err) {
        console.error('[AUTH ERROR] เกิดข้อผิดพลาดในการอ่านไฟล์จำลอง:', err);
        return { isValid: false, message: 'ระบบอ่านข้อมูลจำลองผิดพลาด' };
    }
}

module.exports = {
    verifyCredentials
};
