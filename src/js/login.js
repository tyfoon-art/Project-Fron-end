import { supabaseClient } from './supabaseClient.js';

const STAFF_DOMAIN = 'staff.com';
const USER_DOMAINS = ['gmail.com', 'up.ac.th'];

function getEmailDomain(email) {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
}

function isAllowedDomain(email) {
  const domain = getEmailDomain(email);
  return domain === STAFF_DOMAIN || USER_DOMAINS.includes(domain);
}

const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');
const toggleIcon = document.getElementById('togglePasswordIcon');

togglePassword.addEventListener('click', function () {
  const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
  passwordInput.setAttribute('type', type);
  toggleIcon.classList.toggle('fa-eye');
  toggleIcon.classList.toggle('fa-eye-slash');
});

window.clearError = function (inputId, errorId) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (input) input.classList.remove('input-error');
  if (error) error.classList.remove('show');
  document.getElementById('loginAlertError').classList.remove('show');
};

function showFieldError(inputId, errorId, msg) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (input) input.classList.add('input-error');
  if (error) {
    if (msg) error.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
    error.classList.add('show');
  }
}

function showAlert(html) {
  const alertBox = document.getElementById('loginAlertError');
  const alertText = document.getElementById('loginAlertText');
  alertText.innerHTML = html;
  alertBox.classList.add('show');
}

function setLoading(isLoading) {
  const btn = document.getElementById('btnLoginSubmit');
  const btnText = document.getElementById('btnLoginText');
  btn.disabled = isLoading;
  btnText.textContent = isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ';
}

async function handleLogin(event) {
  event.preventDefault();

  const emailInput = document.getElementById('email');
  const passwordInputEl = document.getElementById('password');
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInputEl.value;

  let isValid = true;
  if (!email) {
    showFieldError('email', 'emailError', 'กรุณากรอกอีเมล');
    isValid = false;
  }
  if (!password) {
    showFieldError('password', 'passwordError', 'กรุณากรอกรหัสผ่าน');
    isValid = false;
  }
  if (email && !isAllowedDomain(email)) {
    showFieldError(
      'email',
      'emailError',
      'ผู้ใช้ทั่วไปใช้อีเมล @gmail.com หรือ @up.ac.th ส่วนเจ้าหน้าที่ใช้อีเมล @staff.com เท่านั้น'
    );
    isValid = false;
  }

  if (!isValid) return;

  setLoading(true);

  try {
    // เรียก RPC ที่ตรวจสอบรหัสผ่านกับ password_hash โดยตรงในฝั่งฐานข้อมูล
    // (ไม่มีการส่ง password_hash กลับมาที่ client เลย)
    const { data: rows, error: rpcError } = await supabaseClient
      .rpc('verify_login', { p_email: email, p_password: password });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      setLoading(false);
      showAlert('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง');
      return;
    }

    if (!rows || rows.length === 0) {
      setLoading(false);
      passwordInputEl.classList.add('input-error');
      showAlert('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      return;
    }

    const profile = rows[0];

    localStorage.setItem('userId', profile.user_id);
    localStorage.setItem('userEmail', profile.email);
    localStorage.setItem('userName', profile.full_name);

    if (profile.role === 'staff') {
      localStorage.setItem('userRole', 'staff');
      localStorage.setItem('isStaff', 'true');
      window.location.href = 'staff-dashboard.html';
    } else {
      localStorage.removeItem('userRole');
      localStorage.removeItem('isStaff');
      window.location.href = 'home.html';
    }
  } catch (err) {
    console.error('เข้าสู่ระบบไม่สำเร็จ:', err);
    setLoading(false);
    showAlert('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง');
  }
}

document.getElementById('loginForm').addEventListener('submit', handleLogin);