import { supabaseClient } from './supabaseClient.js';
import { clearDraftImages } from './reportDraftImages.js';

// โหมดแก้ไข: ประเภทการแจ้ง (หาย/พบ) เปลี่ยนไม่ได้ จึงล็อกการ์ดเลือกประเภทไว้
let isEditMode = false;

document.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  await prepareDraft();
  restoreFromSessionStorage();
  applyEditModeUI();
});

async function resetDraft() {
  Object.keys(sessionStorage)
    .filter(key => key.startsWith('report_'))
    .forEach(key => sessionStorage.removeItem(key));
  await clearDraftImages();
}

// เตรียมข้อมูลร่างใน sessionStorage ให้ตรงกับโหมดที่เปิดหน้า
// - report.html?id=...&mode=edit → ดึงข้อมูลโพสต์เดิมมาเป็นค่าเริ่มต้น
// - report.html เฉย ๆ             → โพสต์ใหม่ (ล้างร่างที่ค้างจากการแก้ไขโพสต์อื่นทิ้ง)
async function prepareDraft() {
  const params = new URLSearchParams(window.location.search);
  const editItemId = params.get('mode') === 'edit' ? params.get('id') : null;
  const draftEditId = sessionStorage.getItem('report_edit_item_id');

  if (!editItemId) {
    if (draftEditId) await resetDraft();
    return;
  }

  // กด "ย้อนกลับ" มาจากขั้นตอนถัดไปของโพสต์เดิม — คงค่าที่ผู้ใช้แก้ค้างไว้
  if (draftEditId === editItemId) return;

  await resetDraft();

  const { data: item, error } = await supabaseClient
    .from('item')
    .select(`
      item_id,
      item_name,
      description,
      status,
      category_id,
      report ( report_id, report_type, incident_location, incident_datetime, user_id )
    `)
    .eq('item_id', editItemId)
    .is('deleted_at', null)
    .single();

  const report = (item && item.report && item.report[0]) ? item.report[0] : null;

  if (error || !report) {
    console.error('โหลดโพสต์ที่ต้องการแก้ไขไม่สำเร็จ:', error);
    alert('ไม่พบโพสต์ที่ต้องการแก้ไข');
    window.location.href = 'browse.html';
    return;
  }

  if (report.user_id !== localStorage.getItem('userId')) {
    alert('คุณไม่ใช่เจ้าของโพสต์นี้ จึงไม่สามารถแก้ไขได้');
    window.location.href = `detail.html?id=${editItemId}`;
    return;
  }

  // แจ้งพบแก้ไขได้เฉพาะตอนรอตรวจสอบ / แจ้งหายแก้ไขได้ทุกสถานะ (ตรงกับ RPC update_report)
  if (report.report_type !== 'lost' && item.status !== 'รอตรวจสอบ') {
    alert('โพสต์แจ้งพบสามารถแก้ไขได้เฉพาะตอนสถานะ "รอตรวจสอบ" เท่านั้น');
    window.location.href = `detail.html?id=${editItemId}`;
    return;
  }

  sessionStorage.setItem('report_edit_item_id', item.item_id);
  sessionStorage.setItem('report_edit_report_id', report.report_id);
  sessionStorage.setItem('report_type', report.report_type);
  sessionStorage.setItem('report_title', item.item_name || '');
  sessionStorage.setItem('report_category', item.category_id || '');
  sessionStorage.setItem('report_desc', item.description || '');
  sessionStorage.setItem('report_incident_location', report.incident_location || '');

  if (report.incident_datetime) {
    const d = new Date(report.incident_datetime);
    const pad = n => String(n).padStart(2, '0');
    sessionStorage.setItem('report_date', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    sessionStorage.setItem('report_time', `${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }
}

function applyEditModeUI() {
  if (!sessionStorage.getItem('report_edit_item_id')) return;
  isEditMode = true;

  const heading = document.querySelector('.report-header h1');
  if (heading) heading.textContent = 'แก้ไขโพสต์';

  document.querySelectorAll('.report-type-card').forEach(card => {
    card.style.cursor = 'not-allowed';
    if (!card.classList.contains('selected')) card.style.opacity = '0.5';
  });
}

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
  if (isEditMode) return;

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