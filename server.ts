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

// 🔌 ต่อสายส่งข้อมูลเข้าตู้เซฟก้อนเมฆ Supabase (ผ่าน Connection Pooler พอร์ต 6543)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// เสิร์ฟไฟล์หน้าบ้าน (Vite Build)
app.use(express.static(path.join(__dirname, 'dist')));

// 1. API ดึงรายชื่อผู้ใช้ทั้งหมด (GET /api/users)
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
    // เรียงตามลำดับ sort_order จากน้อยไปมาก เพื่อรองรับฟังก์ชันลากสลับลำดับ Reorder
    const result = await pool.query('SELECT * FROM leave_requests ORDER BY sort_order ASC, created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ error: 'Cannot fetch leave requests' });
  }
});

// 4. API บันทึกคำขอลาใหม่ (POST /api/leave-requests)
app.post('/api/leave-requests', async (req, res) => {
  const { user_name, start_date, end_date, reason, leave_type } = req.body;
  try {
    // คำนวณหาลำดับ sort_order สูงสุดเดิมเพื่อเอามาต่อท้ายลำดับ
    const maxOrderResult = await pool.query('SELECT MAX(sort_order) as max_order FROM leave_requests');
    const nextOrder = (maxOrderResult.rows[0].max_order || 0) + 1;

    const query = `
      INSERT INTO leave_requests (user_name, start_date, end_date, reason, leave_type, sort_order, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'approved')
      RETURNING id, user_name, start_date, end_date, reason, leave_type, status, sort_order, created_at
    `;
    const result = await pool.query(query, [user_name, start_date, end_date, reason, leave_type, nextOrder]);
    
    // คืนค่ารูปแบบวัตถุที่บันทึกสำเร็จกลับไปให้หน้าบ้านอัปเดต State ทันที
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({ error: 'Cannot create leave request' });
  }
});

// 5. API ลากจัดสลับลำดับความสำคัญ (POST /api/leave-requests/reorder)
app.post('/api/leave-requests/reorder', async (req, res) => {
  const { orders } = req.body; // รับ Array ของวัตถุที่มีรูปแบบ [{ id, sort_order }]
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of orders) {
      await client.query('UPDATE leave_requests SET sort_order = $1 WHERE id = $2', [item.sort_order, item.id]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reorder failed:', error);
    res.status(500).json({ error: 'Reorder failed' });
  } finally {
    client.release();
  }
});

// 6. API เปลี่ยนสถานะการอนุมัติ หรือแก้ไขข้อมูลวันลา (PATCH /api/leave-requests/:id)
app.patch('/api/leave-requests/:id', async (req, res) => {
  const { id } = req.params;
  const { status, user_name, start_date, end_date, reason, leave_type } = req.body;
  try {
    let result;
    if (status !== undefined) {
      result = await pool.query('UPDATE leave_requests SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    } else {
      const query = `
        UPDATE leave_requests 
        SET user_name = $1, start_date = $2, end_date = $3, reason = $4, leave_type = $5 
        WHERE id = $6 RETURNING *
      `;
      result = await pool.query(query, [user_name, start_date, end_date, reason, leave_type, id]);
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update request failed:', error);
    res.status(500).json({ error: 'Update failed' });
  }
});

// 7. API ลบรายการวันหยุด (DELETE /api/leave-requests/:id)
app.delete('/api/leave-requests/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM leave_requests WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete leave request error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// 8. API เปลี่ยนรหัสผ่านผู้ใช้งาน (POST /api/change-password) - แมตช์กับ App.tsx ของ AI Studio เป๊ะๆ
app.post('/api/change-password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
    }
    if (userResult.rows[0].password !== oldPassword) {
      return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }
    await pool.query('UPDATE users SET password = $1 WHERE username = $2', [newPassword, username]);
    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จสำเร็จแล้ว' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'เซิร์ฟเวอร์เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' });
  }
});

// 9. API แอดมินจัดการเพิ่มผู้ใช้ใหม่ (POST /api/admin/users)
app.post('/api/admin/users', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, password || '1234', role || 'user']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: 'ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว' });
  }
});

// 10. API แอดมินจัดการลบผู้ใช้ (DELETE /api/admin/users/:username)
app.delete('/api/admin/users/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE username = $1 RETURNING id', [username]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    res.json({ success: true, message: 'ลบผู้ใช้งานสำเร็จ' });
  } catch (error) {
    res.status(500).json({ error: 'Delete user failed' });
  }
});

// เปิดทางให้หน้าบ้านแบบ SPA รีเฟรชแล้วไม่เอ๋อ
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server fully operational on port ${PORT}`);
});