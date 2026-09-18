import { supabaseClient } from './supabaseClient.js';

// หมายเหตุสำคัญเทียบกับ schema จริง (public.item / public.report):
// - item มีคอลัมน์รูปได้แค่คอลัมน์เดียวคือ "image_url" (ไม่ใช่ "image") และไม่มี "item_date" หรือ "location_id"
// - item.status เป็น enum item_status_enum ที่มีค่าตายตัวแค่ 5 ค่า ('รอตรวจสอบ', 'อยู่ที่จุดรับฝาก', ...)
//   ไม่มีค่า 'พบใหม่'/'แจ้งหาย' จึงปล่อยให้ DB ใช้ค่า default 'รอตรวจสอบ' แทน ไม่ set เองจากฝั่ง client
// - report ไม่มีคอลัมน์ description / item_title / category_id / location_id / image เลย
//   มีแค่ report_id, report_type, user_id, item_id, incident_location (text), incident_datetime (timestamptz)
// - report_type ต้องเป็นตัวพิมพ์เล็ก 'lost' | 'found' เท่านั้น (ตรงกับ report_type_enum)
// - item_id / report_id เป็น uuid ที่มี DEFAULT gen_random_uuid() อยู่แล้ว ไม่ต้อง generate เอง
// - รูปตำหนิลับ (secret_image) ยังไม่มีคอลัมน์นี้ในตาราง item ต้องรันก่อน:
//     ALTER TABLE public.item ADD COLUMN secret_image text;

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

  // ผู้ใช้ต้อง login ผ่าน Supabase Auth ไว้ก่อน เพราะ report.user_id
  // เป็น NOT NULL FK ไปที่ user_account (ซึ่งผูกกับ auth.users ผ่าน trigger on_auth_user_created)
  const { data: authData, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !authData?.user) {
    alert('กรุณาเข้าสู่ระบบก่อนโพสต์ประกาศ');
    window.location.href = 'login.html';
    return;
  }
  const userId = authData.user.id;

  const reportType = sessionStorage.getItem('report_type');   // 'lost' หรือ 'found'
  const title = sessionStorage.getItem('report_title');
  const categoryId = sessionStorage.getItem('report_category');
  const baseDesc = sessionStorage.getItem('report_desc') || '';
  const incidentLocation = sessionStorage.getItem('report_incident_location');
  const date = sessionStorage.getItem('report_date');
  const time = sessionStorage.getItem('report_time');

  if (!reportType || !title || !categoryId || !incidentLocation || !date || !time) {
    alert('ข้อมูลจากขั้นตอนก่อนหน้าไม่ครบถ้วน กรุณาเริ่มกรอกใหม่ตั้งแต่ขั้นตอนที่ 1');
    window.location.href = 'report.html';
    return;
  }

  // รวมวันที่ + เวลาที่ผู้ใช้กรอกเป็น timestamptz เดียว ให้ตรงกับ report.incident_datetime
  const incidentDatetime = new Date(`${date}T${time}:00`).toISOString();

  const submitBtn = document.querySelector('.btn-submit');
  submitBtn.disabled = true;
  submitBtn.querySelector('span').textContent = 'กำลังบันทึก...';

  try {
    // 1) สร้างรายการสิ่งของ (item) — ปล่อยให้ DB gen item_id (uuid) และ status default เอง
    const { data: insertedItem, error: itemError } = await supabaseClient
      .from('item')
      .insert({
        item_name: title,
        category_id: categoryId,
        description: baseDesc,
        image_url: selectedImageBase64
      })
      .select('item_id')
      .single();

    if (itemError) throw itemError;
    const newItemId = insertedItem.item_id;

    // 2) สร้างรายงาน (report) ผูกกับ item ด้านบน — เฉพาะคอลัมน์ที่มีอยู่จริงในตาราง report เท่านั้น
    const { error: reportError } = await supabaseClient
      .from('report')
      .insert({
        report_type: reportType,
        user_id: userId,
        item_id: newItemId,
        incident_location: incidentLocation,
        incident_datetime: incidentDatetime
      });

    if (reportError) throw reportError;

    // 3) รูปตำหนิลับ (ถ้ามี) — ต้อง ALTER TABLE เพิ่มคอลัมน์ secret_image ในตาราง item ก่อน ไม่งั้นจะ error แบบไม่ critical
    if (secretImageBase64) {
      const { error: secretError } = await supabaseClient
        .from('item')
        .update({ secret_image: secretImageBase64 })
        .eq('item_id', newItemId);

      if (secretError) {
        console.warn('บันทึกรูปตำหนิลับไม่สำเร็จ (ต้องเพิ่มคอลัมน์ secret_image ในตาราง item ก่อน):', secretError.message);
      }
    }

    sessionStorage.clear();
    window.location.href = 'home.html';

  } catch (err) {
    console.error('บันทึกประกาศไม่สำเร็จ:', err);
    alert('ไม่สามารถบันทึกประกาศได้: ' + (err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'));
    submitBtn.disabled = false;
    submitBtn.querySelector('span').textContent = 'ยืนยันการโพสต์ประกาศ';
  }
}

// module script ไม่ leak ฟังก์ชันออกไปเป็น global โดยอัตโนมัติ แต่ HTML เรียกผ่าน
// inline onclick/onchange (รวมถึง onclick ที่ถูกสร้างแบบ dynamic ใน renderPreview()) จึงต้องแปะเข้า window
window.handleFiles = handleFiles;
window.removeImage = removeImage;
window.handleSecretFile = handleSecretFile;
window.removeSecretImage = removeSecretImage;
window.handleSubmit = handleSubmit;