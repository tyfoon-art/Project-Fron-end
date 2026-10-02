/* ============================================================================
   Staff auth guard (custom login — ไม่ใช้ Supabase Auth)
   ----------------------------------------------------------------------------
   login.js เก็บข้อมูลผู้ใช้ใน localStorage:
     userId | userEmail | userName | userRole ('staff' | 'admin') | isStaff ('true')
   การ import ไฟล์นี้จะตรวจสิทธิ์ทันที และเด้งไปหน้า login ถ้าไม่ใช่เจ้าหน้าที่/แอดมิน
   ============================================================================ */

const LOGIN_PAGE = 'login.html';

function readSession() {
  try {
    return {
      userId: localStorage.getItem('userId') || '',
      email: localStorage.getItem('userEmail') || '',
      fullName: localStorage.getItem('userName') || '',
      role: localStorage.getItem('userRole') || '',
      isStaff: localStorage.getItem('isStaff') === 'true',
    };
  } catch {
    return { userId: '', email: '', fullName: '', role: '', isStaff: false };
  }
}

export const staffSession = readSession();

export function isAdmin() {
  return staffSession.role === 'admin';
}

export function isStaff() {
  return staffSession.isStaff || staffSession.role === 'staff' || isAdmin();
}

export function requireStaff() {
  if (!isStaff()) {
    window.location.replace(LOGIN_PAGE);
    return false;
  }
  return true;
}

if (!isStaff()) {
  window.location.replace(LOGIN_PAGE);
}
