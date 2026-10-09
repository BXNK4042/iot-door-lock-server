/**
 * API Routes - จัดการเส้นทางของ Endpoints ทั้งหมด
 */

const express = require('express');
const router = express.Router();
const doorController = require('../controllers/doorController');

// 1. สแกน QR Code แล้ว Login เข้าห้อง (Auto Check-In)
router.post('/door/access', doorController.handleDoorAccess);

// 2. กดปุ่มออกจากห้อง (Check-Out)
router.post('/door/checkout', doorController.handleDoorCheckout);

// 3. ตรวจสอบสถานะ Session ของผู้ใช้
router.get('/session/:studentId', doorController.handleGetSessionStatus);

// 4. ให้บริการข้อมูล Log สำหรับกลุ่ม 4 (Web Application)
router.get('/logs', doorController.handleGetLogs);

module.exports = router;
