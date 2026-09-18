// ==============================================================
// profile.js — ตรรกะของหน้า "ข้อมูลส่วนตัว"
// แก้ไขให้ตรงกับ schema.sql:
//   - ตาราง user_account ใช้คอลัมน์ "role" (enum user_role_enum: user/staff/admin)
//     ไม่ใช่ "user_type" อย่างที่โค้ดเดิมอ้างถึง
//   - enum report_type_enum เก็บค่าเป็นตัวพิมพ์เล็ก ('lost' / 'found')
//     ไม่ใช่ 'Lost' / 'Found'
//   - enum claim_status_enum เก็บค่าเป็นตัวพิมพ์เล็ก ('approved' ฯลฯ)
//     ไม่ใช่ 'Approved'
//   - ตาราง user_account ไม่มีคอลัมน์ gender จึงตัดช่อง "เพศ" ออกจากฟอร์ม
//     และตัดการอ่าน/บันทึกค่านี้ออกทั้งหมดแล้ว
// ==============================================================

import { supabaseClient } from './supabaseClient.js';

// กติกาโดเมนอีเมลเดียวกับหน้า login.html: เจ้าหน้าที่ต้องใช้ @staff.com เท่านั้น
// ผู้ใช้ทั่วไปต้องใช้ @gmail.com หรือ @up.ac.th เท่านั้น ใช้ตรวจตอนผู้ใช้แก้ไขอีเมลในหน้านี้
const STAFF_DOMAIN = 'staff.com';
const USER_DOMAINS = ['gmail.com', 'up.ac.th'];
const DEFAULT_AVATAR_URL = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=250&auto=format&fit=crop';

function getEmailDomain(email) {
  const parts = (email || '').split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
}

function isDomainAllowedForRole(email, role) {
  const domain = getEmailDomain(email);
  return role === 'staff' ? domain === STAFF_DOMAIN : USER_DOMAINS.includes(domain);
}

// เก็บ record ผู้ใช้ปัจจุบันที่โหลดมาจากตาราง user_account (มี user_id ไว้ใช้ตอน update)
let currentUser = null;
// เก็บรูปที่ผู้ใช้เพิ่งเลือกไว้ชั่วคราว รอบันทึกจริงตอนกดปุ่ม "บันทึกข้อมูล"
let pendingAvatarDataUrl = null;

// ============================================================
// โหลดข้อมูลผู้ใช้จริงจาก Supabase (ตาราง user_account)
// ใช้ session ที่ยืนยันแล้วจาก Supabase Auth เป็นแหล่งความจริง
// (ไม่อ่าน localStorage มาระบุตัวตนตรงๆ เพราะแก้ไขผ่าน DevTools ได้)
// ============================================================
async function loadUserData() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const email = session.user.email;

  const { data: user, error } = await supabaseClient
    .from('user_account')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    console.error('โหลดข้อมูลผู้ใช้ไม่สำเร็จ:', error);
    window.location.href = 'login.html';
    return;
  }

  currentUser = user;

  document.getElementById('displayName').textContent = user.full_name;
  document.getElementById('nameInput').value = user.full_name || '';
  document.getElementById('emailInput').value = user.email || '';
  document.getElementById('phoneInput').value = user.phone_number || '';
  // แก้ไข: user_account.role (ไม่ใช่ user_type) คือคอลัมน์จริงตาม schema
  document.getElementById('userRoleDisplay').textContent =
    user.role === 'staff' ? 'เจ้าหน้าที่ (Staff)' : user.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานทั่วไป';

  document.getElementById('avatarPreview').src = user.avatar_url || DEFAULT_AVATAR_URL;

  // sync ค่าที่หน้าอื่นใช้อ้างอิงผู้ใช้ปัจจุบันให้ตรงชุด key เดียวกับ login.html
  localStorage.setItem('userId', user.user_id);
  localStorage.setItem('userEmail', user.email);
  localStorage.setItem('userName', user.full_name);

  await loadStats(user.user_id);
}

// ============================================================
// สถิติการใช้งาน: นับจากตาราง report (แจ้งหาย/แจ้งพบ) และ claim (รับคืนสำเร็จ)
// แก้ไข: ค่า enum ใน DB เป็นตัวพิมพ์เล็กทั้งหมด ('lost' / 'found' / 'approved')
// ============================================================
async function loadStats(userId) {
  try {
    const [lostRes, foundRes, completedRes] = await Promise.all([
      supabaseClient
        .from('report')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('report_type', 'lost'),
      supabaseClient
        .from('report')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('report_type', 'found'),
      supabaseClient
        .from('claim')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('claim_status', 'approved')
    ]);

    document.getElementById('statLostCount').textContent = lostRes.count ?? 0;
    document.getElementById('statFoundCount').textContent = foundRes.count ?? 0;
    document.getElementById('statCompletedCount').textContent = completedRes.count ?? 0;
  } catch (err) {
    console.error('โหลดสถิติไม่สำเร็จ:', err);
  }
}

function previewAvatar(event) {
  const file = event.target.files[0];
  const errorEl = document.getElementById('avatarError');
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      errorEl.style.display = 'block';
      event.target.value = '';
      return;
    }
    errorEl.style.display = 'none';

    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById('avatarPreview').src = e.target.result;
      pendingAvatarDataUrl = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function clearError(inputId, errorId) {
  document.getElementById(inputId).classList.remove('error');
  document.getElementById(errorId).style.display = 'none';
}

// ============================================================
// บันทึกข้อมูลโปรไฟล์: UPDATE ตาราง user_account จริง
// ============================================================
async function handleSave(event) {
  event.preventDefault();

  if (!currentUser) return;

  let isValid = true;
  const nameInput = document.getElementById('nameInput');
  const emailInput = document.getElementById('emailInput');
  const phoneInput = document.getElementById('phoneInput');

  if (!nameInput.value.trim()) {
    document.getElementById('nameError').textContent = 'กรุณากรอกชื่อ - นามสกุล';
    document.getElementById('nameError').style.display = 'block';
    nameInput.classList.add('error');
    isValid = false;
  }

  const updatedEmail = emailInput.value.trim().toLowerCase();

  if (!updatedEmail || !updatedEmail.includes('@')) {
    document.getElementById('emailError').textContent = 'กรุณากรอกอีเมลให้ถูกต้อง';
    document.getElementById('emailError').style.display = 'block';
    emailInput.classList.add('error');
    isValid = false;
  } else if (!isDomainAllowedForRole(updatedEmail, currentUser.role)) {
    document.getElementById('emailError').textContent =
      currentUser.role === 'staff'
        ? 'บัญชีเจ้าหน้าที่ต้องใช้อีเมล @staff.com เท่านั้น'
        : 'ผู้ใช้ทั่วไปต้องใช้อีเมล @gmail.com หรือ @up.ac.th เท่านั้น';
    document.getElementById('emailError').style.display = 'block';
    emailInput.classList.add('error');
    isValid = false;
  }

  if (!phoneInput.value.trim()) {
    document.getElementById('phoneError').textContent = 'กรุณากรอกเบอร์โทรศัพท์';
    document.getElementById('phoneError').style.display = 'block';
    phoneInput.classList.add('error');
    isValid = false;
  }

  if (!isValid) return;

  const updatedName = nameInput.value.trim();
  const updatedPhone = phoneInput.value.trim();
  const emailChanged = updatedEmail !== (currentUser.email || '').toLowerCase();

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;

  try {
    if (emailChanged) {
      const { error: authUpdateError } = await supabaseClient.auth.updateUser({ email: updatedEmail });
      if (authUpdateError) throw authUpdateError;
    }

    const updatePayload = {
      full_name: updatedName,
      email: updatedEmail,
      phone_number: updatedPhone
    };

    if (pendingAvatarDataUrl) {
      updatePayload.avatar_url = pendingAvatarDataUrl;
    }

    const { error } = await supabaseClient
      .from('user_account')
      .update(updatePayload)
      .eq('user_id', currentUser.user_id);

    if (error) throw error;

    localStorage.setItem('userEmail', updatedEmail);
    localStorage.setItem('userName', updatedName);

    currentUser = { ...currentUser, ...updatePayload };
    pendingAvatarDataUrl = null;

    document.getElementById('displayName').textContent = updatedName;

    const successText = document.getElementById('saveSuccessText');
    successText.textContent = emailChanged
      ? 'บันทึกข้อมูลเรียบร้อยแล้ว! กรุณายืนยันอีเมลใหม่ตามลิงก์ที่ระบบส่งไปให้'
      : 'บันทึกข้อมูลเรียบร้อยแล้ว!';
    successText.style.display = 'block';
    setTimeout(() => {
      successText.style.display = 'none';
    }, 4000);
  } catch (err) {
    console.error('บันทึกข้อมูลไม่สำเร็จ:', err);
    alert('บันทึกข้อมูลไม่สำเร็จ: ' + err.message);
  } finally {
    saveBtn.disabled = false;
  }
}

// ฟังก์ชันจัดการเปิด-ปิด Modal ยืนยันออกจากระบบ
function openLogoutModal() {
  document.getElementById('logoutModal').classList.add('active');
}

function closeLogoutModal() {
  document.getElementById('logoutModal').classList.remove('active');
}

async function confirmLogout() {
  await supabaseClient.auth.signOut();
  localStorage.removeItem('userId');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('isStaff');
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  loadUserData();
});

// script เป็น type="module" จึงมี scope ปิด ต้อง export ฟังก์ชันที่ HTML
// เรียกผ่าน onclick/onchange/onsubmit ออกไปที่ window เอง
window.handleSave = handleSave;
window.clearError = clearError;
window.previewAvatar = previewAvatar;
window.openLogoutModal = openLogoutModal;
window.closeLogoutModal = closeLogoutModal;
window.confirmLogout = confirmLogout;