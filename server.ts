import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; // เพิ่มตัวนี้เข้ามาช่วยแปลงพาธไฟล์

dotenv.config();

// บล็อกนี้คือคำสั่งสร้าง __dirname เลียนแบบขึ้นมาเพื่อให้ใช้งานในระบบ ES Module ได้ครับ
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// 🔌 ต่อสายส่งข้อมูลเข้าตู้เซฟก้อนเมฆ Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// เสิร์ฟไฟล์หน้าบ้าน (Vite Build)
app.use(express.static(path.join(__dirname, 'dist')));

// 1. API ดึงข้อมูลวันลาทั้งหมดจาก Supabase
app.get('/api/leaves', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leaves ORDER BY leave_date DESC');
    const leaves = result.rows.map(row => ({
      id: row.id,
      pharmacistName: row.pharmacist_name,
      leaveDate: row.leave_date,
      leaveType: row.leave_type,
      status: row.status
    }));
    res.json(leaves);
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. API บันทึกการลาใหม่ลง Supabase
app.post('/api/leaves', async (req, res) => {
  const { pharmacistName, leaveDate, leaveType } = req.body;
  if (!pharmacistName || !leaveDate || !leaveType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const query = `
      INSERT INTO leaves (pharmacist_name, leave_date, leave_type)
      VALUES ($1, $2, $3)
      RETURNING id, pharmacist_name, leave_date, leave_type, status
    `;
    const values = [pharmacistName, leaveDate, leaveType];
    const result = await pool.query(query, values);
    
    const newLeave = {
      id: result.rows[0].id,
      pharmacistName: result.rows[0].pharmacist_name,
      leaveDate: result.rows[0].leave_date,
      leaveType: result.rows[0].leave_type,
      status: result.rows[0].status
    };
    res.status(201).json(newLeave);
  } catch (error) {
    console.error('Error creating leave:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// รองรับหน้าบ้านแบบ Single Page Application (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});