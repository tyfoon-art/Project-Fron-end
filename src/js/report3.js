import { supabaseClient } from './supabaseClient.js';
import { saveDraftImage, loadDraftImage, clearDraftImages } from './reportDraftImages.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const IMAGE_TOO_LARGE_MSG = 'รูปภาพมีขนาดเกิน 5 MB กรุณาเลือกรูปใหม่';
const IMAGE_REQUIRED_MSG = 'กรุณาอัปโหลดไฟล์รูปภาพสิ่งของ (ภาพถ่าย) อย่างน้อย 1 รูป';

// รูปที่ผู้ใช้เลือกใหม่ในรอบนี้
let selectedImageBase64 = '';
let secretImageBase64 = '';

// รูปเดิมของโพสต์ (เฉพาะโหมดแก้ไข) — ถ้าไม่เลือกรูปใหม่ ระบบจะคงรูปเดิมไว้
let existingImageUrl = '';
let existingSecretImage = '';

// รูปตำหนิลับมีเฉพาะโพสต์แจ้งพบ — โพสต์แจ้งหายซ่อนช่องอัปโหลดและไม่ส่งรูปลับ
const isLostReport = sessionStorage.getItem('report_type') === 'lost';

// โหมดแก้ไข: report.js เก็บ id ของโพสต์เดิมไว้ให้ตอนเปิดหน้าแก้ไข
const editItemId = sessionStorage.getItem('report_edit_item_id');
const editReportId = sessionStorage.getItem('report_edit_report_id');
const isEditMode = !!(editItemId && editReportId);

const setText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

if (isLostReport) {
  document.getElementById('secretUploadBox')?.remove();
  setText('reportSubtitle', 'เพิ่มรูปถ่ายสิ่งของที่หาย เพื่อให้ผู้พบเห็นจำได้ง่ายขึ้น');
  setText('stepTitle', 'รูปภาพสิ่งของ');
  setText('stepLabel3', 'รูปภาพ');
}

if (isEditMode) {
  const heading = document.querySelector('.report-header h1');
  if (heading) heading.textContent = 'แก้ไขโพสต์';
  const btnSpan = document.querySelector('.btn-submit span');
  if (btnSpan) btnSpan.textContent = 'บันทึกการแก้ไข';
}

document.addEventListener('DOMContentLoaded', async () => {
  // รูปที่เลือกค้างไว้ก่อนกด "ย้อนกลับ" ไปขั้นตอนก่อนหน้า
  selectedImageBase64 = await loadDraftImage('main');
  if (!isLostReport) secretImageBase64 = await loadDraftImage('secret');

  if (isEditMode) await loadExistingImages();

  renderPreview();
  renderSecretPreview();
});

async function loadExistingImages() {
  const { data: item, error } = await supabaseClient
    .from('item')
    .select('image_url')
    .eq('item_id', editItemId)
    .single();

  if (error) console.error('โหลดรูปเดิมของโพสต์ไม่สำเร็จ:', error);
  existingImageUrl = (item && item.image_url) || '';

  if (isLostReport) return;

  const { data: note, error: noteError } = await supabaseClient.rpc('get_staff_defect_note', {
    p_item_id: editItemId,
    p_user_id: localStorage.getItem('userId') || null
  });

  if (noteError) console.error('โหลดรูปตำหนิลับเดิมไม่สำเร็จ:', noteError);
  // ตำหนิลับอาจเป็นข้อความ (กรณีเจ้าหน้าที่บันทึก) — แสดงตัวอย่างเฉพาะที่เป็นรูป
  existingSecretImage = /^(data:image\/|https?:\/\/)/i.test(note || '') ? note : '';
}

function showImageError(message) {
  const errorEl = document.getElementById('imageError');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  document.getElementById('dropzoneBox').classList.add('error');
}

function handleFiles(files) {
  if (!files || files.length === 0) return;
  const file = files[0];

  if (!file.type.startsWith('image/')) {
    alert('กรุณาเลือกไฟล์รูปภาพ (เช่น .jpg, .png, .webp) เท่านั้นครับ');
    document.getElementById('fileInput').value = '';
    return;
  }

  // ตรวจขนาดทันทีที่เลือก — ไม่รับรูปที่เกิน 5 MB
  if (file.size > MAX_IMAGE_SIZE) {
    document.getElementById('fileInput').value = '';
    showImageError(IMAGE_TOO_LARGE_MSG);
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    selectedImageBase64 = e.target.result;
    saveDraftImage('main', selectedImageBase64);
    renderPreview();
    clearImageError();
  };
  reader.readAsDataURL(file);
}

function renderPreview() {
  const previewGroup = document.getElementById('previewGroup');
  const previewContainer = document.getElementById('previewContainer');
  const imageSrc = selectedImageBase64 || existingImageUrl;

  previewContainer.innerHTML = '';

  if (imageSrc) {
    previewGroup.style.display = 'flex';
    const item = document.createElement('div');
    item.className = 'preview-item';
    // รูปเดิมของโพสต์ลบออกไม่ได้ (โพสต์ต้องมีรูปเสมอ) — เปลี่ยนได้โดยเลือกรูปใหม่ทับ
    item.innerHTML = `
      <img src="${imageSrc}" alt="Preview">
      ${selectedImageBase64 ? `
      <button type="button" class="btn-remove-img" onclick="removeImage()">
        <i class="fa-solid fa-xmark"></i>
      </button>` : ''}
    `;
    previewContainer.appendChild(item);
  } else {
    previewGroup.style.display = 'none';
  }
}

function removeImage() {
  selectedImageBase64 = '';
  saveDraftImage('main', '');
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
    const secretError = document.getElementById('secretImageError');

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปลับที่เป็นรูปภาพเท่านั้นครับ');
      document.getElementById('secretFileInput').value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      document.getElementById('secretFileInput').value = '';
      secretError.textContent = IMAGE_TOO_LARGE_MSG;
      secretError.style.display = 'block';
      return;
    }

    secretError.style.display = 'none';

    const reader = new FileReader();
    reader.onload = function (e) {
      secretImageBase64 = e.target.result;
      saveDraftImage('secret', secretImageBase64);
      renderSecretPreview();
    };
    reader.readAsDataURL(file);
  }
}

function renderSecretPreview() {
  const container = document.getElementById('secretPreviewContainer');
  if (!container) return; // โพสต์แจ้งหายไม่มีช่องรูปลับ

  const imageSrc = secretImageBase64 || existingSecretImage;
  container.style.display = imageSrc ? 'block' : 'none';
  if (imageSrc) document.getElementById('secretImgTag').src = imageSrc;

  // ปุ่มลบใช้ยกเลิกรูปที่เพิ่งเลือกใหม่เท่านั้น (รูปลับเดิมเปลี่ยนได้โดยเลือกรูปใหม่ทับ)
  const btnRemove = document.getElementById('btnRemoveSecret');
  if (btnRemove) btnRemove.style.display = secretImageBase64 ? '' : 'none';
}

function removeSecretImage() {
  secretImageBase64 = '';
  saveDraftImage('secret', '');
  document.getElementById('secretFileInput').value = '';
  renderSecretPreview();
}

async function handleSubmit() {
  if (!selectedImageBase64 && !existingImageUrl) {
    showImageError(IMAGE_REQUIRED_MSG);
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
    window.location.href = isEditMode ? `report.html?id=${editItemId}&mode=edit` : 'report.html';
    return;
  }

  // รวม วันที่ + เวลา ให้เป็นรูปแบบ ISO Timestamp (timestamptz)
  const incidentDatetime = new Date(`${date}T${time}:00`).toISOString();

  const submitBtn = document.querySelector('.btn-submit');
  const submitLabel = isEditMode ? 'บันทึกการแก้ไข' : 'ยืนยันการโพสต์ประกาศ';
  if (submitBtn) {
    submitBtn.disabled = true;
    const btnSpan = submitBtn.querySelector('span');
    if (btnSpan) btnSpan.textContent = 'กำลังบันทึก...';
  }

  try {
    if (isEditMode) {
      // 3ก. แก้ไขโพสต์เดิมผ่าน RPC update_report
      // ส่ง null = ไม่เปลี่ยนรูป (ฝั่ง server จะคงรูปเดิมไว้)
      const { error: updateError } = await supabaseClient.rpc('update_report', {
        p_report_id: editReportId,
        p_user_id: userId,
        p_item_name: title,
        p_category_id: categoryId,
        p_description: baseDesc,
        p_image_url: selectedImageBase64 || null,
        p_incident_location: incidentLocation,
        p_incident_datetime: incidentDatetime,
        p_secret_image: isLostReport ? null : (secretImageBase64 || null)
      });

      if (updateError) throw updateError;
    } else {
      // 3ข. สร้างโพสต์ใหม่ผ่าน RPC create_report
      const { error: createError } = await supabaseClient.rpc('create_report', {
        p_report_type: reportType,
        p_user_id: userId,            // UUID ของผู้ใช้
        p_item_name: title,
        p_category_id: categoryId,    // UUID ของหมวดหมู่
        p_description: baseDesc,
        p_image_url: selectedImageBase64,
        p_incident_location: incidentLocation,
        p_incident_datetime: incidentDatetime,
        p_secret_image: isLostReport ? null : (secretImageBase64 || null)
      });

      if (createError) throw createError;
    }

    // เคลียร์ข้อมูลฟอร์มใน sessionStorage เมื่อบันทึกสำเร็จ
    sessionStorage.clear();
    await clearDraftImages();

    if (isEditMode) {
      alert('บันทึกการแก้ไขเรียบร้อยแล้ว!');
      window.location.href = `detail.html?id=${editItemId}`;
    } else {
      alert('โพสต์ประกาศเรียบร้อยแล้ว!');
      window.location.href = 'home.html';
    }

  } catch (err) {
    console.error('บันทึกประกาศไม่สำเร็จ:', err);
    const msg = err.message || '';

    // เช็คข้อผิดพลาด Foreign Key (กรณี userId ไม่ตรงกับตาราง user_account)
    if (msg.includes('item_reporter_id_fkey')) {
      alert('บัญชีผู้ใช้ของคุณไม่ตรงกับในระบบ กรุณาล็อกอินใหม่อีกครั้ง');
      localStorage.removeItem('userId');
      window.location.href = 'login.html';
      return;
    }

    if (msg.includes('NOT_OWNER')) {
      alert('คุณไม่ใช่เจ้าของโพสต์นี้ จึงไม่สามารถแก้ไขได้');
    } else if (msg.includes('EDIT_NOT_ALLOWED')) {
      alert('โพสต์แจ้งพบสามารถแก้ไขได้เฉพาะตอนสถานะ "รอตรวจสอบ" เท่านั้น');
    } else if (msg.includes('REPORT_NOT_FOUND')) {
      alert('ไม่พบโพสต์นี้ในระบบ อาจถูกลบไปแล้ว');
    } else {
      alert('ไม่สามารถบันทึกประกาศได้: ' + (msg || 'เกิดข้อผิดพลาด กรุณาลองใหม่'));
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      const btnSpan = submitBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = submitLabel;
    }
  }
}

// ผูกฟังก์ชันเข้ากับ window เพื่อรองรับ inline onclick/onchange ใน HTML
window.handleFiles = handleFiles;
window.removeImage = removeImage;
window.handleSecretFile = handleSecretFile;
window.removeSecretImage = removeSecretImage;
window.handleSubmit = handleSubmit;
