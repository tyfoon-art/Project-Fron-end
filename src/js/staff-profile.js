import { supabaseClient } from './supabaseClient.js';

/* ============================================================================
   ข้อสมมติฐานเรื่องโครงสร้างตาราง/สตอเรจ (แก้ชื่อ table/column/bucket ให้ตรงกับของจริงได้ที่นี่)
   ----------------------------------------------------------------------------
   - auth.users               : ผู้ใช้ที่ล็อกอินอยู่ ดึงผ่าน supabaseClient.auth.getUser()
   - public.staff_profile     : id (uuid, FK -> auth.users.id, PK),
                                 full_name, email, phone, avatar_url, updated_at
     (ถ้าชื่อ table จริงไม่ตรง ให้แก้ค่าคงที่ PROFILE_TABLE ด้านล่าง)
   - storage bucket "avatars" : เก็บรูปโปรไฟล์ path = `${userId}/avatar-${timestamp}.${ext}`
   ============================================================================ */

const PROFILE_TABLE = 'staff_profile';
const AVATAR_BUCKET = 'avatars';

const DEFAULT_AVATAR_URL =
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80';

let currentUserId = null;
let toastTimer = null;

/* ============================================================================
   TOAST
   ============================================================================ */

function showToast() {
  const toast = document.getElementById('toast-success');
  if (!toast) return;

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ============================================================================
   LOAD CURRENT USER + PROFILE
   ============================================================================ */

async function loadProfile() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !userData?.user) {
    console.error('ไม่พบผู้ใช้ที่เข้าสู่ระบบ:', userError);
    window.location.href = 'login.html';
    return;
  }

  currentUserId = userData.user.id;

  const { data: profile, error: profileError } = await supabaseClient
    .from(PROFILE_TABLE)
    .select('full_name, email, phone, avatar_url')
    .eq('id', currentUserId)
    .maybeSingle();

  if (profileError) {
    console.error('ไม่สามารถโหลดข้อมูลโปรไฟล์ได้:', profileError);
  }

  const fullName = profile?.full_name || userData.user.user_metadata?.full_name || '';
  const email = profile?.email || userData.user.email || '';
  const phone = profile?.phone || '';
  const avatarUrl = profile?.avatar_url || DEFAULT_AVATAR_URL;

  document.getElementById('input-fullname').value = fullName;
  document.getElementById('input-email').value = email;
  document.getElementById('input-phone').value = phone;
  document.getElementById('display-fullname').textContent = fullName || '-';
  document.getElementById('main-avatar').src = avatarUrl;
}

/* ============================================================================
   SAVE PROFILE
   ============================================================================ */

function setSavingUI(saving) {
  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = saving;
  saveBtn.innerHTML = saving
    ? '<i class="fa-solid fa-spinner fa-spin"></i> <span>กำลังบันทึก...</span>'
    : '<i class="fa-regular fa-floppy-disk"></i> <span>บันทึกข้อมูล</span>';
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  if (!currentUserId) return;

  const fullname = document.getElementById('input-fullname').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const phone = document.getElementById('input-phone').value.trim();

  if (!fullname || !email || !phone) {
    alert('กรุณากรอกข้อมูลโปรไฟล์ให้ครบถ้วนก่อนบันทึก!');
    return;
  }

  setSavingUI(true);

  try {
    const { error } = await supabaseClient
      .from(PROFILE_TABLE)
      .upsert({
        id: currentUserId,
        full_name: fullname,
        email,
        phone,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    document.getElementById('display-fullname').textContent = fullname;
    showToast();
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการบันทึกโปรไฟล์:', error);
    alert('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
  } finally {
    setSavingUI(false);
  }
}

/* ============================================================================
   AVATAR UPLOAD
   ============================================================================ */

async function handleAvatarChange(event) {
  const file = event.target.files?.[0];
  if (!file || !currentUserId) return;

  const mainAvatar = document.getElementById('main-avatar');
  const previousSrc = mainAvatar.src;

  try {
    const extension = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
    const path = `${currentUserId}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseClient
      .storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(path);

    const avatarUrl = publicUrlData?.publicUrl || '';

    const { error: updateError } = await supabaseClient
      .from(PROFILE_TABLE)
      .upsert({
        id: currentUserId,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      });

    if (updateError) throw updateError;

    mainAvatar.src = avatarUrl;
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการอัปโหลดรูปโปรไฟล์:', error);
    mainAvatar.src = previousSrc;
    alert('ไม่สามารถอัปโหลดรูปโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง');
  } finally {
    event.target.value = '';
  }
}

/* ============================================================================
   LOGOUT MODAL
   ============================================================================ */

function openLogoutModal() {
  const modal = document.getElementById('logout-modal');
  modal.classList.remove('hidden');
  requestAnimationFrame(() => modal.classList.add('show'));
}

function closeLogoutModal() {
  const modal = document.getElementById('logout-modal');
  modal.classList.remove('show');
  setTimeout(() => modal.classList.add('hidden'), 200);
}

async function handleLogoutConfirm() {
  const confirmBtn = document.getElementById('confirm-logout-btn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'กำลังออกจากระบบ...';

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('เกิดข้อผิดพลาดขณะออกจากระบบ:', error);
  } finally {
    window.location.href = 'login.html';
  }
}

/* ============================================================================
   EVENT WIRING
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('profile-form')?.addEventListener('submit', handleProfileSubmit);
  document.getElementById('change-photo-btn')?.addEventListener('click', () => {
    document.getElementById('profile-image-input')?.click();
  });
  document.getElementById('profile-image-input')?.addEventListener('change', handleAvatarChange);

  document.getElementById('open-logout-modal-btn')?.addEventListener('click', openLogoutModal);
  document.getElementById('cancel-logout-btn')?.addEventListener('click', closeLogoutModal);
  document.getElementById('confirm-logout-btn')?.addEventListener('click', handleLogoutConfirm);

  document.getElementById('logout-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'logout-modal') closeLogoutModal();
  });

  document.addEventListener('keydown', (event) => {
    const modal = document.getElementById('logout-modal');
    if (event.key === 'Escape' && modal && modal.classList.contains('show')) {
      closeLogoutModal();
    }
  });

  loadProfile();
});