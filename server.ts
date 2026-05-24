import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

// 💡 ปรับแต่งจุดที่ 1: ตรวจสอบถ้ารันบน Vercel ให้ใช้ :memory: เพื่อไม่ให้ระบบคราส (Error 500)
const isVercel = process.env.VERCEL === '1' || process.env.NOW_REGION !== undefined;
const db = new Database(isVercel ? ":memory:" : "leave_system.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL DEFAULT '1234'
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT,
    leave_type TEXT DEFAULT 'หยุดเต็มวัน',
    status TEXT DEFAULT 'approved',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add sort_order if it doesn't exist
try {
  db.prepare("SELECT sort_order FROM leave_requests LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE leave_requests ADD COLUMN sort_order INTEGER DEFAULT 0");
}

// Migration: Add leave_type if it doesn't exist
try {
  db.prepare("SELECT leave_type FROM leave_requests LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE leave_requests ADD COLUMN leave_type TEXT DEFAULT 'หยุดเต็มวัน'");
}

// Seed users if empty
const PHARMACIST_NAMES = [
  "นฤดี", "วชิราภรณ์", "ณัฐวัตร", "ดวงหทัย", "อับดุลเลาะห์", 
  "ลติฟา", "พิมพกานต์", "ชนม์นิภา", "ภูริณัฐ", "กรวิชญ์", 
  "พชรดนัย", "ณิชาพัชร์", "นิติรัตน์", "สินีนาฎ", "อิงทิพย์", 
  "พอเพียง", "สาธิดา", "สุรัตนา", "จิตรา", "ปนัสยา", 
  "อัสมา", "ชนาภา", "ชญานิษฐ์", "ทิฆัมพร", "นฤมล", 
  "ณัฐณิชา", "ตะวัน"
];

const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const insert = db.prepare("INSERT INTO users (username) VALUES (?)");
  const transaction = db.transaction((names) => {
    for (const name of names) insert.run(name);
  });
  transaction(PHARMACIST_NAMES);
}

// 💡 ปรับแต่งจุดที่ 2: ดึงสิทธิ์สร้างอินสแตนซ์ของแอปออกมาด้านนอกเพื่อให้ Vercel ตรวจพบบั้นปลายหลังบ้านได้ตรงพาธ
const app = express();
app.use(express.json());

// Auth Routes
app.get("/api/users", (req, res) => {
  try {
    const users = db.prepare("SELECT username FROM users ORDER BY username ASC").all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
  if (user) {
    res.json({ success: true, username: user.username });
  } else {
    res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
  }
});

app.post("/api/change-password", (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, oldPassword);
    if (user) {
      db.prepare("UPDATE users SET password = ? WHERE username = ?").run(newPassword, username);
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });
    }
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post("/api/admin/reset-password", (req, res) => {
  const { adminUsername, targetUsername, newPassword } = req.body;
  const ADMIN_NAMES = ["ดวงหทัย", "สุรัตนา", "สาธิดา", "ณัฐวัตร"];
  if (!ADMIN_NAMES.includes(adminUsername)) {
    return res.status(403).json({ error: "ไม่มีสิทธิ์ดำเนินการ" });
  }
  db.prepare("UPDATE users SET password = ? WHERE username = ?").run(newPassword || '1234', targetUsername);
  db.prepare("UPDATE password_resets SET status = 'completed' WHERE username = ? AND status = 'pending'").run(targetUsername);
  res.json({ success: true });
});

app.post("/api/request-reset", (req, res) => {
  const { username } = req.body;
  const existing = db.prepare("SELECT * FROM password_resets WHERE username = ? AND status = 'pending'").get(username);
  if (existing) {
    return res.json({ success: true, message: "มีคำขออยู่แล้ว" });
  }
  db.prepare("INSERT INTO password_resets (username) VALUES (?)").run(username);
  res.json({ success: true });
});

app.get("/api/admin/reset-requests", (req, res) => {
  const requests = db.prepare("SELECT * FROM password_resets WHERE status = 'pending' ORDER BY created_at DESC").all();
  res.json(requests);
});

app.post("/api/admin/users", (req, res) => {
  const { adminUsername, username, password } = req.body;
  const ADMIN_NAMES = ["ดวงหทัย", "สุรัตนา", "สาธิดา", "ณัฐวัตร"];
  if (!ADMIN_NAMES.includes(adminUsername)) {
    return res.status(403).json({ error: "ไม่มีสิทธิ์ดำเนินการ" });
  }
  try {
    db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, password || '1234');
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" });
  }
});

app.delete("/api/admin/users/:username", (req, res) => {
  const { adminUsername } = req.query;
  const { username } = req.params;
  const ADMIN_NAMES = ["ดวงหทัย", "สุรัตนา", "สาธิดา", "ณัฐวัตร"];
  if (!ADMIN_NAMES.includes(adminUsername as string)) {
    return res.status(403).json({ error: "ไม่มีสิทธิ์ดำเนินการ" });
  }
  try {
    db.prepare("DELETE FROM users WHERE username = ?").run(username);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// API Routes
app.get("/api/leave-requests", (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT * FROM leave_requests 
      ORDER BY sort_order ASC, created_at DESC
    `).all();
    res.json(requests);
  } catch (error) {
    console.error('GET /api/leave-requests error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post("/api/leave-requests", (req, res) => {
  try {
    const { user_name, start_date, end_date, reason, leave_type } = req.body;
    if (!user_name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const maxOrder = db.prepare("SELECT MAX(sort_order) as max_order FROM leave_requests").get() as { max_order: number | null };
    const nextOrder = (maxOrder.max_order || 0) + 1;

    const info = db.prepare(`
      INSERT INTO leave_requests (user_name, start_date, end_date, reason, leave_type, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user_name, start_date, end_date, reason, leave_type || 'หยุดเต็มวัน', nextOrder);
    res.json({ id: info.lastInsertRowid });
  } catch (error) {
    console.error('POST /api/leave-requests error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.patch("/api/leave-requests/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { status, start_date, end_date, reason, user_name, leave_type } = req.body;
    
    if (status !== undefined) {
      db.prepare("UPDATE leave_requests SET status = ? WHERE id = ?").run(status, id);
    }
    
    if (start_date !== undefined || end_date !== undefined || reason !== undefined || user_name !== undefined || leave_type !== undefined) {
      const current = db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(id) as any;
      if (current) {
        db.prepare(`
          UPDATE leave_requests 
          SET start_date = ?, end_date = ?, reason = ?, user_name = ?, leave_type = ?
          WHERE id = ?
        `).run(
          start_date ?? current.start_date,
          end_date ?? current.end_date,
          reason ?? current.reason,
          user_name ?? current.user_name,
          leave_type ?? current.leave_type,
          id
        );
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/leave-requests/:id error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post("/api/leave-requests/reorder", (req, res) => {
  try {
    const { orders } = req.body;
    const update = db.prepare("UPDATE leave_requests SET sort_order = ? WHERE id = ?");
    const transaction = db.transaction((items) => {
      for (const item of items) {
        update.run(item.sort_order, item.id);
      }
    });
    transaction(orders);
    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/leave-requests/reorder error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete("/api/leave-requests/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM leave_requests WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/leave-requests/:id error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 💡 ปรับแต่งจุดที่ 3: ห่อฟังก์ชันจัดแจงไฟล์หน้าบ้าน-หลังบ้าน ให้รันเปิดพอร์ตเฉพาะตอนรันในคอมตัวเอง (Localhost)
async function setupServer() {
  if (process.env.NODE_ENV !== "production" && !isVercel) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  if (!isVercel) {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

setupServer();

// ส่งออกแบบโมดูลเพื่อให้ Vercel ดึงไปใช้เปิดเว็บสำเร็จ
export default app;