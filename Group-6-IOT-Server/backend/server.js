/**
 * 🚀 Main Server Entry Point (Group 6 IoT Server)
 * รันด้วย Pure Native Node.js 100% (ไม่มี Docker ปลอดภัยต่อระบบ Windows)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware พื้นฐาน
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// เสิร์ฟไฟล์ Static ของ Frontend โดยตรงจากโฟลเดอร์ frontend/public และ frontend/logo
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend', 'public');
const LOGO_DIR = path.join(__dirname, '..', 'frontend', 'logo');
app.use(express.static(FRONTEND_DIR));
app.use('/logo', express.static(LOGO_DIR));

// เชื่อมต่อ API Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ONLINE',
        group: 'Group 6 IoT Server',
        timestamp: new Date().toISOString()
    });
});

// Fallback: ถ้ามีไฟล์หน้าเว็บให้ส่ง index.html ถ้าไม่มีให้ส่งสถานะ Backend API
app.get('*', (req, res) => {
    const indexPath = path.join(FRONTEND_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    res.json({
        service: 'Group 6 IoT Door Backend API',
        status: 'ONLINE',
        role: 'BACKEND',
        endpoints: {
            auth_access: 'POST /api/door/access',
            checkout: 'POST /api/door/checkout',
            session_status: 'GET /api/session/:studentId',
            logs: 'GET /api/logs',
            health: 'GET /health'
        }
    });
});

// เริ่มต้นทำงาน
app.listen(PORT, '0.0.0.0', () => {
    console.log('====================================================');
    console.log(`🚀 [GROUP 6] IoT Server กำลังทำงานที่ Port: ${PORT}`);
    console.log(`🌐 Local URL:   http://localhost:${PORT}`);
    console.log(`📁 Static Web:  ${FRONTEND_DIR}`);
    console.log('🔒 Pure Native Node.js Mode (100% No Docker)');
    console.log('====================================================');
});
