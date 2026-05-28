import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

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

// 1. API ดึงรายชื่อผู้ใช้ทั้งหมดสำหรับ Dropdown (GET /api/users)
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role FROM users ORDER BY username ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Cannot fetch users' });
  }
});

// 2. API เข้าสู่ระบบ (POST /api/login)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
    }
    const user = result.rows[0];
    if (user.password !== password) {
      return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
    }
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'เซิร์ฟเวอร์เกิดข้อผิดพลาด' });
  }
});

// 3. API ดึงคำขอลาทั้งหมด (GET /api/leave-requests)
app.get('/api/leave-requests', async (req, res) => {
  try {
    // เรียงลำดับตาม sort_order จากน้อยไปมาก ตามที่ฟังก์ชั่นเลื่อนลำดับ (Reorder) ต้องการ
    const result = await pool.query('SELECT * FROM leave_requests ORDER BY sort_order ASC, created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ error: 'Cannot fetch leave requests' });
  }
});

// 4. API ส่งคำขอลาใหม่ (POST /api/leave-requests)
app.post('/api/leave-requests', async (req, res) => {
  const { user_name, start_date, end_date, leave_type } = req.body;
  try {
    // หาค่า sort_order สูงสุดก่อนหน้าเพื่อเอามาต่อท้ายลำดับ
    const maxOrderResult = await pool.query('SELECT MAX(sort_order) as max_order FROM leave_requests');
    const nextOrder = (maxOrderResult.rows[0].max_order || 0) + 1;

    const query = `
      INSERT INTO leave_requests (user_name, start_date, end_date, leave_type, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [user_name, start_date, end_date, leave_type, nextOrder]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({ error: 'Cannot create leave request' });
  }
});

// 5. API อัปเดตสถานะการลา หรือสลับลำดับ Reorder (PATCH /api/leave-requests/:id)
app.patch('/api/leave-requests/:id', async (req, res) => {
  const { id } = req.params;
  const { status, sort_order } = req.body;
  
  try {
    let result;
    if (status !== undefined) {
      result = await pool.query('UPDATE leave_requests SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    } else if (sort_order !== undefined) {
      result = await pool.query('UPDATE leave_requests SET sort_order = $1 WHERE id = $2 RETURNING *', [sort_order, id]);
    } else {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update leave request failed:', error);
    res.status(500).json({ error: 'Update failed' });
  }
});

// 6. API เปลี่ยนรหัสผ่าน/รีเซ็ตรหัสผ่าน (PATCH /api/users/reset-password)
app.patch('/api/users/reset-password', async (req, res) => {
  const { username, newPassword } = req.body;
  try {
    const result = await pool.query('UPDATE users SET password = $1 WHERE username = $2 RETURNING id', [newPassword, username]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });
    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (error) {
    console.error('Reset password failed:', error);
    res.status(500).json({ error: 'Reset password failed' });
  }
});

// 7. API แอดมินเพิ่มผู้ใช้ใหม่ (POST /api/admin/users)
app.post('/api/admin/users', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, password || '1234', role || 'user']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Admin add user failed:', error);
    res.status(400).json({ error: 'ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว' });
  }
});

// 8. API แอดมินลบผู้ใช้ (DELETE /api/admin/users/:username)
app.delete('/api/admin/users/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE username = $1 RETURNING id', [username]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'ลบผู้ใช้งานสำเร็จ' });
  } catch (error) {
    console.error('Admin delete user failed:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// รองรับหน้าบ้านแบบ Single Page Application (SPA) ให้กดรีเฟรชหน้าย่อยไม่เอ๋อ
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});