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
  Users,
  GripVertical,
  X,
  FileText,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO,
  differenceInDays
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

  // 1. ดึงข้อมูลเริ่มต้นจากฐานข้อมูลออนไลน์
  const fetchData = async () => {
    try {
      const [usersRes, leaveRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/leave-requests')
      ]);
      if (usersRes.ok && leaveRes.ok) {
        const usersData = await usersRes.json();
        const leaveData = await leaveRes.json();
        
        const mappedUsers = usersData.map((u: any) => ({
          id: u.id,
          name: u.username,
          role: u.role,
          department: 'Pharmacist'
        }));
        setUsersList(mappedUsers);
        setLeaveRequests(leaveData);

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

  // 2. ฟังก์ชันล็อกอิน
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

  // 3. ฟังก์ชันส่งฟอร์มบันทึก / แก้ไขวันลา
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_name || !formData.start_date || !formData.end_date) return;
    setIsSubmitting(true);

    try {
      if (formData.id) {
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
        const res = await fetch('/api/leave-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const newRow = await res.json();
          setLeaveRequests(prev => [newRow, ...prev]);
        }
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. เปลี่ยนรหัสผ่าน
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('รหัสผ่านใหม่และรหัสผ่านยืนยันไม่ตรงกัน');
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

  // 5. ลากจัดสลับลำดับคิวตาราง
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
      console.error('Failed to save reorder:', err);
    }
  };

  // 6. อัปเดตสถานะ (แอดมิน)
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

  // 7. ลบรายการคำขอ
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

  // 8. เพิ่มผู้ใช้งานใหม่ (แอดมิน)
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
      fetchData();
    } catch (err) {
      setAdminUserError('เซิร์ฟเวอร์ขัดข้อง');
    }
  };

  // 9. ลบผู้ใช้งาน (แอดมิน)
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

  // ระบบ Undo
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
      console.error('Undo failed:', err);
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

  // คำนวณวันในปฏิทิน
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

  // Export PDF
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

  // หน้า Login Screen
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
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-xl bg-slate-900/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
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
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-xl bg-slate-900/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
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

  // หน้าเมนูล็อกอินผ่านแล้ว (Main App Workspace)
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      {/* Top Navbar */}
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

      {/* Main Container Elements */}
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

        {/* Tab 1: Calendar */}
        {activeTab === 'calendar' && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden p-4 md:p-6">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((day, idx) => (
                <div key={idx} className={cn(
                  "text-center text-xs font-bold py-2 text-slate-400 uppercase tracking-wider",
                  idx === 0 && "text-rose-400",
                  idx === 6 && "text-amber-500"
                )}>
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                const dayRequests = getDayRequests(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[100px] border border-slate-100 rounded-2xl p-2 flex flex-col justify-between transition-all bg-slate-50/30",
                      !isCurrentMonth && "opacity-30 bg-slate-100/10",
                      isToday && "bg-emerald-50/50 border-emerald-200 ring-1 ring-emerald-100"
                    )}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={cn(
                        "text-xs font-bold px-1.5 py-0.5 rounded-md",
                        isToday ? "bg-emerald-500 text-slate-950 font-black" : "text-slate-600"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] pr-0.5 scrollbar-thin">
                      {dayRequests.map((req) => {
                        const colors = userColors[req.user_name] || COLOR_PALETTE[0];
                        return (
                          <div
                            key={req.id}
                            onClick={() => setSelectedRequest(req)}
                            className={cn(
                              "text-[10px] font-medium py-1 px-2 rounded-lg border cursor-pointer truncate transition-all hover:scale-[1.02]",
                              colors.bg, colors.text, colors.border
                            )}
                          >
                            <div className="flex items-center gap-1">
                              <div className={cn("w-1 h-1 rounded-full", colors.dot)} />
                              <span className="font-bold truncate">{req.user_name.replace('เภสัชกร', 'ภญ.').replace('หญิง', '').replace('ชาย', '')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: List View */}
        {activeTab === 'list' && (
          <div id="leave-request-list" className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6 no-print">
              <div>
                <h3 className="text-lg font-bold text-slate-900">ลำดับวันลาและคำขอทั้งหมด</h3>
                <p className="text-xs text-slate-500">คุณสามารถลากสลับคิวจัดลำดับความสำคัญของตารางได้</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>พิมพ์ใบตาราง</span>
                </button>
                <button
                  onClick={exportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ส่งออก PDF</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider no-print w-10">ย้าย</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ลำดับ</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ชื่อผู้ลา</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ประเภทวันหยุด</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">วันที่จอง</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">เหตุผลเพิ่มเติม</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">สถานะ</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider no-print">จัดการ</th>
                  </tr>
                </thead>
                <Reorder.Group as="tbody" values={leaveRequests} onReorder={handleReorder} className="bg-white divide-y divide-slate-200">
                  {leaveRequests.map((req, index) => (
                    <Reorder.Item key={req.id} value={req} as="tr" className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400 no-print cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-4 h-4" />
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-slate-900">{index + 1}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-slate-800">{req.user_name}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-600">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">{req.leave_type || 'หยุดเต็มวัน'}</span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-600">
                        {req.start_date === req.end_date 
                          ? format(parseISO(req.start_date), 'd MMM yy', { locale: th })
                          : `${format(parseISO(req.start_date), 'd MMM', { locale: th })} - ${format(parseISO(req.end_date), 'd MMM yy', { locale: th })}`
                        }
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          ({differenceInDays(parseISO(req.end_date), parseISO(req.start_date)) + 1} วัน)
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-500 max-w-xs truncate">{req.reason || '-'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold",
                          req.status === 'approved' && "bg-emerald-50 text-emerald-700",
                          req.status === 'rejected' && "bg-rose-50 text-rose-700",
                          req.status === 'pending' && "bg-amber-50 text-amber-700"
                        )}>
                          {req.status === 'approved' && 'อนุมัติแล้ว'}
                          {req.status === 'rejected' && 'ปฏิเสธ'}
                          {req.status === 'pending' && 'รออนุมัติ'}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500 no-print">
                        <div className="flex items-center gap-2">
                          {(currentUser?.role === 'admin' || currentUser?.name === req.user_name) && (
                            <button onClick={() => handleEditRequest(req)} className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {currentUser?.role === 'admin' && (
                            <>
                              <button onClick={() => handleUpdateStatus(req.id, 'approved')} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleUpdateStatus(req.id, 'rejected')} className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {(currentUser?.role === 'admin' || currentUser?.name === req.user_name) && (
                            <button onClick={() => handleDeleteRequest(req.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 border border-slate-200 shadow-sm rounded-3xl flex items-center gap-4">
                <div className="p-3 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block font-medium">รวมจำนวนวันหยุดสะสมทั้งทีม</span>
                  <span className="text-2xl font-black text-slate-900">
                    {leaveRequests.filter(r => r.status === 'approved').reduce((sum, r) => sum + (differenceInDays(parseISO(r.end_date), parseISO(r.start_date)) + 1), 0)} วัน
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 border border-slate-200 shadow-sm rounded-3xl flex items-center gap-4">
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block font-medium">รายการอนุมัติสำเร็จ</span>
                  <span className="text-2xl font-black text-slate-900">
                    {leaveRequests.filter(r => r.status === 'approved').length} แถว
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 border border-slate-200 shadow-sm rounded-3xl flex items-center gap-4">
                <div className="p-3 bg-amber-50 border border-amber-100 text-amber-600 rounded-2xl">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block font-medium">รายการคิวรอตรวจสอบ</span>
                  <span className="text-2xl font-black text-slate-900">
                    {leaveRequests.filter(r => r.status === 'pending').length} แถว
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">กราฟสถิติจำนวนวันหยุดแยกรายบุคคล (วัน)</h3>
              <div className="space-y-4">
                {usersList.map(user => {
                  const userLeaves = leaveRequests
                    .filter(r => r.user_name === user.name && r.status === 'approved')
                    .reduce((sum, r) => sum + (differenceInDays(parseISO(r.end_date), parseISO(r.start_date)) + 1), 0);
                  
                  const maxDays = Math.max(...usersList.map(u => 
                    leaveRequests.filter(r => r.user_name === u.name && r.status === 'approved')
                    .reduce((sum, r) => sum + (differenceInDays(parseISO(r.end_date), parseISO(r.start_date)) + 1), 0)
                  ), 1);

                  const percentage = (userLeaves / maxDays) * 100;

                  return (
                    <div key={user.id} className="flex items-center gap-4">
                      <div className="w-36 text-sm font-medium text-slate-700 truncate">{user.name}</div>
                      <div className="flex-1 bg-slate-100 h-6 rounded-lg overflow-hidden relative">
                        <div 
                          className="bg-emerald-400 h-full rounded-lg transition-all duration-500"
                          style={{ width: `${Math.max(percentage, 2)}%` }}
                        />
                        <span className="absolute inset-y-0 left-2 flex items-center text-xs font-bold text-slate-900">
                          {userLeaves} วัน
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Admin User Management */}
        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 h-fit">
              <h3 className="text-md font-bold text-slate-900 mb-4">เพิ่มบัญชีผู้ใช้ใหม่</h3>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ชื่อผู้ใช้งาน</label>
                  <input
                    type="text"
                    value={newAdminUser.username}
                    onChange={(e) => setNewAdminUser(prev => ({ ...prev, username: e.target.value }))}
                    className="block w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="เช่น เภสัชกรชายณัฐวัตร"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">รหัสผ่านเริ่มต้น</label>
                  <input
                    type="password"
                    value={newAdminUser.password}
                    onChange={(e) => setNewAdminUser(prev => ({ ...prev, password: e.target.value }))}
                    className="block w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="1234"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">บทบาทสิทธิ์ใช้งาน</label>
                  <select
                    value={newAdminUser.role}
                    onChange={(e) => setNewAdminUser(prev => ({ ...prev, role: e.target.value }))}
                    className="block w-full border border-slate-300 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="user">User (เภสัชกรทั่วไป)</option>
                    <option value="admin">Admin (หัวหน้ากลุ่มงาน)</option>
                  </select>
                </div>
                {adminUserError && <div className="text-xs font-medium text-rose-600 bg-rose-50 p-2 border border-rose-100 rounded-lg">{adminUserError}</div>}
                <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors cursor-pointer">บันทึกผู้ใช้ใหม่</button>
              </form>
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 lg:col-span-2">
              <h3 className="text-md font-bold text-slate-900 mb-4">รายชื่อเภสัชกรทั้งหมดในระบบ</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">ชื่อในระบบ</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">ระดับสิทธิ์</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {usersList.map(u => (
                      <tr key={u.id}>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{u.name}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-bold uppercase",
                            u.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                          )}>{u.role}</span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">
                          <button onClick={() => handleDeleteUser(u.name)} className="text-xs text-rose-600 hover:underline cursor-pointer">ลบรายชื่อ</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form: Book vacation */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto no-print">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-100">
                <div className="bg-white px-6 pt-6 pb-4 sm:p-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-emerald-600" />
                      <span>{formData.id ? 'แก้ไขข้อมูลการจองวันหยุด' : 'ส่งใบคำขอจองวันหยุด'}</span>
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">ชื่อเภสัชกรผู้จองลา</label>
                      <select
                        disabled={currentUser?.role !== 'admin'}
                        value={formData.user_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, user_name: e.target.value }))}
                        className="block w-full border border-slate-300 bg-slate-50 disabled:bg-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {usersList.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">เริ่มหยุดวันที่</label>
                        <input type="date" value={formData.start_date} onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))} className="block w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">สิ้นสุดวันที่</label>
                        <input type="date" value={formData.end_date} onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))} className="block w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">ประเภทช่วงเวลาหยุด</label>
                      <select value={formData.leave_type} onChange={(e) => setFormData(prev => ({ ...prev, leave_type: e.target.value }))} className="block w-full border border-slate-300 bg-white rounded-xl px-3 py-2 text-sm">
                        <option value="หยุดเต็มวัน">หยุดเต็มวัน</option>
                        <option value="หยุดครึ่งวันเช้า">หยุดครึ่งวันเช้า</option>
                        <option value="หยุดครึ่งวันบ่าย">หยุดครึ่งวันบ่าย</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">หมายเหตุ / เหตุผลการหยุด</label>
                      <textarea value={formData.reason} onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))} rows={3} className="block w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" placeholder="ระบุเหตุผลความจำเป็นเพิ่มเติม (ถ้ามี)" />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer">ยกเลิก</button>
                      <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm hover:bg-emerald-400 disabled:opacity-50 cursor-pointer">
                        {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันจองวันหยุด'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Selected Request Detail */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-50 overflow-y-auto no-print">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setSelectedRequest(null)} />
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-slate-100 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-100 rounded-xl"><FileText className="w-5 h-5 text-slate-600" /></div>
                    <h3 className="text-md font-bold text-slate-900">รายละเอียดใบจองวันหยุด</h3>
                  </div>
                  <button onClick={() => setSelectedRequest(null)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 block">ชื่อผู้จองวันหยุด:</span>
                    <span className="font-bold text-slate-800">{selectedRequest.user_name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">ประเภทวันหยุด:</span>
                    <span className="font-medium text-slate-700">{selectedRequest.leave_type || 'หยุดเต็มวัน'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">ช่วงระยะเวลากรอกลา:</span>
                    <span className="font-medium text-slate-700">
                      {selectedRequest.start_date === selectedRequest.end_date 
                        ? format(parseISO(selectedRequest.start_date), 'dd MMMM yyyy', { locale: th })
                        : `${format(parseISO(selectedRequest.start_date), 'dd MMMM', { locale: th })} ถึง ${format(parseISO(selectedRequest.end_date), 'dd MMMM yyyy', { locale: th })}`
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">เหตุผลประกอบการลา:</span>
                    <p className="text-slate-600 whitespace-pre-wrap">{selectedRequest.reason || '-'}</p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-5">
                  {(currentUser?.role === 'admin' || currentUser?.name === selectedRequest.user_name) && (
                    <button onClick={() => { const req = selectedRequest; setSelectedRequest(null); handleEditRequest(req); }} className="px-3 py-1.5 text-xs font-bold border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer">แก้ไขข้อมูล</button>
                  )}
                  <button onClick={() => setSelectedRequest(null)} className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl cursor-pointer">ปิดหน้าต่าง</button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Change Password */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto no-print">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsPasswordModalOpen(false)} />
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="inline-block align-middle bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full border border-slate-100 p-6">
                <h3 className="text-md font-bold text-slate-900 flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                  <KeyRound className="w-5 h-5 text-emerald-600" />
                  <span>เปลี่ยนรหัสผ่านใหม่</span>
                </h3>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">รหัสผ่านปัจจุบัน</label>
                    <input type="password" required value={passwordForm.oldPassword} onChange={(e) => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))} className="block w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="••••" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">รหัสผ่านใหม่</label>
                    <input type="password" required value={passwordForm.newPassword} onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))} className="block w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="ตั้งอย่างน้อย 4 หลัก" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">ยืนยันรหัสผ่านใหม่</label>
                    <input type="password" required value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))} className="block w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="••••" />
                  </div>

                  {passwordError && <div className="text-xs text-rose-600 bg-rose-50 p-2 border border-rose-100 rounded-lg">{passwordError}</div>}
                  {passwordSuccess && <div className="text-xs text-emerald-600 bg-emerald-50 p-2 border border-emerald-100 rounded-lg">{passwordSuccess}</div>}

                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-medium bg-white hover:bg-slate-50 cursor-pointer">ยกเลิก</button>
                    <button type="submit" className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer">อัปเดตรหัสผ่าน</button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Undo Toast Notification */}
      <AnimatePresence>
        {showUndo && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 px-6 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 no-print">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium">ทำรายการสำเร็จ</span>
            </div>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button onClick={handleUndo} className="flex items-center gap-1.5 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer">
              <RotateCcw className="w-4 h-4" />
              เลิกทำ (Undo)
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button onClick={() => setShowUndo(false)} className="p-1 hover:bg-slate-800 rounded-md text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}