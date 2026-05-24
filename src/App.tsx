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
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200' },
  { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  { bg: 'bg-zinc-100', text: 'text-zinc-700', border: 'border-zinc-200' },
  { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200' },
  { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
];

const ADMIN_NAMES = ["ดวงหทัย", "สุรัตนา", "สาธิดา", "ณัฐวัตร"];

export default function App() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('leave_user'));
  const [loginForm, setLoginForm] = useState({ name: '', password: '' });
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '' });
  const [lastAction, setLastAction] = useState<{ 
    type: 'status' | 'create', 
    id: number, 
    status?: 'approved' | 'rejected' 
  } | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [hideMorningOnly, setHideMorningOnly] = useState(false);
  const undoTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const isAdmin = currentUser && ADMIN_NAMES.includes(currentUser);

  const getUserColor = (name: string) => {
    const index = users.findIndex(u => u.username === name);
    if (index === -1) return COLOR_PALETTE[0];
    return COLOR_PALETTE[index % COLOR_PALETTE.length];
  };

  // Form state
  const [formData, setFormData] = useState({
    user_name: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    reason: '',
    leave_type: 'หยุดเต็มวัน'
  });

  useEffect(() => {
    fetchData();
    fetchUsers();
    if (currentUser) {
      setFormData(prev => ({ ...prev, user_name: currentUser }));
      if (ADMIN_NAMES.includes(currentUser)) {
        fetchResetRequests();
      }
    }
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchResetRequests = async () => {
    try {
      const response = await fetch('/api/admin/reset-requests');
      if (response.ok) {
        const data = await response.json();
        setResetRequests(data);
      }
    } catch (error) {
      console.error('Error fetching reset requests:', error);
    }
  };

  const fetchData = async () => {
    try {
      const response = await fetch('/api/leave-requests');
      const requestsData = await response.json();
      setRequests(requestsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginForm.name, password: loginForm.password })
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('leave_user', data.username);
        setCurrentUser(data.username);
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const error = await response.json();
          alert(error.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        } else {
          const text = await response.text();
          alert(`เกิดข้อผิดพลาด: ${text || response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: currentUser, 
          oldPassword: passwordForm.oldPassword, 
          newPassword: passwordForm.newPassword 
        })
      });

      if (response.ok) {
        alert('เปลี่ยนรหัสผ่านสำเร็จ');
        setIsChangePasswordOpen(false);
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const error = await response.json();
          alert(error.error || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
        } else {
          const text = await response.text();
          alert(`เกิดข้อผิดพลาด: ${text || response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Change password error:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleResetPassword = async (targetUsername: string) => {
    const newPassword = prompt(`ป้อนรหัสผ่านใหม่สำหรับ ${targetUsername}:`, '1234');
    if (newPassword === null) return;

    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminUsername: currentUser, 
          targetUsername,
          newPassword
        })
      });

      if (response.ok) {
        alert('เปลี่ยนรหัสผ่านสำเร็จ');
        if (isAdmin) fetchResetRequests();
      } else {
        const error = await response.json();
        alert(error.error || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleRequestReset = async () => {
    if (!loginForm.name) {
      alert('กรุณาเลือกชื่อของคุณก่อน');
      return;
    }

    try {
      const response = await fetch('/api/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginForm.name })
      });

      if (response.ok) {
        alert('ส่งคำขอรีเซ็ตรหัสผ่านแล้ว กรุณาแจ้งผู้ดูแลระบบ');
      }
    } catch (error) {
      console.error('Request reset error:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('leave_user');
    setCurrentUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingRequestId 
        ? `/api/leave-requests/${editingRequestId}`
        : '/api/leave-requests';
      
      const method = editingRequestId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        setIsModalOpen(false);
        setEditingRequestId(null);
        setFormData({
          user_name: currentUser || '',
          start_date: format(new Date(), 'yyyy-MM-dd'),
          end_date: format(new Date(), 'yyyy-MM-dd'),
          reason: '',
          leave_type: 'หยุดเต็มวัน'
        });
        
        if (!editingRequestId) {
          setLastAction({ type: 'create', id: result.id });
          setShowUndo(true);
          if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
          undoTimeoutRef.current = setTimeout(() => setShowUndo(false), 5000);
        }
        
        fetchData();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errorData = await response.json();
          alert(`เกิดข้อผิดพลาด: ${errorData.error || 'ไม่สามารถบันทึกข้อมูลได้'}`);
        } else {
          const text = await response.text();
          alert(`เกิดข้อผิดพลาด: ${text || response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
  };

  const handleStatusUpdate = async (id: number, status: 'approved' | 'rejected', isUndo = false) => {
    try {
      const response = await fetch(`/api/leave-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        if (!isUndo) {
          const currentRequest = requests.find(r => r.id === id);
          if (currentRequest) {
            setLastAction({ type: 'status', id, status: currentRequest.status as 'approved' | 'rejected' });
            setShowUndo(true);
            
            if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
            undoTimeoutRef.current = setTimeout(() => setShowUndo(false), 5000);
          }
        } else {
          setShowUndo(false);
          if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        }
        fetchData();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleUndo = async () => {
    if (!lastAction) return;

    try {
      if (lastAction.type === 'status' && lastAction.status) {
        await handleStatusUpdate(lastAction.id, lastAction.status, true);
      } else if (lastAction.type === 'create') {
        const response = await fetch(`/api/leave-requests/${lastAction.id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          setShowUndo(false);
          if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
          fetchData();
        }
      }
    } catch (error) {
      console.error('Error undoing action:', error);
    }
  };

  const handleReorder = async (newOrder: LeaveRequest[]) => {
    if (!isAdmin) return;
    
    // Optimistically update the UI
    const updatedApproved = newOrder.map((r, i) => ({ ...r, sort_order: i }));
    setRequests(prev => {
      const otherRequests = prev.filter(r => r.status !== 'approved');
      return [...otherRequests, ...updatedApproved];
    });

    try {
      const orders = updatedApproved.map(r => ({ id: r.id, sort_order: r.sort_order }));
      await fetch('/api/leave-requests/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders })
      });
    } catch (error) {
      console.error('Error reordering:', error);
      fetchData(); // Revert on error
    }
  };

  const handleEditRequest = (req: LeaveRequest) => {
    setEditingRequestId(req.id);
    setFormData({
      user_name: req.user_name,
      start_date: req.start_date,
      end_date: req.end_date,
      reason: req.reason || '',
      leave_type: req.leave_type || 'หยุดเต็มวัน'
    });
    setIsModalOpen(true);
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(requests, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `leave_requests_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('leave-request-list');
    if (!element) return;

    try {
      setLoading(true);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`leave_requests_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('เกิดข้อผิดพลาดในการสร้าง PDF');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (!Array.isArray(importedData)) {
          alert('รูปแบบไฟล์ไม่ถูกต้อง');
          return;
        }

        if (!confirm(`คุณต้องการนำเข้าข้อมูลจำนวน ${importedData.length} รายการใช่หรือไม่? (ข้อมูลเดิมจะไม่ถูกลบ)`)) {
          return;
        }

        let successCount = 0;
        for (const req of importedData) {
          try {
            const response = await fetch('/api/leave-requests', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_name: req.user_name,
                start_date: req.start_date,
                end_date: req.end_date,
                reason: req.reason || '',
                leave_type: req.leave_type || 'หยุดเต็มวัน'
              })
            });
            if (response.ok) successCount++;
          } catch (err) {
            console.error('Import error for item:', req, err);
          }
        }

        alert(`นำเข้าข้อมูลสำเร็จ ${successCount} จาก ${importedData.length} รายการ`);
        fetchData();
      } catch (err) {
        console.error('Import error:', err);
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.username) return;
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminUsername: currentUser, 
          username: newUserForm.username, 
          password: newUserForm.password || '1234' 
        })
      });
      if (response.ok) {
        alert('เพิ่มสมาชิกสำเร็จ');
        setNewUserForm({ username: '', password: '' });
        fetchUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'ไม่สามารถเพิ่มสมาชิกได้');
      }
    } catch (error) {
      console.error('Error adding user:', error);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === currentUser) {
      alert('ไม่สามารถลบตัวเองได้');
      return;
    }
    if (!confirm(`คุณต้องการลบสมาชิก "${username}" ใช่หรือไม่?`)) return;
    try {
      const response = await fetch(`/api/admin/users/${username}?adminUsername=${currentUser}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        alert('ลบสมาชิกสำเร็จ');
        fetchUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'ไม่สามารถลบสมาชิกได้');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between px-4 py-6 bg-white border-b border-slate-200 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <CalendarIcon className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">ระบบจองวันหยุดเภสัชกร</h1>
            <p className="text-sm text-slate-500">โรงพยาบาลส่วนภูมิภาค</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
            <UserIcon className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">{currentUser}</span>
            {isAdmin && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                currentUser === "ณัฐวัตร" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
              )}>
                {currentUser === "ณัฐวัตร" ? "SUPER ADMIN" : "ADMIN"}
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsChangePasswordOpen(true)}
            className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
            title="เปลี่ยนรหัสผ่าน"
          >
            <KeyRound className="w-5 h-5" />
          </button>
          
          {isAdmin && (
            <button 
              onClick={() => setIsUserManagementOpen(true)}
              className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
              title="จัดการสมาชิก"
            >
              <Users className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-2">
            <button 
              onClick={handleExportData}
              className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
              title="ส่งออกข้อมูล (JSON Backup)"
            >
              <Download className="w-5 h-5" />
            </button>
            <button 
              onClick={handleExportPDF}
              className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
              title="ดาวน์โหลด PDF"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button 
              onClick={handlePrint}
              className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
              title="พิมพ์"
            >
              <Printer className="w-5 h-5" />
            </button>
            <label className="p-2 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer" title="นำเข้าข้อมูล (Restore)">
              <Upload className="w-5 h-5" />
              <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
            </label>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            จองวันหยุด
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
            title="ออกจากระบบ"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = day;
        
        // Find requests for this day
        const dayRequests = requests
          .filter(req => {
            const start = parseISO(req.start_date);
            const end = parseISO(req.end_date);
            const isApproved = req.status === 'approved';
            const matchesDay = day >= start && day <= end;
            const isNotMorningOnly = !hideMorningOnly || req.leave_type !== 'ขอเช้าเดียว';
            return isApproved && matchesDay && isNotMorningOnly;
          })
          .sort((a, b) => parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime());

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "min-h-[100px] p-2 border-r border-b border-slate-100 transition-colors",
              !isSameMonth(day, monthStart) ? "bg-slate-50 text-slate-300" : "text-slate-700",
              isSameDay(day, new Date()) && "bg-emerald-50/30"
            )}
          >
            <div className="flex justify-between items-start mb-1">
              <span className={cn(
                "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                isSameDay(day, new Date()) && "bg-emerald-600 text-white"
              )}>
                {formattedDate}
              </span>
            </div>
            <div className="space-y-1">
              {dayRequests.map((req, idx) => {
                const colors = getUserColor(req.user_name);
                return (
                  <div 
                    key={idx}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border transition-all hover:scale-[1.02] cursor-default group relative flex items-center justify-between gap-1",
                      colors.bg,
                      colors.text,
                      colors.border
                    )}
                    title={`${req.user_name}${req.reason ? ` (${req.reason})` : ''} - ${req.leave_type || 'หยุดเต็มวัน'}`}
                  >
                    <span className="truncate flex-1">
                      {dayRequests.length > 1 ? `${idx + 1}. ` : ''}{req.user_name}
                      <span className="ml-1 opacity-75">
                        {req.leave_type === 'ขอเช้าเดียว' ? '(เช้า)' : 
                         req.leave_type === 'ลงดึกได้' ? '(ดึก)' : ''}
                      </span>
                    </span>
                    {(isAdmin || currentUser === req.user_name) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`คุณต้องการยกเลิกวันหยุดของ ${req.user_name} วันที่ ${format(parseISO(req.start_date), 'd MMM', { locale: th })} ใช่หรือไม่?`)) {
                            handleStatusUpdate(req.id, 'rejected');
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-opacity p-0.5 flex-shrink-0"
                        title="ยกเลิกวันหยุด"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {format(currentMonth, 'MMMM yyyy', { locale: th })}
          </h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={hideMorningOnly}
                onChange={(e) => setHideMorningOnly(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-600 group-hover:text-emerald-600 transition-colors">ไม่แสดงผลเช้าเดียว</span>
            </label>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>
        <div>{rows}</div>
      </div>
    );
  };

  const renderRequestList = () => {
    const activeRequests = requests
      .filter(r => r.status === 'approved')
      .sort((a, b) => {
        if (a.sort_order !== undefined && b.sort_order !== undefined) {
          return a.sort_order - b.sort_order;
        }
        return parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime();
      });
    const cancelledRequests = requests.filter(r => r.status === 'rejected');

    return (
      <div className="space-y-6 h-full" id="leave-request-list">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600" />
              รายการจองวันหยุด
            </h2>
            {isAdmin && (
              <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                ลากเพื่อสลับลำดับได้
              </span>
            )}
          </div>
          <div className="overflow-y-auto max-h-[400px]">
            {activeRequests.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-sm">ยังไม่มีรายการจอง</p>
              </div>
            ) : (
              <Reorder.Group 
                axis="y" 
                values={activeRequests} 
                onReorder={handleReorder}
                className="divide-y divide-slate-100"
              >
                {activeRequests.map((req) => {
                  const colors = getUserColor(req.user_name);
                  return (
                    <Reorder.Item 
                      key={req.id} 
                      value={req}
                      className="p-4 bg-white hover:bg-slate-50 transition-colors group relative"
                      dragListener={isAdmin}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1 -ml-2">
                              <GripVertical className="w-4 h-4" />
                            </div>
                          )}
                          <div className={cn("w-2 h-8 rounded-full", colors.bg)} />
                          <div>
                            <h3 className="font-medium text-slate-900 flex items-center gap-2">
                              {req.user_name}{req.reason ? ` (${req.reason})` : ''}
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                                req.leave_type === 'ขอเช้าเดียว' ? "bg-purple-100 text-purple-700" :
                                req.leave_type === 'ลงดึกได้' ? "bg-blue-100 text-blue-700" :
                                "bg-emerald-100 text-emerald-700"
                              )}>
                                {req.leave_type || 'หยุดเต็มวัน'}
                              </span>
                            </h3>
                            <p className="text-[10px] text-slate-400">
                              จองเมื่อ: {format(parseISO(req.created_at), 'd MMM yy HH:mm', { locale: th })}
                            </p>
                          </div>
                        </div>
                        {(isAdmin || currentUser === req.user_name) && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleEditRequest(req)}
                              className="text-[10px] font-bold text-blue-500 hover:text-blue-700 px-2 py-1 bg-blue-50 rounded border border-blue-100 transition-colors shadow-sm flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" />
                              แก้ไข
                            </button>
                            <button 
                              onClick={() => handleStatusUpdate(req.id, 'rejected')}
                              className="text-[10px] font-bold text-rose-500 hover:text-rose-700 px-2 py-1 bg-rose-50 rounded border border-rose-100 transition-colors shadow-sm"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 pl-4 sm:pl-6">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span>{format(parseISO(req.start_date), 'd MMM yy', { locale: th })} - {format(parseISO(req.end_date), 'd MMM yy', { locale: th })}</span>
                        </div>
                      </div>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            )}
          </div>
        </div>

        <div className="bg-slate-100 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-400" />
              รายการที่ยกเลิกแล้ว
            </h2>
          </div>
          <div className="overflow-y-auto max-h-[300px]">
            {cancelledRequests.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <p className="text-xs">ไม่มีรายการที่ยกเลิก</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cancelledRequests.map((req) => (
                  <div key={req.id} className="p-3 opacity-60 grayscale">
                    <div className="flex justify-between items-start">
                      <h3 className="text-xs font-medium text-slate-700 line-through">
                        {req.user_name}{req.reason ? ` (${req.reason})` : ''}
                      </h3>
                      <span className="text-[9px] text-slate-400">
                        {format(parseISO(req.created_at), 'd MMM yy HH:mm', { locale: th })}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {format(parseISO(req.start_date), 'd MMM yy', { locale: th })} - {format(parseISO(req.end_date), 'd MMM yy', { locale: th })}
                    </p>
                    {(isAdmin || currentUser === req.user_name) && (
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => handleEditRequest(req)}
                          className="text-[9px] font-bold text-blue-500 hover:text-blue-700 px-1.5 py-0.5 bg-blue-50 rounded border border-blue-100 transition-colors"
                        >
                          แก้ไข
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(req.id, 'approved')}
                          className="text-[9px] font-bold text-emerald-500 hover:text-emerald-700 px-1.5 py-0.5 bg-emerald-50 rounded border border-emerald-100 transition-colors"
                        >
                          กู้คืน
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isAdmin && resetRequests.length > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-amber-200 bg-amber-100/50">
              <h2 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                คำขอรีเซ็ตรหัสผ่าน ({resetRequests.length})
              </h2>
            </div>
            <div className="divide-y divide-amber-100">
              {resetRequests.map((req) => (
                <div key={req.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-amber-900">{req.username}</p>
                    <p className="text-[10px] text-amber-600">
                      เมื่อ: {format(parseISO(req.created_at), 'd MMM HH:mm', { locale: th })}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleResetPassword(req.username)}
                    className="px-2 py-1 bg-amber-600 text-white text-[10px] font-bold rounded hover:bg-amber-700 transition-colors"
                  >
                    รีเซ็ต
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderIndividualStats = () => {
    const currentYear = new Date().getFullYear();
    
    // Filter approved requests for the current year
    const yearRequests = requests.filter(r => 
      r.status === 'approved' && 
      isSameYear(parseISO(r.start_date), new Date())
    );

    const stats = users.map(u => u.username).map(name => {
      const userRequests = yearRequests.filter(r => r.user_name === name && r.leave_type !== 'ขอเช้าเดียว');
      const totalDays = userRequests.reduce((acc, r) => 
        acc + (differenceInDays(parseISO(r.end_date), parseISO(r.start_date)) + 1), 0
      );
      const longLeaves = userRequests.filter(r => 
        (differenceInDays(parseISO(r.end_date), parseISO(r.start_date)) + 1) >= 5
      ).length;

      return { name, totalDays, longLeaves };
    }).filter(s => s.totalDays > 0) // Only show people who have taken leave
      .sort((a, b) => b.totalDays - a.totalDays);

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            สถิติการลาพักร้อนรายบุคคล ({currentYear})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-6 py-3 font-bold">ชื่อ-นามสกุล</th>
                <th className="px-6 py-3 font-bold text-center">จำนวนวันลาทั้งหมด</th>
                <th className="px-6 py-3 font-bold text-center">ลาติดต่อกัน 5 วัน+</th>
                {isAdmin && <th className="px-6 py-3 font-bold text-center">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="px-6 py-12 text-center text-slate-400">
                    ยังไม่มีข้อมูลสถิติในปีนี้
                  </td>
                </tr>
              ) : (
                stats.map((s) => {
                  const colors = getUserColor(s.name);
                  return (
                    <tr key={s.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", colors.bg, colors.border, "border")} />
                          {s.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {s.totalDays} วัน
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {s.longLeaves > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            {s.longLeaves} ครั้ง
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => handleResetPassword(s.name)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                            title="รีเซ็ตรหัสผ่านเป็น 1234"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="p-8 text-center bg-emerald-600 text-white">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold">เข้าสู่ระบบ</h2>
            <p className="text-emerald-100 text-sm mt-1">ระบบจองวันหยุดเภสัชกร</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">เลือกชื่อของคุณ</label>
              <select 
                required
                value={loginForm.name}
                onChange={(e) => setLoginForm({...loginForm, name: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              >
                <option value="" disabled>เลือกชื่อ...</option>
                {users.map(u => (
                  <option key={u.username} value={u.username}>{u.username}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">รหัสผ่าน</label>
              <input 
                type="password"
                required
                placeholder="กรอกรหัสผ่าน"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
            >
              เข้าสู่ระบบ
            </button>
            <div className="text-center">
              <button 
                type="button"
                onClick={handleRequestReset}
                className="text-xs text-slate-400 hover:text-emerald-600 transition-colors"
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {renderHeader()}
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Stats / Quick Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">วันลาพักร้อนคงเหลือ</p>
                <p className="text-xl font-bold text-slate-900">12 <span className="text-xs font-normal text-slate-400">วัน</span></p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">ลาในเดือนนี้</p>
                <p className="text-xl font-bold text-emerald-600">{requests.filter(r => r.status === 'approved' && isSameMonth(parseISO(r.start_date), currentMonth)).length} <span className="text-xs font-normal text-slate-400">คน</span></p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">ลาสะสมทั้งปี</p>
                <p className="text-xl font-bold text-blue-600">
                  {requests
                    .filter(r => r.status === 'approved' && isSameYear(parseISO(r.start_date), new Date()))
                    .reduce((acc, r) => acc + (differenceInDays(parseISO(r.end_date), parseISO(r.start_date)) + 1), 0)
                  } <span className="text-xs font-normal text-slate-400">วัน</span>
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">ลา 5 วัน+ (ครั้ง)</p>
                <p className="text-xl font-bold text-amber-600">
                  {requests.filter(r => 
                    r.status === 'approved' && 
                    isSameYear(parseISO(r.start_date), new Date()) && 
                    (differenceInDays(parseISO(r.end_date), parseISO(r.start_date)) + 1) >= 5
                  ).length} <span className="text-xs font-normal text-slate-400">ครั้ง</span>
                </p>
              </div>
            </div>

            {renderCalendar()}
            {renderIndividualStats()}
          </div>
          
          <div className="lg:col-span-1">
            {renderRequestList()}
          </div>
        </div>
      </main>

      {/* Change Password Modal */}
      <AnimatePresence>
        {isChangePasswordOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChangePasswordOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900">เปลี่ยนรหัสผ่าน</h3>
                <button onClick={() => setIsChangePasswordOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">รหัสผ่านเดิม</label>
                  <input 
                    type="password" 
                    required
                    value={passwordForm.oldPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, oldPassword: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">รหัสผ่านใหม่</label>
                  <input 
                    type="password" 
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">ยืนยันรหัสผ่านใหม่</label>
                  <input 
                    type="password" 
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
                  >
                    เปลี่ยนรหัสผ่าน
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsModalOpen(false);
                setEditingRequestId(null);
                setFormData({
                  user_name: currentUser || '',
                  start_date: format(new Date(), 'yyyy-MM-dd'),
                  end_date: format(new Date(), 'yyyy-MM-dd'),
                  reason: '',
                  leave_type: 'หยุดเต็มวัน'
                });
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingRequestId ? 'แก้ไขข้อมูลการจอง' : 'จองวันหยุด'}
                </h3>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingRequestId(null);
                    setFormData({
                      user_name: currentUser || '',
                      start_date: format(new Date(), 'yyyy-MM-dd'),
                      end_date: format(new Date(), 'yyyy-MM-dd'),
                      reason: '',
                      leave_type: 'หยุดเต็มวัน'
                    });
                  }} 
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">ชื่อ-นามสกุล</label>
                  <select 
                    required
                    disabled={!isAdmin}
                    value={formData.user_name}
                    onChange={(e) => setFormData({...formData, user_name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>เลือกชื่อผู้จอง...</option>
                    {users.map(u => (
                      <option key={u.username} value={u.username}>{u.username}</option>
                    ))}
                  </select>
                  {!isAdmin && <p className="text-[10px] text-slate-400 mt-1">* เฉพาะผู้ดูแลระบบที่สามารถจองแทนผู้อื่นได้</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">ประเภทการขอหยุด</label>
                  <select 
                    required
                    value={formData.leave_type}
                    onChange={(e) => setFormData({...formData, leave_type: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  >
                    <option value="หยุดเต็มวัน">หยุดเต็มวัน</option>
                    <option value="ลงดึกได้">ลงดึกได้</option>
                    <option value="ขอเช้าเดียว">ขอเช้าเดียว</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">วันที่เริ่ม</label>
                    <input 
                      type="date" 
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">วันที่สิ้นสุด</label>
                    <input 
                      type="date" 
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">เหตุผล / หมายเหตุ</label>
                  <textarea 
                    rows={3}
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    placeholder="ระบุเหตุผลการลา..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className={cn(
                      "w-full py-3 text-white rounded-xl font-bold shadow-lg transition-all active:scale-[0.98]",
                      editingRequestId 
                        ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200" 
                        : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                    )}
                  >
                    {editingRequestId ? 'บันทึกการแก้ไข' : 'ยืนยันการจอง'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isUserManagementOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  จัดการสมาชิก
                </h3>
                <button onClick={() => setIsUserManagementOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">เพิ่มสมาชิกใหม่</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="ชื่อ-นามสกุล"
                        required
                        value={newUserForm.username}
                        onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value})}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <input 
                        type="password" 
                        placeholder="รหัสผ่าน (เริ่มต้น 1234)"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                        className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <button 
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                      >
                        เพิ่ม
                      </button>
                    </div>
                  </div>
                </form>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">รายชื่อสมาชิกปัจจุบัน ({users.length})</label>
                  <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                    {users.map((u) => (
                      <div key={u.username} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", getUserColor(u.username).bg)} />
                          <span className="text-sm font-medium text-slate-700">{u.username}</span>
                          {ADMIN_NAMES.includes(u.username) && (
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                              u.username === "ณัฐวัตร" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                            )}>
                              {u.username === "ณัฐวัตร" ? "Super Admin" : "Admin"}
                            </span>
                          )}
                        </div>
                        {!ADMIN_NAMES.includes(u.username) && (
                          <button 
                            onClick={() => handleDeleteUser(u.username)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                            title="ลบสมาชิก"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Undo Toast */}
      <AnimatePresence>
        {showUndo && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 px-6 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 no-print"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium">ทำรายการสำเร็จ</span>
            </div>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button 
              onClick={handleUndo}
              className="flex items-center gap-1.5 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              เลิกทำ (Undo)
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button 
              onClick={() => setShowUndo(false)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
