// ==============================================================
// register.js — ลงทะเบียนด้วย custom auth (password_hash ในตาราง user_account)
// ไม่ใช้ Supabase Auth (auth.signUp) และไม่ query ตาราง user_account ตรงๆ
// อีกต่อไป (ตารางถูกปิด RLS ไว้ ต้องผ่าน RPC เท่านั้น) — ใช้ RPC "register_user"
// ซึ่งจะ hash รหัสผ่านด้วย pgcrypto และเช็คอีเมลซ้ำให้ในฝั่งฐานข้อมูล
// ==============================================================

import { supabaseClient } from './supabaseClient.js';

// จัดการปุ่มเปิด-ปิดรหัสผ่านช่องที่ 1
const toggleBtn1 = document.getElementById('togglePassBtn1');
const passwordInput = document.getElementById('password');
const toggleIcon1 = document.getElementById('togglePassIcon1');

toggleBtn1.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  toggleIcon1.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
});

// จัดการปุ่มเปิด-ปิดรหัสผ่านช่องที่ 2
const toggleBtn2 = document.getElementById('togglePassBtn2');
const confirmPasswordInput = document.getElementById('confirm-password');
const toggleIcon2 = document.getElementById('togglePassIcon2');

toggleBtn2.addEventListener('click', () => {
  const isPassword = confirmPasswordInput.type === 'password';
  confirmPasswordInput.type = isPassword ? 'text' : 'password';
  toggleIcon2.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
});

window.clearError = function (inputId, errorId) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (input) input.classList.remove('input-error');
  if (error) error.classList.remove('show');
};

function showError(inputId, errorId, msg) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (input) input.classList.add('input-error');
  if (error) {
    if (msg) error.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
    error.classList.add('show');
  }
}

function setLoading(isLoading) {
  const btn = document.querySelector('#registerForm button[type="submit"]');
  if (btn) btn.disabled = isLoading;
}

// จัดการฟอร์มลงทะเบียน
document.getElementById('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const fullname = document.getElementById('fullname').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  let isValid = true;
  let firstInvalidInput = null;

  if (!fullname) {
    showError('fullname', 'fullnameError', 'กรุณากรอกชื่อ-นามสกุล');
    isValid = false;
    if (!firstInvalidInput) firstInvalidInput = document.getElementById('fullname');
  }

  const isGmail = email.endsWith('@gmail.com');
  const isUp = email.endsWith('@up.ac.th');
  const isStaff = email.endsWith('@staff.com');

  if (!email) {
    showError('email', 'emailError', 'กรุณากรอกอีเมล');
    isValid = false;
    if (!firstInvalidInput) firstInvalidInput = document.getElementById('email');
  } else if (!isGmail && !isUp && !isStaff) {
    showError('email', 'emailError', 'ต้องใช้อีเมล @gmail.com, @up.ac.th หรือ @staff.com เท่านั้น');
    isValid = false;
    if (!firstInvalidInput) firstInvalidInput = document.getElementById('email');
  }
  // หมายเหตุ: ตัดการเช็คอีเมลซ้ำด้วย select ตรงๆ ออก เพราะตาราง user_account
  // ปิด RLS ไว้แล้ว (อ่าน/เขียนตรงไม่ได้) — RPC "register_user" จะเช็คซ้ำให้เอง
  // และคืน error 'EMAIL_ALREADY_EXISTS' กลับมาแทน (เช็คด้านล่างหลัง submit)

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasMinLength = password.length >= 8;

  if (!password) {
    showError('password', 'passwordError', 'กรุณากรอกรหัสผ่าน');
    isValid = false;
    if (!firstInvalidInput) firstInvalidInput = document.getElementById('password');
  } else if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumbers) {
    showError('password', 'passwordError', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข');
    isValid = false;
    if (!firstInvalidInput) firstInvalidInput = document.getElementById('password');
  }

  if (!confirmPassword) {
    showError('confirm-password', 'confirmPasswordError', 'กรุณากรอกยืนยันรหัสผ่าน');
    isValid = false;
    if (!firstInvalidInput) firstInvalidInput = document.getElementById('confirm-password');
  } else if (password !== confirmPassword) {
    showError('confirm-password', 'confirmPasswordError', 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
    isValid = false;
    if (!firstInvalidInput) firstInvalidInput = document.getElementById('confirm-password');
  }

  if (!isValid) {
    if (firstInvalidInput) firstInvalidInput.focus();
    return;
  }

  setLoading(true);

  try {
    // เรียก RPC เดียวจบ: hash รหัสผ่าน + เช็คโดเมน/อีเมลซ้ำ + insert
    // ทั้งหมดทำในฝั่งฐานข้อมูล ไม่มี password_hash หลุดออกมาที่ client
    const { data: rows, error: rpcError } = await supabaseClient.rpc('register_user', {
      p_full_name: fullname,
      p_email: email,
      p_password: password,
      p_phone_number: null
    });

    if (rpcError) {
      setLoading(false);
      if (rpcError.message.includes('EMAIL_ALREADY_EXISTS')) {
        showError('email', 'emailError', 'อีเมลนี้ถูกใช้งานในระบบแล้ว กรุณาใช้อีเมลอื่น');
        document.getElementById('email').focus();
      } else if (rpcError.message.includes('INVALID_EMAIL_DOMAIN')) {
        showError('email', 'emailError', 'ต้องใช้อีเมล @gmail.com, @up.ac.th หรือ @staff.com เท่านั้น');
        document.getElementById('email').focus();
      } else {
        console.error('Register RPC error:', rpcError);
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + rpcError.message);
      }
      return;
    }

    const insertedUser = rows[0];

    localStorage.setItem('userId', insertedUser.user_id);
    localStorage.setItem('userEmail', insertedUser.email);
    localStorage.setItem('userName', insertedUser.full_name);

    alert('ลงทะเบียนสำเร็จ! กรุณาเข้าสู่ระบบ');
    window.location.href = 'login.html';

  } catch (err) {
    console.error('Registration error:', err);
    setLoading(false);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง');
  }
});