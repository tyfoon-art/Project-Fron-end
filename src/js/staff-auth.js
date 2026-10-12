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

// ผู้ดูแลระบบรับผิดชอบเฉพาะการจัดการสถานที่เก็บ — เข้าได้แค่หน้าจัดการสถานที่เก็บกับหน้าโปรไฟล์
// หน้าอื่นของเจ้าหน้าที่ (แดชบอร์ด, รับของเข้าคลัง, ตรวจคำร้อง ฯลฯ) จะถูกพากลับมาหน้าจัดการสถานที่เก็บ
const ADMIN_STORAGE_PAGE = 'admin-storage-points.html';
const ADMIN_ALLOWED_PAGES = [ADMIN_STORAGE_PAGE, 'staff-profile.html'];

function showAdminNavOnly() {
  const navMenu = document.querySelector('.nav-menu');
  if (navMenu) {
    const active = currentPage === ADMIN_STORAGE_PAGE ? ' active' : '';
    navMenu.innerHTML = `<li><a href="${ADMIN_STORAGE_PAGE}" class="nav-link${active}">สถานที่เก็บ</a></li>`;
  }

  const brand = document.querySelector('.nav-brand');
  if (brand) brand.setAttribute('href', ADMIN_STORAGE_PAGE);
}

const currentPage = window.location.pathname.split('/').pop();

if (isAdmin()) {
  if (!ADMIN_ALLOWED_PAGES.includes(currentPage)) {
    window.location.replace(ADMIN_STORAGE_PAGE);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showAdminNavOnly);
  } else {
    showAdminNavOnly();
  }
}
