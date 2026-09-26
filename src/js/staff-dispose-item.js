import { supabaseClient } from './supabaseClient.js';

/* ============================================================================
   ข้อสมมติฐานเรื่องโครงสร้างตาราง (แก้ชื่อ table/column ให้ตรงกับของจริงได้ที่นี่)
   ----------------------------------------------------------------------------
   - public.item      : item_id, item_name, image_url, status, created_at,
                         category_id, current_storage_id, deleted_at
                         (status ใช้ enum เดียวกับหน้าอื่น ๆ ในระบบ:
                          'รอตรวจสอบ' | 'อยู่ที่จุดรับฝาก' | 'กำลังดำเนินการเคลม'
                          | 'คืนสำเร็จ' | 'หมดอายุ/ทำลายทิ้ง')
   - public.category   : category_id, category_name
   - public.storage_point : storage_id, storage_name
   - public.disposal   : disposal_id, item_id, dispose_type, note,
                         disposed_at, days_in_storage
     (ตารางบันทึกประวัติการจำหน่าย — ถ้าชื่อจริงไม่ตรงให้แก้ค่าคงที่
      DISPOSAL_TABLE ด้านล่างได้เลย)
   ============================================================================ */

const ITEM_TABLE = 'item';
const DISPOSAL_TABLE = 'disposal';

const DISPOSAL_MIN_DAYS = 30;
const DISPOSED_STATUS = 'หมดอายุ/ทำลายทิ้ง';
const INACTIVE_STATUSES = ['หมดอายุ/ทำลายทิ้ง', 'คืนสำเร็จ'];

let currentItem = null;
let isSaving = false;

/* ============================================================================
   HELPERS
   ============================================================================ */

function calculateStorageDays(item) {
  if (!item?.created_at) return 0;

  const createdDate = new Date(item.created_at);
  if (Number.isNaN(createdDate.getTime())) return 0;

  const createdDay = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diff = todayDay.getTime() - createdDay.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function getCategoryDisplay(item) {
  return item?.category?.category_name || 'อื่นๆ';
}

function getItemLocation(item) {
  return item?.storage_point?.storage_name || '-';
}

function getDefaultImage() {
  return (
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#f3f4f6" />
        <path d="M55 145l34-42 25 29 17-20 35 33H55z" fill="#d1d5db" />
        <circle cx="82" cy="73" r="13" fill="#d1d5db" />
      </svg>
    `)
  );
}

function getDisposeTypeLabel(type) {
  const labels = {
    donate: 'บริจาคสาธารณะ',
    destroy: 'ทำลาย / รีไซเคิล',
    other: 'อื่นๆ',
  };
  return labels[type] || '-';
}

function isInactiveStatus(status) {
  return INACTIVE_STATUSES.includes(status);
}

/* ============================================================================
   DATA FETCHING
   ============================================================================ */

async function fetchItemById(itemId) {
  const { data, error } = await supabaseClient
    .from(ITEM_TABLE)
    .select(`
      item_id,
      item_name,
      image_url,
      status,
      created_at,
      deleted_at,
      category:category_id ( category_name ),
      storage_point:current_storage_id ( storage_name )
    `)
    .eq('item_id', itemId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/* ============================================================================
   LOAD SELECTED ITEM
   ============================================================================ */

async function loadSelectedItem() {
  const urlParams = new URLSearchParams(window.location.search);
  const selectedId = urlParams.get('id');

  if (!selectedId) {
    showInvalidItem('ไม่พบรหัสสิ่งของที่ต้องการจำหน่าย');
    return;
  }

  let item;
  try {
    item = await fetchItemById(selectedId);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลสิ่งของ:', error);
    showInvalidItem('ไม่สามารถโหลดข้อมูลสิ่งของได้ กรุณาลองใหม่อีกครั้ง');
    return;
  }

  if (!item || item.deleted_at) {
    showInvalidItem('ไม่พบข้อมูลสิ่งของรายการนี้ในระบบ');
    return;
  }

  currentItem = item;

  if (isInactiveStatus(item.status)) {
    showInvalidItem('สิ่งของรายการนี้ไม่สามารถจำหน่ายได้ เนื่องจากถูกจำหน่ายหรือส่งคืนออกจากระบบแล้ว');
    return;
  }

  const days = calculateStorageDays(item);
  currentItem.storageDays = days;

  document.getElementById('item-id-display').innerText = item.item_id || '-';
  document.getElementById('item-name-display').innerText = item.item_name || '-';
  document.getElementById('item-category-display').innerText = getCategoryDisplay(item);
  document.getElementById('item-location-display').innerText = getItemLocation(item);
  document.getElementById('input-item-id').value = item.item_id || '';

  const overdueBadge = document.getElementById('item-overdue-display');
  overdueBadge.innerText = `ตกค้าง ${days} วัน`;
  overdueBadge.className = days >= DISPOSAL_MIN_DAYS ? 'overdue-tag danger' : 'overdue-tag warning';

  const imageElement = document.getElementById('item-image');
  imageElement.src = item.image_url || getDefaultImage();
  imageElement.onerror = function () {
    this.onerror = null;
    this.src = getDefaultImage();
  };

  if (days >= DISPOSAL_MIN_DAYS) {
    enableDisposalForm();
  } else {
    disableDisposalForm(days);
  }
}

/* ============================================================================
   FORM STATE
   ============================================================================ */

function enableDisposalForm() {
  document.getElementById('disposeFormCard').classList.remove('hidden');
  document.getElementById('notEligibleCard').classList.add('hidden');
  document.getElementById('errorCard').classList.add('hidden');

  const button = document.getElementById('submitDisposeButton');
  button.disabled = false;
}

function disableDisposalForm(days) {
  document.getElementById('disposeFormCard').classList.add('hidden');
  document.getElementById('notEligibleCard').classList.remove('hidden');

  const remaining = Math.max(0, DISPOSAL_MIN_DAYS - days);
  const message =
    remaining === 1
      ? `รายการนี้เก็บรักษาอยู่ ${days} วัน จึงยังไม่สามารถจำหน่ายได้ ต้องเก็บรักษาอีก 1 วัน จึงจะสามารถดำเนินการจำหน่ายได้`
      : `รายการนี้เก็บรักษาอยู่ ${days} วัน จึงยังไม่สามารถจำหน่ายได้ ต้องเก็บรักษาอีก ${remaining} วัน จึงจะสามารถดำเนินการจำหน่ายได้`;

  document.getElementById('notEligibleMessage').innerText = message;
}

function showInvalidItem(message) {
  currentItem = null;

  document.getElementById('item-id-display').innerText = '-';
  document.getElementById('item-name-display').innerText = 'ไม่สามารถโหลดรายการได้';
  document.getElementById('item-category-display').innerText = '-';
  document.getElementById('item-location-display').innerText = '-';
  document.getElementById('item-overdue-display').innerText = 'ไม่พบข้อมูล';
  document.getElementById('item-image').src = getDefaultImage();

  document.getElementById('disposeFormCard').classList.add('hidden');
  document.getElementById('notEligibleCard').classList.add('hidden');
  document.getElementById('errorCard').classList.remove('hidden');
  document.getElementById('errorMessage').innerText = message;
}

/* ============================================================================
   FORM SUBMIT
   ============================================================================ */

function handleDisposeSubmit(event) {
  event.preventDefault();

  if (isSaving || !currentItem) return;

  const days = calculateStorageDays(currentItem);
  if (days < DISPOSAL_MIN_DAYS) {
    disableDisposalForm(days);
    return;
  }

  const selectedType = document.querySelector('input[name="dispose_type"]:checked');
  const noteElement = document.getElementById('dispose-note');
  const note = noteElement.value.trim();

  if (!selectedType) {
    showErrorModal('กรุณาเลือกรูปแบบการจำหน่ายก่อนดำเนินการ');
    return;
  }

  if (!note) {
    showErrorModal('กรุณาระบุรายละเอียดเพิ่มเติม / หมายเหตุ');
    noteElement.focus();
    return;
  }

  document.getElementById('confirmItemId').innerText = currentItem.item_id || '-';
  document.getElementById('confirmItemName').innerText = currentItem.item_name || '-';
  document.getElementById('confirmDisposeType').innerText = getDisposeTypeLabel(selectedType.value);
  document.getElementById('confirmOverdueDays').innerText = `${days} วัน`;

  openDisposeConfirmModal();
}

/* ============================================================================
   CONFIRMATION MODAL
   ============================================================================ */

function openDisposeConfirmModal() {
  const modal = document.getElementById('disposeConfirmModal');
  modal.classList.add('show');
  document.body.classList.add('overflow-hidden');
  setTimeout(() => document.getElementById('cancelDisposeButton').focus(), 50);
}

function closeDisposeConfirmModal() {
  if (isSaving) return;
  document.getElementById('disposeConfirmModal').classList.remove('show');
  document.body.classList.remove('overflow-hidden');
}

/* ============================================================================
   CONFIRM DISPOSAL — เขียนลง Supabase
   ============================================================================ */

async function confirmDisposeItem() {
  if (isSaving || !currentItem) return;

  isSaving = true;

  const confirmButton = document.getElementById('confirmDisposeButton');
  const cancelButton = document.getElementById('cancelDisposeButton');
  const originalButtonText = confirmButton.innerHTML;

  confirmButton.disabled = true;
  cancelButton.disabled = true;
  confirmButton.innerHTML = `<span class="loading-spinner"></span> กำลังบันทึก...`;

  try {
    // ตรวจสอบสถานะล่าสุดก่อนบันทึก ป้องกันการจำหน่ายซ้ำ/ข้อมูลไม่ตรงกัน
    const latestItem = await fetchItemById(currentItem.item_id);

    if (!latestItem) {
      throw new Error('ไม่พบรายการสิ่งของในระบบ');
    }

    if (isInactiveStatus(latestItem.status)) {
      throw new Error('สิ่งของรายการนี้ถูกจำหน่ายหรือส่งคืนออกจากระบบแล้ว');
    }

    const currentDays = calculateStorageDays(latestItem);
    if (currentDays < DISPOSAL_MIN_DAYS) {
      throw new Error(`รายการนี้ยังเก็บรักษาไม่ครบ ${DISPOSAL_MIN_DAYS} วัน`);
    }

    const selectedType = document.querySelector('input[name="dispose_type"]:checked');
    if (!selectedType) {
      throw new Error('กรุณาเลือกรูปแบบการจำหน่าย');
    }

    const note = document.getElementById('dispose-note').value.trim();
    if (!note) {
      throw new Error('กรุณาระบุรายละเอียดเพิ่มเติม / หมายเหตุ');
    }

    const now = new Date().toISOString();

    // 1) อัปเดตสถานะสิ่งของหลัก
    const { error: updateError } = await supabaseClient
      .from(ITEM_TABLE)
      .update({ status: DISPOSED_STATUS, updated_at: now })
      .eq('item_id', currentItem.item_id);

    if (updateError) throw updateError;

    // 2) บันทึกประวัติการจำหน่าย
    const { error: insertError } = await supabaseClient.from(DISPOSAL_TABLE).insert({
      item_id: currentItem.item_id,
      dispose_type: selectedType.value,
      note,
      disposed_at: now,
      days_in_storage: currentDays,
    });

    if (insertError) throw insertError;

    document.getElementById('disposeConfirmModal').classList.remove('show');

    setTimeout(() => {
      document.body.classList.add('overflow-hidden');
      document.getElementById('successModal').classList.add('show');
      isSaving = false;
    }, 150);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการจำหน่าย:', error);

    isSaving = false;
    confirmButton.disabled = false;
    cancelButton.disabled = false;
    confirmButton.innerHTML = originalButtonText;

    document.getElementById('disposeConfirmModal').classList.remove('show');
    document.body.classList.remove('overflow-hidden');

    showErrorModal(error.message || 'ไม่สามารถบันทึกการจำหน่ายได้');
  }
}

/* ============================================================================
   ERROR MODAL
   ============================================================================ */

function showErrorModal(message) {
  document.getElementById('errorModalMessage').innerText = message;
  document.getElementById('errorModal').classList.add('show');
  document.body.classList.add('overflow-hidden');
  setTimeout(() => document.querySelector('#errorModal button')?.focus(), 50);
}

function closeErrorModal() {
  document.getElementById('errorModal').classList.remove('show');
  document.body.classList.remove('overflow-hidden');
}

/* ============================================================================
   NAVIGATION
   ============================================================================ */

function goBackToOverdueList() {
  window.location.href = 'staff-overdue-list.html?disposed=success';
}

/* ============================================================================
   EVENT WIRING
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  loadSelectedItem();

  document.getElementById('dispose-form')?.addEventListener('submit', handleDisposeSubmit);
  document.getElementById('cancelDisposeButton')?.addEventListener('click', closeDisposeConfirmModal);
  document.getElementById('confirmDisposeButton')?.addEventListener('click', confirmDisposeItem);
  document.getElementById('successContinueButton')?.addEventListener('click', goBackToOverdueList);

  document.getElementById('disposeConfirmModal')?.addEventListener('click', function (event) {
    if (event.target === this && !isSaving) closeDisposeConfirmModal();
  });

  document.getElementById('errorModal')?.addEventListener('click', function (event) {
    if (event.target === this) closeErrorModal();
  });

  document.querySelector('#errorModal .modal-actions button')?.addEventListener('click', closeErrorModal);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || isSaving) return;

    const confirmModal = document.getElementById('disposeConfirmModal');
    if (confirmModal.classList.contains('show')) {
      closeDisposeConfirmModal();
      return;
    }

    const errorModal = document.getElementById('errorModal');
    if (errorModal.classList.contains('show')) closeErrorModal();
  });
});