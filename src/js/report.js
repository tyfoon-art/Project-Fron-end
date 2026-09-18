import { supabaseClient } from './supabaseClient.js';

// ---------- โหลดหมวดหมู่จริงจากตาราง category ใน Supabase ----------
// หมายเหตุ: ชื่อตาราง/คอลัมน์ที่สร้างด้วย SQL แบบไม่ใส่ "" จะถูก Postgres
// แปลงเป็นตัวพิมพ์เล็กทั้งหมดเสมอ (CATEGORY -> category, Category_ID -> category_id)
// จึงต้องเรียกด้วยชื่อตัวพิมพ์เล็กแบบนี้ ไม่ใช่ตามที่เขียนไว้ใน .sql
document.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  restoreFromSessionStorage();
});

async function loadCategories() {
  const select = document.getElementById('itemCategorySelect');
  try {
    const { data, error } = await supabaseClient
      .from('category')
      .select('category_id, category_name')
      .eq('is_active', true) // ตาราง category มีคอลัมน์ is_active ให้ใช้กรองหมวดหมู่ที่ถูกปิดใช้งานออก
      .order('category_name', { ascending: true });

    if (error) throw error;

    select.innerHTML = '<option value="" disabled selected>เลือกหมวดหมู่</option>';

    if (!data || data.length === 0) {
      select.innerHTML = '<option value="" disabled selected>ยังไม่มีหมวดหมู่ในระบบ</option>';
      return;
    }

    data.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.category_id; // uuid ของ category
      opt.textContent = cat.category_name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('โหลดหมวดหมู่ไม่สำเร็จ:', err);
    select.innerHTML = '<option value="" disabled selected>โหลดหมวดหมู่ไม่สำเร็จ ลองรีเฟรชหน้า</option>';
  }
}

// ถ้าผู้ใช้กด "ย้อนกลับ" มาจากขั้นตอนถัดไป ให้เติมค่าที่กรอกไว้เดิมกลับเข้าฟอร์ม
function restoreFromSessionStorage() {
  const savedType = sessionStorage.getItem('report_type');
  if (savedType) selectReportType(savedType);

  const savedTitle = sessionStorage.getItem('report_title');
  if (savedTitle) document.getElementById('itemTitleInput').value = savedTitle;

  const savedDesc = sessionStorage.getItem('report_desc');
  if (savedDesc) document.getElementById('itemDescInput').value = savedDesc;

  const savedCategory = sessionStorage.getItem('report_category');
  if (savedCategory) {
    document.getElementById('itemCategorySelect').value = savedCategory;
  }
}

function selectReportType(type) {
  const cardLost = document.getElementById('cardLost');
  const cardFound = document.getElementById('cardFound');
  const inputType = document.getElementById('reportTypeInput');

  // ค่าต้องตรงกับ public.report_type_enum ในฐานข้อมูล ซึ่งกำหนดเป็นตัวพิมพ์เล็กเท่านั้น: 'lost' | 'found'
  if (type === 'lost') {
    cardLost.classList.add('selected');
    cardFound.classList.remove('selected');
    inputType.value = 'lost';
  } else {
    cardFound.classList.add('selected');
    cardLost.classList.remove('selected');
    inputType.value = 'found';
  }
}

function clearError(inputId, errorId) {
  document.getElementById(inputId).classList.remove('error');
  document.getElementById(errorId).style.display = 'none';
}

function validateAndNext() {
  let isValid = true;
  const reportType = document.getElementById('reportTypeInput').value;
  const titleInput = document.getElementById('itemTitleInput');
  const categorySelect = document.getElementById('itemCategorySelect');

  const titleError = document.getElementById('titleError');
  const categoryError = document.getElementById('categoryError');

  if (!titleInput.value.trim()) {
    titleInput.classList.add('error');
    titleError.style.display = 'block';
    isValid = false;
  } else {
    titleInput.classList.remove('error');
    titleError.style.display = 'none';
  }

  if (!categorySelect.value) {
    categorySelect.classList.add('error');
    categoryError.style.display = 'block';
    isValid = false;
  } else {
    categorySelect.classList.remove('error');
    categoryError.style.display = 'none';
  }

  if (!isValid) return;

  // ข้อมูลชุดนี้ (title / category / desc) จะไปลง "item" ตอน submit สุดท้าย
  // ส่วน report_type จะไปลง "report.report_type" คู่กับ incident_location / incident_datetime จาก step 2
  sessionStorage.setItem('report_type', reportType);
  sessionStorage.setItem('report_title', titleInput.value.trim());
  sessionStorage.setItem('report_category', categorySelect.value);
  sessionStorage.setItem('report_category_name', categorySelect.options[categorySelect.selectedIndex].text);
  sessionStorage.setItem('report_desc', document.getElementById('itemDescInput').value.trim());

  window.location.href = 'report2.html';
}

// ไฟล์นี้เป็น ES module (import/export) — ฟังก์ชันข้างในจะไม่ใช่ global โดยอัตโนมัติ
// แต่ report.html เรียกฟังก์ชันพวกนี้ผ่าน inline onclick/oninput/onchange ในแท็ก HTML
// จึงต้องแปะเข้า window ตรงนี้ ไม่งั้นจะเจอ error "xxx is not defined" ตอนคลิก
window.selectReportType = selectReportType;
window.clearError = clearError;
window.validateAndNext = validateAndNext;