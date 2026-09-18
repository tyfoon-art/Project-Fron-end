// ==============================================================
// forgotpassword.js — ตรรกะของหน้า "ลืมรหัสผ่าน"
// ตรวจกับ schema.sql แล้ว: .select('email').eq('email', email') ใช้ชื่อ
// คอลัมน์ตรงกับตาราง user_account อยู่แล้ว ไม่ต้องแก้อะไร
// ==============================================================

import { supabaseClient } from '/src/supabaseClient.js';

function clearAlert() {
  document.getElementById('email').classList.remove('input-error');
  document.getElementById('alertError').classList.remove('show');
  document.getElementById('alertSuccess').classList.remove('show');
}

document.getElementById('email').addEventListener('input', clearAlert);

document.getElementById('forgotForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const emailInput = document.getElementById('email');
  const email = emailInput.value.trim().toLowerCase();
  const alertError = document.getElementById('alertError');
  const alertErrorText = document.getElementById('alertErrorText');
  const alertSuccess = document.getElementById('alertSuccess');
  const submitBtn = document.getElementById('submitBtn');

  clearAlert();

  if (!email) {
    emailInput.classList.add('input-error');
    alertErrorText.textContent = 'กรุณากรอกอีเมลของคุณ';
    alertError.classList.add('show');
    return;
  }

  try {
    // 1. ตรวจสอบว่ามีอีเมลนี้อยู่ในตาราง user_account จริงหรือไม่
    const { data: userRecord, error: checkError } = await supabaseClient
      .from('user_account')
      .select('email')
      .eq('email', email)
      .single();

    if (checkError || !userRecord) {
      emailInput.classList.add('input-error');
      alertErrorText.textContent = 'ไม่พบบัญชีนี้ในระบบ กรุณาตรวจสอบอีเมลหรือลงทะเบียนใหม่';
      alertError.classList.add('show');
      return;
    }

    // 2. ส่งลิงก์รีเซ็ตรหัสผ่านผ่าน Supabase Auth
    const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login.html',
    });

    if (resetError) {
      throw resetError;
    }

    alertSuccess.classList.add('show');
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';

    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2500);

  } catch (err) {
    console.error('Password reset error:', err);
    emailInput.classList.add('input-error');
    alertErrorText.textContent = 'เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้');
    alertError.classList.add('show');
  }
});