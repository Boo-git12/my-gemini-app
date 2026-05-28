import fetch from 'node-fetch';

// Change this to the admin user that already exists in DB (or run as super admin)
const ADMIN_USERNAME = 'ณัฐวัตร';
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

const users = [
  { username: 'ณัฐวัตร', password: '1234', role: 'superadmin' },
  { username: 'ดวงหทัย', password: '1234', role: 'admin' },
  { username: 'สุรัตนา', password: '1234', role: 'admin' },
  { username: 'สาธิดา', password: '1234', role: 'admin' },
  { username: 'วชิราภรณ์', password: '1234', role: 'user' },
  { username: 'อับดุลเลาะห์', password: '1234', role: 'user' },
  { username: 'ลติฟา', password: '1234', role: 'user' },
  { username: 'ภูริณัฐ', password: '1234', role: 'user' },
  { username: 'กรวิชญ์', password: '1234', role: 'user' },
  { username: 'นิติรัตน์', password: '1234', role: 'user' },
  { username: 'อิงทิพย์', password: '1234', role: 'user' },
  { username: 'พอเพียง', password: '1234', role: 'user' },
  { username: 'จิตรา', password: '1234', role: 'user' },
  { username: 'ปนัสยา', password: '1234', role: 'user' },
  { username: 'อัสมา', password: '1234', role: 'user' },
  { username: 'ชนาภา', password: '1234', role: 'user' },
  { username: 'ทิฆัมพร', password: '1234', role: 'user' },
  { username: 'นฤมล', password: '1234', role: 'user' },
  { username: 'ณัฐณิชา', password: '1234', role: 'user' },
  { username: 'ตะวัน', password: '1234', role: 'user' }
];

(async () => {
  for (const u of users) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUsername: ADMIN_USERNAME, username: u.username, password: u.password, role: u.role })
      });

      if (res.ok) {
        const body = await res.json();
        console.log('Created:', body.username || body);
      } else {
        const err = await res.text();
        console.error('Failed to create', u.username, res.status, err);
      }
    } catch (e) {
      console.error('Error creating user', u.username, e.message || e);
    }
  }
})();
