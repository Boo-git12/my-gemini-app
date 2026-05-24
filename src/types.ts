export interface User {
  id: number;
  name: string;
  role: string;
  department: string;
}

export interface LeaveRequest {
  id: number;
  user_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: string;
  status: 'pending' | 'approved' | 'rejected';
  sort_order?: number;
  created_at: string;
}
