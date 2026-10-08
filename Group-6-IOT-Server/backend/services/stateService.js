/**
 * State Service - จัดการสถานะในหน่วยความจำ (In-Memory State Table)
 * เก็บว่านักศึกษาคนใด กำลังอยู่ในห้องใด และเข้าห้องตั้งแต่เวลาใด
 */

class StateService {
    constructor() {
        // Map: studentId => { room: string, name: string, enteredAt: Date }
        this.activeSessions = new Map();
    }

    /**
     * ดึงสถานะปัจจุบันของนักศึกษา
     */
    getUserSession(studentId) {
        return this.activeSessions.get(String(studentId)) || null;
    }

    /**
     * ตรวจสอบว่า นศ. กำลังอยู่ในห้องใดห้องหนึ่งหรือไม่
     */
    isUserInside(studentId) {
        return this.activeSessions.has(String(studentId));
    }

    /**
     * บันทึกสถานะการเข้าห้องใหม่ (Check-In)
     */
    setUserCheckIn(studentId, studentName, roomId, timestamp = new Date()) {
        const sessionData = {
            studentId: String(studentId),
            name: String(studentName),
            room: String(roomId),
            enteredAt: timestamp
        };
        this.activeSessions.set(String(studentId), sessionData);
        console.log(`[STATE] Check-In ผู้ใช้ ${studentId} เข้าสู่ห้อง ${roomId} เวลา ${timestamp.toISOString()}`);
        return sessionData;
    }

    /**
     * เคลียร์สถานะเมื่อออกจากห้อง (Check-Out)
     */
    removeUserSession(studentId) {
        const session = this.activeSessions.get(String(studentId));
        if (session) {
            this.activeSessions.delete(String(studentId));
            console.log(`[STATE] Check-Out ผู้ใช้ ${studentId} ออกจากห้อง ${session.room}`);
            return session;
        }
        return null;
    }

    /**
     * รายการ Session ทั้งหมดที่กำลังใช้งานอยู่ในระบบ
     */
    getAllActiveSessions() {
        return Array.from(this.activeSessions.values());
    }
}

// Export เป็น Singleton Instance
module.exports = new StateService();
