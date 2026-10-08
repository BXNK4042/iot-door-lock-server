/**
 * Logger Service - จัดการเขียนประวัติการเข้า-ออกห้องลงไฟล์ log.txt
 * รูปแบบ: [Timestamp] | StudentId | Name | Room | Action
 */

const fs = require('fs');
const path = require('path');

// ชี้ไปยังโฟลเดอร์ logs/log.txt
const LOG_FILE_PATH = path.join(__dirname, '..', '..', 'logs', 'log.txt');

/**
 * แปลงวันเวลาให้เป็นเวลามาตรฐานประเทศไทย (Asia/Bangkok, UTC+7) รูปแบบ YYYY-MM-DD HH:mm:ss
 */
function getThaiTimestamp(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(date);
    const m = {};
    parts.forEach(p => m[p.type] = p.value);
    return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`;
}

function writeLog(studentId, studentName, roomId, actionStatus) {
    try {
        // ใช้เวลาปัจจุบันตามเวลาประเทศไทย (UTC+7)
        const timestamp = getThaiTimestamp(new Date());

        // จัด Format คอลัมน์ให้ตรงกันเพื่อความสวยงามและง่ายต่อการ Parse
        const formattedLine = `[${timestamp}] | ${String(studentId).padEnd(8, ' ')} | ${String(studentName).padEnd(20, ' ')} | ${String(roomId).padEnd(8, ' ')} | ${actionStatus}\n`;

        // บันทึกแบบ Append (ต่อท้ายไฟล์)
        fs.appendFileSync(LOG_FILE_PATH, formattedLine, 'utf8');
        console.log(`[LOGGER] บันทึกสำเร็จ (เวลาไทย): ${formattedLine.trim()}`);
        return true;
    } catch (error) {
        console.error('[LOGGER ERROR] ไม่สามารถเขียนไฟล์ log.txt ได้:', error);
        return false;
    }
}

function getLogContent() {
    try {
        if (!fs.existsSync(LOG_FILE_PATH)) {
            return '';
        }
        return fs.readFileSync(LOG_FILE_PATH, 'utf8');
    } catch (error) {
        console.error('[LOGGER ERROR] ไม่สามารถอ่านไฟล์ log.txt ได้:', error);
        return '';
    }
}

module.exports = {
    writeLog,
    getLogContent
};
