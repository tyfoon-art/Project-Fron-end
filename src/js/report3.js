import { supabaseClient } from './supabaseClient.js';

let selectedImageBase64 = '';
let secretImageBase64 = '';

function handleFiles(files) {
  if (!files || files.length === 0) return;
  const file = files[0];

  if (!file.type.startsWith('image/')) {
    alert('กรุณาเลือกไฟล์รูปภาพ (เช่น .jpg, .png, .webp) เท่านั้นครับ');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    selectedImageBase64 = e.target.result;
    renderPreview();
    clearImageError();
  };
  reader.readAsDataURL(file);
}

function renderPreview() {
  const previewGroup = document.getElementById('previewGroup');
  const previewContainer = document.getElementById('previewContainer');

  previewContainer.innerHTML = '';

  if (selectedImageBase64) {
    previewGroup.style.display = 'flex';
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
      <img src="${selectedImageBase64}" alt="Preview">
      <button type="button" class="btn-remove-img" onclick="removeImage()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
    previewContainer.appendChild(item);
  } else {
    previewGroup.style.display = 'none';
  }
}

function removeImage() {
  selectedImageBase64 = '';
  document.getElementById('fileInput').value = '';
  renderPreview();
}

function clearImageError() {
  document.getElementById('dropzoneBox').classList.remove('error');
  document.getElementById('imageError').style.display = 'none';
}

function handleSecretFile(files) {
  if (files.length > 0) {
    const file = files[0];

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปลับที่เป็นรูปภาพเท่านั้นครับ');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      secretImageBase64 = e.target.result;
      document.getElementById('secretImgTag').src = secretImageBase64;
      document.getElementById('secretPreviewContainer').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

function removeSecretImage() {
  secretImageBase64 = '';
  document.getElementById('secretFileInput').value = '';
  document.getElementById('secretPreviewContainer').style.display = 'none';
}

async function handleSubmit() {
  if (!selectedImageBase64) {
    document.getElementById('dropzoneBox').classList.add('error');
    document.getElementById('imageError').style.display = 'block';
    return;
  }

  // 1. ตรวจสอบ userId จาก localStorage
  const userId = localStorage.getItem('userId');
  if (!userId) {
    alert('กรุณาเข้าสู่ระบบก่อนโพสต์ประกาศ');
    window.location.href = 'login.html';
    return;
  }

  // 2. ดึงข้อมูลจาก sessionStorage ที่กรอกมาจากขั้นตอนที่ 1 และ 2
  const reportType = sessionStorage.getItem('report_type');   // 'lost' หรือ 'found'
  const title = sessionStorage.getItem('report_title');
  const categoryId = sessionStorage.getItem('report_category'); // ต้องเป็น UUID ของ category
  const baseDesc = sessionStorage.getItem('report_desc') || '';
  const incidentLocation = sessionStorage.getItem('report_incident_location');
  const date = sessionStorage.getItem('report_date');
  const time = sessionStorage.getItem('report_time');

  if (!reportType || !title || !categoryId || !incidentLocation || !date || !time) {
    alert('ข้อมูลจากขั้นตอนก่อนหน้าไม่ครบถ้วน กรุณาเริ่มกรอกใหม่ตั้งแต่ขั้นตอนที่ 1');
    window.location.href = 'report.html';
    return;
  }

  // รวม วันที่ + เวลา ให้เป็นรูปแบบ ISO Timestamp (timestamptz)
  const incidentDatetime = new Date(`${date}T${time}:00`).toISOString();

  const submitBtn = document.querySelector('.btn-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
    const btnSpan = submitBtn.querySelector('span');
    if (btnSpan) btnSpan.textContent = 'กำลังบันทึก...';
  }

  try {
    // 3. เรียกใช้ RPC create_report
    const { data: rows, error: createError } = await supabaseClient.rpc('create_report', {
      p_report_type: reportType,
      p_user_id: userId,            // UUID ของผู้ใช้
      p_item_name: title,
      p_category_id: categoryId,    // UUID ของหมวดหมู่
      p_description: baseDesc,
      p_image_url: selectedImageBase64,
      p_incident_location: incidentLocation,
      p_incident_datetime: incidentDatetime,
      p_secret_image: secretImageBase64 || null
    });

    if (createError) throw createError;

    // เคลียร์ข้อมูลฟอร์มใน sessionStorage เมื่อบันทึกสำเร็จ
    sessionStorage.clear();
    alert('โพสต์ประกาศเรียบร้อยแล้ว!');
    window.location.href = 'home.html';

  } catch (err) {
    console.error('บันทึกประกาศไม่สำเร็จ:', err);

    // เช็คข้อผิดพลาด Foreign Key (กรณี userId ไม่ตรงกับตาราง user_account)
    if (err.message && err.message.includes('item_reporter_id_fkey')) {
      alert('บัญชีผู้ใช้ของคุณไม่ตรงกับในระบบ กรุณาล็อกอินใหม่อีกครั้ง');
      localStorage.removeItem('userId');
      window.location.href = 'login.html';
      return;
    }

    alert('ไม่สามารถบันทึกประกาศได้: ' + (err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'));

    if (submitBtn) {
      submitBtn.disabled = false;
      const btnSpan = submitBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = 'ยืนยันการโพสต์ประกาศ';
    }
  }
}

// ผูกฟังก์ชันเข้ากับ window เพื่อรองรับ inline onclick/onchange ใน HTML
window.handleFiles = handleFiles;
window.removeImage = removeImage;
window.handleSecretFile = handleSecretFile;
window.removeSecretImage = removeSecretImage;
window.handleSubmit = handleSubmit;