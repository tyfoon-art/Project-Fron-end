import { supabaseClient } from './supabaseClient.js';

/* ============================================================================
   ข้อสมมติฐานเรื่องโครงสร้างตาราง/สตอเรจ (แก้ชื่อ table/column/bucket ให้ตรงกับของจริงได้ที่นี่)
   ----------------------------------------------------------------------------
   - public.item        : item_id (text, PK, เช่น "ITM-2026-0001"),
                           reference_id (text, เช่น "INV-2026-001"),
                           item_name, category, category_key, sub_category,
                           description,
                           location_zone, location_detail, location_landmark,
                           found_location (ข้อความสรุปสถานที่พบ),
                           found_date_time,
                           storage_room, shelf_id, bin_id,
                           storage_location (ข้อความสรุปตำแหน่งจัดเก็บ),
                           status, staff_defect_note (ตำหนิเฉพาะ เห็นได้เฉพาะเจ้าหน้าที่),
                           created_at, updated_at, deleted_at
     (status ใช้ enum เดียวกับหน้า dashboard/home: 'รอตรวจสอบ' | 'อยู่ที่จุดรับฝาก'
      | 'กำลังดำเนินการเคลม' | 'คืนสำเร็จ' | 'หมดอายุ/ทำลายทิ้ง')

     >>> ต้องเพิ่มคอลัมน์ใหม่ก่อนใช้งานหน้ารายละเอียดโพสต์ (staff-post-detail.js):
         alter table public.item add column if not exists staff_defect_note text;

   - public.item_media  : media_id, item_id, url, type, name, size, created_at
   - storage bucket "item-media" : เก็บไฟล์จริง path = `${item_id}/${index}-${filename}`

   ----------------------------------------------------------------------------
   โหมดการทำงานของหน้านี้:
   1) โหมดปกติ (ไม่มี ?id= ต่อท้าย URL) — กรอกข้อมูลทั้งหมดตั้งแต่ต้น แล้ว INSERT รายการใหม่
      (ใช้กรณีเจ้าหน้าที่เจอของเองโดยไม่มีโพสต์แจ้งพบมาก่อน)
   2) โหมดบันทึกเข้าคลังจากโพสต์ (มี ?id=ITM-xxxx ต่อท้าย URL, มาจากปุ่ม
      "บันทึกสิ่งของเข้าคลัง (Staff Storage)" ในหน้า staff-post-detail.html) —
      ดึงข้อมูลสิ่งของที่มีอยู่แล้วมาแสดงแบบอ่านอย่างเดียว ให้กรอกแค่ตำแหน่งจัดเก็บ
      แล้ว UPDATE รายการเดิม (ไม่ INSERT ใหม่)
   ============================================================================ */

const ITEM_TABLE = 'item';
const MEDIA_TABLE = 'item_media';
const MEDIA_BUCKET = 'item-media';

const MAX_FILES = 5;
const NEW_ITEM_STATUS = 'อยู่ที่จุดรับฝาก';

const existingItemId = new URLSearchParams(window.location.search).get('id');
const isEditMode = Boolean(existingItemId);

let selectedFiles = [];
let isSaving = false;
let toastTimer = null;
let loadedItem = null;

const subCategories = {
  electronics: ['สมาร์ทโฟน / แท็บเล็ต', 'โน๊ตบุ๊ค / คอมพิวเตอร์', 'หูฟัง / อุปกรณ์เสริม', 'สายชาร์จ / แบตสำรอง'],
  bags: ['กระเป๋าสตางค์', 'กระเป๋าสะพาย / เป้', 'กระเป๋าถือ', 'ถุงผ้า'],
  documents: ['บัตรประจำตัว / บัตรนิสิต', 'บัตรเครดิต / ธนาคาร', 'เอกสารสำคัญ', 'หนังสือ / สมุด'],
  personal: ['กุญแจ / คีย์การ์ด', 'แว่นตา', 'นาฬิกา', 'เครื่องประดับ', 'ร่ม'],
};

const categoryNames = {
  electronics: 'อุปกรณ์ไอที',
  bags: 'กระเป๋า',
  documents: 'เอกสาร / บัตร',
  personal: 'อื่นๆ',
};

const categoryKeyByName = Object.fromEntries(
  Object.entries(categoryNames).map(([key, name]) => [name, key]),
);

/* ============================================================================
   TOAST
   ============================================================================ */

function showErrorToast(message) {
  const toast = document.getElementById('errorToast');
  const messageEl = document.getElementById('errorToastMessage');
  if (!toast || !messageEl) return;

  messageEl.textContent = message || 'กรุณาลองใหม่อีกครั้ง';
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4500);
}

/* ============================================================================
   CATEGORY / LOCATION FIELD WIRING
   ============================================================================ */

function updateSubCategories() {
  const mainCategory = document.getElementById('mainCategory').value;
  const subCategory = document.getElementById('subCategory');

  subCategory.innerHTML = '<option value="">เลือกหมวดหมู่อย่อย</option>';

  (subCategories[mainCategory] || []).forEach((sub) => {
    const option = document.createElement('option');
    option.value = sub;
    option.textContent = sub;
    subCategory.appendChild(option);
  });
}

function updateLocationDetail() {
  const locationType = document.getElementById('locationType').value;
  const wrapper = document.getElementById('locationDetailWrapper');
  const input = document.getElementById('locationDetail');
  const label = document.getElementById('locationDetailLabel');
  const hint = document.getElementById('locationDetailHint');

  wrapper.classList.add('hidden');
  input.required = false;
  if (!isEditMode) input.value = '';
  input.placeholder = '';
  hint.textContent = '';

  const presets = {
    ห้องเรียน: {
      label: 'ระบุห้องเรียน',
      placeholder: 'เช่น ICT 1102',
      hint: 'กรอกหมายเลขหรือชื่อห้องเรียน เช่น ICT 1102',
    },
    ห้องสาขา: {
      label: 'ระบุห้องสาขา',
      placeholder: 'เช่น ห้องสาขาวิศวกรรมซอฟต์แวร์',
      hint: 'กรอกชื่อห้องหรือห้องประจำสาขาที่พบสิ่งของ',
    },
    อื่นๆ: {
      label: 'ระบุสถานที่',
      placeholder: 'เช่น ลานกิจกรรมหน้าอาคาร ICT',
      hint: 'ระบุสถานที่ที่พบสิ่งของให้ชัดเจน',
    },
  };

  const preset = presets[locationType];
  if (!preset) return;

  wrapper.classList.remove('hidden');
  input.required = true;
  label.innerHTML = `${preset.label} <span class="req">*</span>`;
  input.placeholder = preset.placeholder;
  hint.textContent = preset.hint;
}

/* ============================================================================
   MEDIA PREVIEW (ไฟล์ใหม่ที่เจ้าหน้าที่เพิ่มเอง)
   ============================================================================ */

function previewImages(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  if (selectedFiles.length + files.length > MAX_FILES) {
    showErrorToast(`สามารถอัปโหลดได้สูงสุด ${MAX_FILES} ไฟล์เท่านั้น`);
    event.target.value = '';
    return;
  }

  selectedFiles = [...selectedFiles, ...files];
  event.target.value = '';
  renderPreviews();
}

function renderPreviews() {
  const container = document.getElementById('previewContainer');
  const countText = document.getElementById('fileCountText');
  const clearButton = document.getElementById('clearAllBtn');

  countText.textContent = `(${selectedFiles.length}/${MAX_FILES})`;
  container.innerHTML = '';

  if (selectedFiles.length === 0) {
    clearButton.classList.add('hidden');
    return;
  }

  clearButton.classList.remove('hidden');

  selectedFiles.forEach((file, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-item';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'preview-remove';
    removeButton.textContent = '✕';
    removeButton.addEventListener('click', () => removeFile(index));

    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.alt = 'preview';
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.readAsDataURL(file);
      wrapper.appendChild(img);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      const reader = new FileReader();
      reader.onload = (e) => { video.src = e.target.result; };
      reader.readAsDataURL(file);
      wrapper.appendChild(video);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'file-fallback';
      fallback.innerHTML = `<i class="fa-regular fa-file"></i><span>${file.name}</span>`;
      wrapper.appendChild(fallback);
    }

    wrapper.appendChild(removeButton);
    container.appendChild(wrapper);
  });
}

function removeFile(index) {
  if (index < 0 || index >= selectedFiles.length) return;
  selectedFiles.splice(index, 1);
  renderPreviews();
}

function clearAllImages() {
  selectedFiles = [];
  document.getElementById('imageInput').value = '';
  renderPreviews();
}

/* ============================================================================
   MEDIA ที่มีอยู่แล้วจากโพสต์ (แสดงอย่างเดียว โหมดบันทึกเข้าคลังจากโพสต์)
   ============================================================================ */

function renderExistingMedia(mediaList) {
  const container = document.getElementById('existingMediaContainer');
  if (!container) return;

  container.innerHTML = (mediaList || []).map((media) => {
    if ((media.type || '').startsWith('video/')) {
      return `<div class="preview-item existing"><video src="${media.url}" controls></video></div>`;
    }
    return `<div class="preview-item existing"><img src="${media.url}" alt="${media.name || ''}"></div>`;
  }).join('');
}

/* ============================================================================
   ID GENERATION (สอบถามเลขล่าสุดจาก Supabase แทนการวนอ่านจาก localStorage)
   ============================================================================ */

async function fetchLatestIdSuffix(column, prefixPattern) {
  const { data, error } = await supabaseClient
    .from(ITEM_TABLE)
    .select(column)
    .like(column, `${prefixPattern}%`)
    .order(column, { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || !data.length || !data[0][column]) return 0;

  const match = String(data[0][column]).match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

async function generateItemId() {
  const year = new Date().getFullYear();
  const latest = await fetchLatestIdSuffix('item_id', `ITM-${year}-`);
  return `ITM-${year}-${String(latest + 1).padStart(4, '0')}`;
}

async function generateReferenceId() {
  const year = new Date().getFullYear();
  const latest = await fetchLatestIdSuffix('reference_id', `INV-${year}-`);
  return `INV-${year}-${String(latest + 1).padStart(3, '0')}`;
}

async function updateReferenceDisplay() {
  try {
    const reference = await generateReferenceId();
    document.getElementById('refId').textContent = `#${reference}`;
    document.getElementById('qrReference').textContent = `#${reference}`;
  } catch (error) {
    console.error('ไม่สามารถดึงเลข Reference ล่าสุดได้:', error);
  }
}

/* ============================================================================
   โหมดบันทึกเข้าคลังจากโพสต์: โหลดข้อมูลเดิมมาแสดง + ล็อกฟิลด์ที่แก้ไม่ได้
   ============================================================================ */

function isoToDatetimeLocal(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function lockBasicFields() {
  ['itemName', 'mainCategory', 'subCategory', 'itemDescription',
    'locationType', 'locationDetail', 'locationLandmark', 'foundDateTime']
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
}

function simplifyToStorageOnly() {
  // โหมดบันทึกเข้าคลังจากโพสต์: ข้อมูลสิ่งของดูได้จากหน้ารายละเอียดโพสต์อยู่แล้ว
  // หน้านี้จึงเหลือไว้แค่ "ตำแหน่งจัดเก็บ" กับปุ่มบันทึก
  ['section1Card', 'section2Card', 'mediaCard', 'qrExtra'].forEach((id) => {
    document.getElementById(id)?.classList.add('hidden');
  });

  const stepNum = document.getElementById('section3StepNum');
  if (stepNum) stepNum.textContent = '1';
}

async function loadItemForStorage() {
  try {
    const { data: item, error } = await supabaseClient
      .from(ITEM_TABLE)
      .select('*')
      .eq('item_id', existingItemId)
      .maybeSingle();

    if (error) throw error;
    if (!item) {
      showErrorToast('ไม่พบรายการสิ่งของนี้ในระบบ');
      return;
    }

    loadedItem = item;

    // ป้าย/หัวข้อหน้า
    document.getElementById('pageSubtitle').textContent =
      'ตรวจสอบข้อมูลจากโพสต์ แล้วกรอกตำแหน่งจัดเก็บเพื่อบันทึกเข้าคลัง';
    document.getElementById('refId').textContent = `#${item.reference_id || '-'}`;
    document.getElementById('qrReference').textContent = `#${item.reference_id || '-'}`;

    const banner = document.getElementById('fromPostBanner');
    banner.classList.remove('hidden');
    document.getElementById('backToPostLink').href = `staff-post-detail.html?id=${encodeURIComponent(item.item_id)}`;

    // เติมข้อมูลส่วนที่ 1
    document.getElementById('itemName').value = item.item_name || '';
    document.getElementById('mainCategory').value = item.category_key || categoryKeyByName[item.category] || '';
    updateSubCategories();
    document.getElementById('subCategory').value = item.sub_category || '';
    document.getElementById('itemDescription').value = item.description || '';

    // เติมข้อมูลส่วนที่ 2
    document.getElementById('locationType').value = item.location_zone || '';
    updateLocationDetail();
    document.getElementById('locationDetail').value = item.location_detail || '';
    document.getElementById('locationLandmark').value = item.location_landmark || '';
    document.getElementById('foundDateTime').value = isoToDatetimeLocal(item.found_date_time);

    lockBasicFields();
    simplifyToStorageOnly();

    // ถ้าบันทึกเข้าคลังไปแล้ว แจ้งเตือนแทนการให้กรอกซ้ำ
    if (item.status && item.status !== 'รอตรวจสอบ' && item.status !== NEW_ITEM_STATUS) {
      showErrorToast(`รายการนี้อยู่ในสถานะ "${item.status}" แล้ว`);
    }
  } catch (error) {
    console.error('โหลดข้อมูลสิ่งของไม่สำเร็จ:', error);
    showErrorToast('ไม่สามารถโหลดข้อมูลสิ่งของจากโพสต์ได้');
  }
}

/* ============================================================================
   BUILD LOCATION SUMMARIES
   ============================================================================ */

function buildFoundLocation() {
  const locationType = document.getElementById('locationType').value;
  const locationDetail = document.getElementById('locationDetail').value.trim();
  const landmark = document.getElementById('locationLandmark').value.trim();
  return [locationType, locationDetail, landmark].filter(Boolean).join(' • ');
}

function buildStorageLocation() {
  const room = document.getElementById('storageRoom').value;
  const shelf = document.getElementById('shelfId').value.trim();
  const bin = document.getElementById('binId').value.trim();

  const parts = [];
  if (room) parts.push(room);
  if (shelf) parts.push(`ชั้น ${shelf}`);
  if (bin) parts.push(`Bin ${bin}`);
  return parts.join(' • ');
}

/* ============================================================================
   MEDIA UPLOAD (Supabase Storage)
   ============================================================================ */

async function uploadMediaFiles(itemId) {
  const uploaded = [];

  for (let index = 0; index < selectedFiles.length; index += 1) {
    const file = selectedFiles[index];
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${itemId}/${Date.now()}-${index}-${safeName}`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseClient
      .storage
      .from(MEDIA_BUCKET)
      .getPublicUrl(path);

    uploaded.push({
      item_id: itemId,
      url: publicUrlData?.publicUrl || '',
      type: file.type || '',
      name: file.name,
      size: file.size,
    });
  }

  return uploaded;
}

/* ============================================================================
   CONFIRM MODAL
   ============================================================================ */

function openConfirmModal() {
  const itemName = document.getElementById('itemName').value.trim();
  const categoryKey = document.getElementById('mainCategory').value;

  document.getElementById('confirmItemName').textContent = itemName || '-';
  document.getElementById('confirmCategory').textContent = categoryNames[categoryKey] || (loadedItem && loadedItem.category) || '-';
  document.getElementById('confirmLocation').textContent = buildFoundLocation() || '-';
  document.getElementById('confirmStorage').textContent = buildStorageLocation() || '-';

  const modal = document.getElementById('confirmSaveModal');
  modal.classList.remove('hidden');
  requestAnimationFrame(() => modal.classList.add('show'));
  document.body.classList.add('overflow-hidden');

  setTimeout(() => document.getElementById('confirmSaveButton')?.focus(), 100);
}

function closeConfirmModal() {
  if (isSaving) return;
  const modal = document.getElementById('confirmSaveModal');
  modal.classList.remove('show');
  setTimeout(() => modal.classList.add('hidden'), 200);
  document.body.classList.remove('overflow-hidden');
}

function handleModalBackdrop(event) {
  if (event.target.id === 'confirmSaveModal') closeConfirmModal();
}

/* ============================================================================
   SAVE ITEM
   ============================================================================ */

function setSavingUI(saving) {
  const confirmButton = document.getElementById('confirmSaveButton');
  const cancelButton = document.getElementById('cancelSaveButton');
  const submitButton = document.getElementById('submitButton');

  confirmButton.disabled = saving;
  cancelButton.disabled = saving;
  submitButton.disabled = saving;

  confirmButton.innerHTML = saving
    ? '<i class="fa-solid fa-spinner fa-spin-custom"></i> กำลังบันทึก...'
    : 'ยืนยันบันทึกเข้าคลัง';
}

async function confirmSaveItem() {
  if (isSaving) return;
  isSaving = true;
  setSavingUI(true);

  try {
    const storageRoom = document.getElementById('storageRoom').value;
    const shelfId = document.getElementById('shelfId').value.trim();
    const binId = document.getElementById('binId').value.trim();

    if (!storageRoom || !shelfId) {
      throw new Error('กรุณากรอกตำแหน่งจัดเก็บให้ครบถ้วน');
    }

    const nowIso = new Date().toISOString();

    if (isEditMode) {
      /* ---------- โหมดบันทึกเข้าคลังจากโพสต์: UPDATE รายการเดิม ---------- */
      const { error: updateError } = await supabaseClient
        .from(ITEM_TABLE)
        .update({
          storage_room: storageRoom,
          shelf_id: shelfId,
          bin_id: binId,
          storage_location: buildStorageLocation(),
          status: NEW_ITEM_STATUS,
          updated_at: nowIso,
        })
        .eq('item_id', existingItemId);

      if (updateError) throw updateError;

      if (selectedFiles.length) {
        const mediaRows = await uploadMediaFiles(existingItemId);
        if (mediaRows.length) {
          const { error: mediaError } = await supabaseClient
            .from(MEDIA_TABLE)
            .insert(mediaRows);
          if (mediaError) throw mediaError;
        }
      }
    } else {
      /* ---------- โหมดปกติ: กรอกข้อมูลทั้งหมดแล้ว INSERT ใหม่ ---------- */
      const itemName = document.getElementById('itemName').value.trim();
      const mainCategory = document.getElementById('mainCategory').value;
      const subCategory = document.getElementById('subCategory').value;
      const description = document.getElementById('itemDescription').value.trim();
      const locationType = document.getElementById('locationType').value;
      const locationDetail = document.getElementById('locationDetail').value.trim();
      const locationLandmark = document.getElementById('locationLandmark').value.trim();
      const foundDateTime = document.getElementById('foundDateTime').value;

      if (!itemName || !mainCategory || !locationType || !foundDateTime || !storageRoom || !shelfId) {
        throw new Error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      }

      if (['ห้องเรียน', 'ห้องสาขา', 'อื่นๆ'].includes(locationType) && !locationDetail) {
        throw new Error('กรุณาระบุรายละเอียดสถานที่เพิ่มเติม');
      }

      if (selectedFiles.length < 1) {
        throw new Error('กรุณาอัปโหลดภาพหรือไฟล์อย่างน้อย 1 ไฟล์');
      }

      const itemId = await generateItemId();
      const referenceId = await generateReferenceId();

      const newItem = {
        item_id: itemId,
        reference_id: referenceId,
        item_name: itemName,
        category: categoryNames[mainCategory] || mainCategory,
        category_key: mainCategory,
        sub_category: subCategory,
        description,
        location_zone: locationType,
        location_detail: locationDetail,
        location_landmark: locationLandmark,
        found_location: buildFoundLocation(),
        found_date_time: foundDateTime,
        storage_room: storageRoom,
        shelf_id: shelfId,
        bin_id: binId,
        storage_location: buildStorageLocation(),
        status: NEW_ITEM_STATUS,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { error: insertError } = await supabaseClient
        .from(ITEM_TABLE)
        .insert(newItem);

      if (insertError) throw insertError;

      const mediaRows = await uploadMediaFiles(itemId);
      if (mediaRows.length) {
        const { error: mediaError } = await supabaseClient
          .from(MEDIA_TABLE)
          .insert(mediaRows);
        if (mediaError) throw mediaError;
      }
    }

    document.getElementById('confirmSaveModal').classList.remove('show');
    document.body.classList.remove('overflow-hidden');

    window.location.href = 'staff-overdue-list.html';
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล:', error);
    showErrorToast(error.message || 'กรุณาลองใหม่อีกครั้ง');
    isSaving = false;
    setSavingUI(false);
  }
}

/* ============================================================================
   FORM SUBMIT
   ============================================================================ */

function handleFormSubmit(event) {
  event.preventDefault();
  if (isSaving) return;

  const storageRoom = document.getElementById('storageRoom').value;
  const shelfId = document.getElementById('shelfId').value.trim();

  if (!storageRoom || !shelfId) {
    showErrorToast('กรุณากรอกตำแหน่งจัดเก็บให้ครบถ้วน');
    return;
  }

  if (!isEditMode) {
    const form = document.getElementById('lostFoundForm');

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (selectedFiles.length < 1) {
      showErrorToast('กรุณาอัปโหลดภาพหรือไฟล์อย่างน้อย 1 ไฟล์');
      document.getElementById('imageInput').click();
      return;
    }

    const locationType = document.getElementById('locationType').value;
    const locationDetail = document.getElementById('locationDetail').value.trim();

    if (['ห้องเรียน', 'ห้องสาขา', 'อื่นๆ'].includes(locationType) && !locationDetail) {
      showErrorToast('กรุณาระบุรายละเอียดสถานที่เพิ่มเติม');
      document.getElementById('locationDetail').focus();
      return;
    }
  }

  openConfirmModal();
}

/* ============================================================================
   DEFAULT FOUND DATE/TIME
   ============================================================================ */

function setDefaultFoundDateTime() {
  const input = document.getElementById('foundDateTime');
  if (input.value) return;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  input.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/* ============================================================================
   EVENT WIRING
   ============================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('mainCategory')?.addEventListener('change', updateSubCategories);
  document.getElementById('locationType')?.addEventListener('change', updateLocationDetail);
  document.getElementById('imageInput')?.addEventListener('change', previewImages);
  document.getElementById('clearAllBtn')?.addEventListener('click', clearAllImages);
  document.getElementById('lostFoundForm')?.addEventListener('submit', handleFormSubmit);
  document.getElementById('cancelSaveButton')?.addEventListener('click', closeConfirmModal);
  document.getElementById('confirmSaveButton')?.addEventListener('click', confirmSaveItem);
  document.getElementById('confirmSaveModal')?.addEventListener('click', handleModalBackdrop);

  document.addEventListener('keydown', (event) => {
    const modal = document.getElementById('confirmSaveModal');
    if (event.key === 'Escape' && modal && modal.classList.contains('show')) {
      closeConfirmModal();
    }
  });

  updateLocationDetail();
  renderPreviews();

  if (isEditMode) {
    await loadItemForStorage();
  } else {
    setDefaultFoundDateTime();
    updateReferenceDisplay();
  }
});