/**
 * Door Controller - ศูนย์กลางตรรกะการควบคุมประตูและ State Machine ของกลุ่ม 6
 * รองรับ: Auto Check-In V2, Live Stopwatch Timer, Check-Out, และ Smart Timestamp Comparison
 */

const authService = require('../services/authService');
const stateService = require('../services/stateService');
const loggerService = require('../services/loggerService');
const mqttService = require('../services/mqttService');

/**
 * 1. ฟังก์ชันรับการสแกน QR Code แล้ว Login (Auto Check-In)
 * POST /api/door/access
 */
async function handleDoorAccess(req, res) {
    try {
        const { studentId, password, targetRoom } = req.body;

        if (!studentId || !password || !targetRoom) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกข้อมูลให้ครบถ้วน: รหัสนักศึกษา, รหัสผ่าน และรหัสห้อง'
            });
        }

        // 1. ตรวจสอบสิทธิ์ผ่าน Auth Service (กลุ่ม 3 หรือ Mock)
        const authResult = await authService.verifyCredentials(studentId, password);
        if (!authResult.isValid) {
            return res.status(401).json({
                success: false,
                message: authResult.message || 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง'
            });
        }

        const studentName = authResult.studentName;
        const currentTime = new Date();

        // 2. ตรวจสอบ State ประวัติการเข้าห้องปัจจุบัน
        const previousSession = stateService.getUserSession(studentId);

        if (previousSession) {
            // ไม่ว่าจะเข้าห้องเดิมหรือห้องใหม่ เมื่อมีการล็อกอินใหม่ ให้ตัดจบ Session เดิมเป็น OUT ทันที
            console.log(`[SESSION-RESET] ตรวจพบผู้ใช้ ${studentId} ล็อกอินเข้าห้อง ${targetRoom} (เดิมอยู่ห้อง ${previousSession.room}) ➔ ตัดจบ Session เดิมเป็น OUT`);
            
            // บันทึก Log ออกจากห้องเดิมเป็นสถานะ OUT
            loggerService.writeLog(studentId, studentName, previousSession.room, 'OUT');
            
            // ล้าง session เก่า
            stateService.removeUserSession(studentId);
        }

        // 3. ทำการ Auto Check-In เข้าห้องใหม่ทันที
        const newSession = stateService.setUserCheckIn(studentId, studentName, targetRoom, currentTime);

        // 4. บันทึกประวัติเข้าห้องใหม่ลง logs/log.txt
        loggerService.writeLog(studentId, studentName, targetRoom, 'IN');

        // 5. ส่งคำสั่ง MQTT ไปสั่งฮาร์ดแวร์ปลดล็อคกลอนประตูห้องใหม่ 5 วินาที
        mqttService.sendDoorUnlockCommand(targetRoom, 5, 'CHECK_IN');

        // 6. ตอบกลับข้อมูลให้ฝั่งหน้าบ้านเปลี่ยนเป็นหน้า Dashboard ต้อนรับ
        return res.json({
            success: true,
            status: 'CHECKED_IN',
            message: `ขอต้อนรับเข้าสู่ห้อง ${targetRoom}`,
            room: targetRoom,
            studentId: studentId,
            studentName: studentName,
            enteredAt: currentTime.toISOString(),
            serverTime: currentTime.toISOString()
        });

    } catch (error) {
        console.error('[CONTROLLER ERROR] เกิดข้อผิดพลาดใน handleDoorAccess:', error);
        return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์'
        });
    }
}

/**
 * 2. ฟังก์ชันกดปุ่มออกจากห้อง (Check-Out)
 * POST /api/door/checkout
 */
async function handleDoorCheckout(req, res) {
    try {
        const { studentId, room } = req.body;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสนักศึกษา'
            });
        }

        const session = stateService.getUserSession(studentId);
        if (!session) {
            return res.status(400).json({
                success: false,
                status: 'NO_SESSION',
                message: 'ไม่พบประวัติการเข้าใช้งานห้องของคุณ หรือคุณได้ออกจากห้องไปแล้ว'
            });
        }

        // ⚠️ ป้องกันข้อผิดพลาด: ตรวจสอบว่าห้องที่ขอกดออก ตรงกับห้องที่กำลังอยู่จริงหรือไม่!
        if (room && session.room !== room) {
            console.log(`[CHECKOUT BLOCKED] ปฏิเสธคำขอกดออกจากห้อง ${room} เพราะผู้ใช้ ${studentId} อยู่ที่ห้อง ${session.room} แล้ว`);
            return res.status(400).json({
                success: false,
                status: 'ROOM_MISMATCH',
                message: `คุณไม่ได้อยู่ในห้อง ${room} แล้ว เนื่องจากระบบได้ตัดคุณเข้าสู่ห้อง ${session.room} เรียบร้อยแล้ว`,
                currentActiveRoom: session.room
            });
        }

        const currentRoom = session.room;
        const studentName = session.name;
        const leftAt = new Date();

        // 1. สั่งปลดล็อคกลอนประตูห้องนั้นเพื่อให้ผู้ใช้เดินออกจากห้องได้
        mqttService.sendDoorUnlockCommand(currentRoom, 5, 'CHECK_OUT');

        // 2. บันทึกข้อมูลประวัติลง log.txt
        loggerService.writeLog(studentId, studentName, currentRoom, 'OUT');

        // 3. ลบ State ออกจากระบบ
        stateService.removeUserSession(studentId);

        return res.json({
            success: true,
            status: 'CHECKED_OUT',
            message: `ออกจากห้อง ${currentRoom} เรียบร้อยแล้ว ขอบคุณที่ใช้บริการ`,
            room: currentRoom,
            studentId: studentId,
            leftAt: leftAt.toISOString()
        });

    } catch (error) {
        console.error('[CONTROLLER ERROR] เกิดข้อผิดพลาดใน handleDoorCheckout:', error);
        return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์'
        });
    }
}

/**
 * 3. ส่งข้อมูล Log ทั้งหมดให้ทีมกลุ่ม 4 (Web Application)
 * GET /api/logs
 */
function handleGetLogs(req, res) {
    const content = loggerService.getLogContent();
    res.type('text/plain').send(content);
}

/**
 * 4. ตรวจสอบสถานะ Session ของผู้ใช้
 * GET /api/session/:studentId?room=LAB-401
 */
function handleGetSessionStatus(req, res) {
    const { studentId } = req.params;
    const queryRoom = req.query.room; // ตรวจสอบห้องที่หน้าจอเปิดดูอยู่

    const session = stateService.getUserSession(studentId);
    if (!session) {
        return res.json({
            success: true,
            hasActiveSession: false,
            isCurrentRoom: false,
            message: 'ไม่มี Session ที่กำลังใช้งาน'
        });
    }

    // ตรวจสอบว่า session ของผู้ใช้ ยังเป็นห้องนี้อยู่หรือไม่
    const isCurrentRoom = queryRoom ? (session.room === queryRoom) : true;

    return res.json({
        success: true,
        hasActiveSession: true,
        isCurrentRoom: isCurrentRoom,
        currentRoom: session.room,
        session: session,
        serverTime: new Date().toISOString()
    });
}

module.exports = {
    handleDoorAccess,
    handleDoorCheckout,
    handleGetLogs,
    handleGetSessionStatus
};
