import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  AlertCircle,
  BarChart3,
  LogOut,
  Lock,
  KeyRound,
  RotateCcw,
  ShieldAlert,
  Pencil,
  Download,
  Upload,
  Users,
  GripVertical,
  X,
  FileText,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
  format, 
  addMonths, \n  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO,
  differenceInDays,
  isSameYear
} from 'date-fns';
import { th } from 'date-fns/locale';
import { User, LeaveRequest } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLOR_PALETTE = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
];

export default function App() {
  // Authentication & User States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [usersList, setUsersList] = useState<User[]>([]);

  // Application States
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'list' | 'dashboard' | 'admin'>('calendar');

  // Form States
  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
    user_name: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    reason: '',
    leave_type: 'หยุดเต็มวัน'
  });

  // Password Management States
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Admin User Management States
  const [newAdminUser, setNewAdminUser] = useState({ username: '', password: '', role: 'user', department: 'Pharmacist' });
  const [adminUserError, setAdminUserError] = useState('');

  // Undo System States
  const [showUndo, setShowUndo] = useState(false);
  const [lastAction, setLastAction] = useState<{ type: 'delete' | 'status' | 'reorder'; data: any } | null>(null);

  // User Color Mapping
  const [userColors, setUserColors] = useState<Record<string, typeof COLOR_PALETTE[0]>>({});

  // 1. ดึงข้อมูลเริ่มต้นจากฐานข้อมูลออนไลน์ Supabase
  const fetchData = async () => {
    try {
      const [usersRes, leaveRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/leave-requests')
      ]);
      if (usersRes.ok && leaveRes.ok) {
        const usersData = await usersRes.json();
        const leaveData = await leaveRes.json();
        
        // แปลงข้อมูลให้อยู่ในโครงสร้าง Frontend
        const mappedUsers = usersData.map((u: any) => ({
          id: u.id,
          name: u.username,
          role: u.role,
          department: 'Pharmacist'
        }));
        setUsersList(mappedUsers);
        setLeaveRequests(leaveData);

        // จัดการสุ่มและผูกสีประจำตัวผู้ใช้
        const colors: Record<string, typeof COLOR_PALETTE[0]> = {};
        mappedUsers.forEach((user: User, index: number) => {
          colors[user.name] = COLOR_PALETTE[index % COLOR_PALETTE.length];
        });
        setUserColors(colors);
      }
    } catch (err) {
      console.error('Error fetching layout data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. ฟังก์ชันล็อกอินเชื่อมต่อหลังบ้าน
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'เข้าสู่ระบบล้มเหลว');
        return;
      }
      const loggedInUser: User = {
        id: data.id,
        name: data.username,
        role: data.role,
        department: 'Pharmacist'
      };
      setCurrentUser(loggedInUser);
      setIsLoggedIn(true);
      setFormData(prev => ({ ...prev, user_name: loggedInUser.name }));
    } catch (err) {
      setLoginError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  // 3. ฟังก์ชันการส่งฟอร์มบันทึก / แก้ไขวันลา (แก้ไขให้หน้าจออัปเดต Real-time)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_name || !formData.start_date || !formData.end_date) return;
    setIsSubmitting(true);

    try {
      if (formData.id) {
        // กรณีแก้ไขรายการเดิม
        const res = await fetch(`/api/leave-requests/${formData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const updatedRow = await res.json();
          setLeaveRequests(prev => prev.map(item => item.id === formData.id ? updatedRow : item));
        }
      } else {
        // กรณีส่งจองวันหยุดรายการใหม่
        const res = await fetch('/api/leave-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const newRow = await res.json();
          // นำรายการใหม่เข้าไปใส่ใน State หน้าบ้านทันที เพื่อให้แสดงผลบนตารางและปฏิทินแบบเรียลไทม์
          setLeaveRequests(prev => [newRow, ...prev]);
        }
      }
      setIsModalOpen(false);
      resetForm();
      // ดึงข้อมูลใหม่อีกครั้งเพื่อความแม่นยำของลำดับ
      fetchData();
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. ฟังก์ชันเปลี่ยนรหัสผ่าน (Sync ลิงก์และชื่อตัวแปรตรงหลังบ้านคีย์เวิร์ดเดียวกััน)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('รหัสผ่านใหม่และรหัสผ่านยืนยันไม่ตรงกัน');
      return;
    }
    if (passwordForm.newPassword.length < 4) {
      setPasswordError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser?.name,
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
        return;
      }
      setPasswordSuccess('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว!');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setIsPasswordModalOpen(false), 2000);
    } catch (err) {
      setPasswordError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  // 5. ลากจัดสลับลำดับคิวตารางแบบบันทึกถาวร (Reorder)
  const handleReorder = async (newOrder: LeaveRequest[]) => {
    setLeaveRequests(newOrder);
    const updatedOrders = newOrder.map((item, index) => ({
      id: item.id,
      sort_order: index + 1
    }));
    try {
      await fetch('/api/leave-requests/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: updatedOrders })
      });
    } catch (err) {
      console.error('Failed to save reorder onto server:', err);
    }
  };

  // 6. อัปเดตสถานะการลา (อนุมัติ/ปฏิเสธ) สำหรับแอดมิน
  const handleUpdateStatus = async (id: number, status: 'approved' | 'rejected' | 'pending') => {
    const originalRequests = [...leaveRequests];
    const target = leaveRequests.find(r => r.id === id);
    if (!target) return;

    setLastAction({ type: 'status', data: { id, previousStatus: target.status } });
    setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setShowUndo(true);

    try {
      const res = await fetch(`/api/leave-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) setLeaveRequests(originalRequests);
    } catch (err) {
      setLeaveRequests(originalRequests);
    }
  };

  // 7. ลบรายการคำขอวันหยุด
  const handleDeleteRequest = async (id: number) => {
    const originalRequests = [...leaveRequests];
    const target = leaveRequests.find(r => r.id === id);
    if (!target) return;

    setLastAction({ type: 'delete', data: target });
    setLeaveRequests(prev => prev.filter(r => r.id !== id));
    setShowUndo(true);

    try {
      const res = await fetch(`/api/leave-requests/${id}`, { method: 'DELETE' });
      if (!res.ok) setLeaveRequests(originalRequests);
    } catch (err) {
      setLeaveRequests(originalRequests);
    }
  };

  // 8. เพิ่มผู้ใช้งานคนใหม่ (ฝั่ง Admin)
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminUserError('');
    if (!newAdminUser.username || !newAdminUser.password) {
      setAdminUserError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newAdminUser.username,
          password: newAdminUser.password,
          role: newAdminUser.role
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminUserError(data.error || 'ไม่สามารถเพิ่มผู้ใช้งานได้');
        return;
      }
      setNewAdminUser({ username: '', password: '', role: 'user', department: 'Pharmacist' });
      fetchData(); // รีเฟรชรายชื่อในระบบ
    } catch (err) {
      setAdminUserError('เซิร์ฟเวอร์ขัดข้อง');
    }
  };

  // 9. ลบผู้ใช้งานออกจากระบบ (ฝั่ง Admin)
  const handleDeleteUser = async (username: string) => {
    if (username === currentUser?.name) {
      alert('คุณไม่สามารถลบบัญชีของตัวเองได้');
      return;
    }
    if (!window.confirm(`คุณต้องการลบผู้ใช้งาน ${username} ใช่หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${username}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Delete user failed:', err);
    }
  };

  // ระบบดึงข้อมูลย้อนกลับ (Undo)
  const handleUndo = async () => {
    if (!lastAction) return;
    setShowUndo(false);

    try {
      if (lastAction.type === 'status') {
        const { id, previousStatus } = lastAction.data;
        await fetch(`/api/leave-requests/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: previousStatus })
        });
      } else if (lastAction.type === 'delete') {
        const target = lastAction.data;
        await fetch('/api/leave-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(target)
        });
      }
      fetchData();
    } catch (err) {
      console.error('Undo execution failed:', err);
    } finally {
      setLastAction(null);
    }
  };

  const resetForm = () => {
    setFormData({
      id: undefined,
      user_name: currentUser?.name || '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(), 'yyyy-MM-dd'),
      reason: '',
      leave_type: 'หยุดเต็มวัน'
    });
  };

  const handleEditRequest = (request: LeaveRequest) => {
    setFormData({
      id: request.id,
      user_name: request.user_name,
      start_date: request.start_date,
      end_date: request.end_date,
      reason: request.reason || '',
      leave_type: request.leave_type || 'หยุดเต็มวัน'
    });
    setIsModalOpen(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setUsernameInput('');
    setPasswordInput('');
    setActiveTab('calendar');
  };

  // --- ส่วนคำนวณและวาดหน้าจอ Calendar ---
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayRequests = (day: Date) => {
    return leaveRequests.filter(req => {
      if (req.status !== 'approved') return false;
      const start = parseISO(req.start_date);
      const end = parseISO(req.end_date);
      return (isSameDay(day, start) || isSameDay(day, end) || (day >= start && day <= end));
    });
  };

  // --- Export รายงาน PDF ---
  const exportPDF = () => {
    const input = document.getElementById('leave-request-list');
    if (!input) return;
    
    html2canvas(input, { scale: 2, useCORS: true }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`รายงานวันหยุดประจำเดือน-${format(currentMonth, 'MM-yyyy')}.pdf`);
    });
  };

  // หน้าล็อกอินเข้าใช้งานระบบ
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto w-full max-w-md">
          <div className="flex justify-center">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <CalendarIcon className="w-12 h-12 text-emerald-400" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
            ระบบจองวันหยุดกลุ่มงานเภสัชกรรม
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            โรงพยาบาลชุมชนและการจัดการเวชภัณฑ์
          </p>
        </div>

        <div className="mt-8 sm:mx-auto w-full max-w-md">
          <div className="bg-slate-800 py-8 px-4 shadow-2xl rounded-3xl sm:px-10 border border-slate-700/50">
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-medium text-slate-300">ชื่อผู้ใช้งาน (ภาษาไทย)</label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-xl bg-slate-900/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all"
                    placeholder="เช่น เภสัชกรหญิงดวงหทัย"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">รหัสผ่าน</label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-xl bg-slate-900/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all"
                    placeholder="••••"
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400 text-sm">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors cursor-pointer"
                >
                  เข้าสู่ระบบ
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      {/* ส่วนหัวแสดงชื่อแถบเมนู (Navbar) */}
      <nav className="bg-white border-b border-slate-200/80 sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                <CalendarIcon className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-900 block leading-tight">ระบบจองวันหยุดเภสัชกร</span>
                <span className="text-xs text-slate-500">โรงพยาบาลชุมชนและการจัดการเวชภัณฑ์</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-slate-700">{currentUser?.name}</span>
                <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md font-bold uppercase">
                  {currentUser?.role}
                </span>
              </div>

              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                title="เปลี่ยนรหัสผ่าน"
              >
                <KeyRound className="w-4 h-4" />
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ส่วนควบคุมหลักของตัวโปรแกรม */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print mb-6">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setActiveTab('calendar')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                activeTab === 'calendar' ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>ปฏิทินวันหยุด</span>
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                activeTab === 'list' ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ClipboardList className="w-4 h-4" />
              <span>รายการคำขอ</span>
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                activeTab === 'dashboard' ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              <span>สถิติภาพรวม</span>
            </button>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                  activeTab === 'admin' ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Users className="w-4 h-4" />
                <span>จัดการผู้ใช้งาน</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm p-1">
              <button 
                onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-600 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-slate-800 px-3 min-w-[120px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: th })}
              </span>
              <button 
                onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-600 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm shadow-md shadow-emerald-500/10 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>จองวันหยุด</span>
            </button>
          </div>
        </div>

        {/* แท็บเมนูที่ 1: ปฏิทินวันหยุด (Calendar View) */}
        {activeTab === 'calendar' && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden p-4 md:p-6">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {