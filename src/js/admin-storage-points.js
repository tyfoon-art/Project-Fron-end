import { staffSession, isAdmin } from './staff-auth.js';
import { supabaseClient } from './supabaseClient.js';

/* ============================================================================
   หน้าจัดการสถานที่เก็บ (public.storage_point) — เข้าได้เฉพาะ role='admin'
   ----------------------------------------------------------------------------
   - อ่านรายการ:      select จาก storage_point + นับจำนวนสิ่งของที่เก็บอยู่
   - เพิ่ม / แก้ไข:  rpc admin_upsert_storage_point
   - ลบ:            rpc admin_delete_storage_point (ถ้ายังมีสิ่งของเก็บอยู่จะถูกปฏิเสธ)
   ============================================================================ */

if (!isAdmin()) {
  window.location.replace('staff-dashboard.html');
}

const adminId = staffSession.userId;
let itemCountByStorage = {};
let pendingDeleteId = null;

const el = {
  form: document.getElementById('asp-form'),
  storageId: document.getElementById('asp-storage-id'),
  name: document.getElementById('asp-name'),
  room: document.getElementById('asp-room'),
  description: document.getElementById('asp-description'),
  formTitle: document.getElementById('asp-form-title'),
  submitBtn: document.getElementById('asp-submit-btn'),
  cancelBtn: document.getElementById('asp-cancel-btn'),
  tbody: document.getElementById('asp-tbody'),
  count: document.getElementById('asp-count'),
  alert: document.getElementById('asp-alert'),
  alertText: document.getElementById('asp-alert-text'),
  modal: document.getElementById('asp-delete-modal'),
  modalText: document.getElementById('asp-delete-text'),
  modalCancel: document.getElementById('asp-delete-cancel'),
  modalConfirm: document.getElementById('asp-delete-confirm'),
};

function showAlert(message, type = 'info') {
  el.alertText.textContent = message;
  el.alert.classList.remove('error', 'success');
  if (type === 'error') el.alert.classList.add('error');
  if (type === 'success') el.alert.classList.add('success');
  el.alert.classList.add('show');
}

function hideAlert() {
  el.alert.classList.remove('show');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================================
   LOAD
   ============================================================================ */

async function loadItemCounts() {
  itemCountByStorage = {};

  const { data, error } = await supabaseClient
    .from('item')
    .select('current_storage_id')
    .not('current_storage_id', 'is', null)
    .is('deleted_at', null);

  if (error) {
    console.error('โหลดจำนวนสิ่งของไม่สำเร็จ:', error);
    return;
  }

  (data || []).forEach((row) => {
    if (!row.current_storage_id) return;
    itemCountByStorage[row.current_storage_id] =
      (itemCountByStorage[row.current_storage_id] || 0) + 1;
  });
}

function renderRows(points) {
  el.count.textContent = points.length;

  if (!points.length) {
    el.tbody.innerHTML = `
      <tr class="asp-empty">
        <td colspan="6"><i class="fa-solid fa-inbox"></i> ยังไม่มีสถานที่เก็บในระบบ</td>
      </tr>`;
    return;
  }

  el.tbody.innerHTML = points
    .map((point, index) => {
      const itemCount = itemCountByStorage[point.storage_id] || 0;

      return `
        <tr>
          <td>${index + 1}</td>
          <td class="asp-row-name">${escapeHtml(point.storage_name)}</td>
          <td>${point.room ? escapeHtml(point.room) : '<span class="asp-row-muted">-</span>'}</td>
          <td>${point.description ? escapeHtml(point.description) : '<span class="asp-row-muted">-</span>'}</td>
          <td><span class="asp-badge-count">${itemCount}</span></td>
          <td>
            <div class="asp-actions">
              <button type="button" class="asp-btn small edit" data-action="edit" data-id="${point.storage_id}">
                <i class="fa-solid fa-pen"></i><span>แก้ไข</span>
              </button>
              <button type="button" class="asp-btn small remove" data-action="delete" data-id="${point.storage_id}">
                <i class="fa-solid fa-trash"></i><span>ลบ</span>
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join('');
}

async function loadStoragePoints() {
  el.tbody.innerHTML = `
    <tr class="asp-empty">
      <td colspan="6"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูล...</td>
    </tr>`;

  const { data, error } = await supabaseClient
    .from('storage_point')
    .select('storage_id, storage_name, room, description')
    .order('storage_name', { ascending: true });

  if (error) {
    console.error('โหลดสถานที่เก็บไม่สำเร็จ:', error);
    el.tbody.innerHTML = `
      <tr class="asp-empty">
        <td colspan="6"><i class="fa-solid fa-triangle-exclamation"></i> โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</td>
      </tr>`;
    showAlert('โหลดรายการสถานที่เก็บไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
    return;
  }

  await loadItemCounts();
  renderRows(data || []);
}

/* ============================================================================
   FORM (เพิ่ม / แก้ไข)
   ============================================================================ */

function resetForm() {
  el.form.reset();
  el.storageId.value = '';
  el.name.classList.remove('input-error');
  el.formTitle.textContent = 'เพิ่มสถานที่เก็บ';
  el.submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i><span>เพิ่มสถานที่เก็บ</span>';
  el.cancelBtn.classList.add('hidden');
}

async function startEditById(storageId) {
  const { data, error } = await supabaseClient
    .from('storage_point')
    .select('storage_id, storage_name, room, description')
    .eq('storage_id', storageId)
    .maybeSingle();

  if (error || !data) {
    showAlert('ไม่พบข้อมูลสถานที่เก็บที่ต้องการแก้ไข', 'error');
    return;
  }

  el.storageId.value = data.storage_id;
  el.name.value = data.storage_name || '';
  el.room.value = data.room || '';
  el.description.value = data.description || '';
  el.formTitle.textContent = 'แก้ไขสถานที่เก็บ';
  el.submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>บันทึกการแก้ไข</span>';
  el.cancelBtn.classList.remove('hidden');
  el.name.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setSubmitting(isSubmitting) {
  el.submitBtn.disabled = isSubmitting;
  el.cancelBtn.disabled = isSubmitting;
}

async function handleSubmit(event) {
  event.preventDefault();
  hideAlert();

  const name = el.name.value.trim();
  if (!name) {
    el.name.classList.add('input-error');
    showAlert('กรุณากรอกชื่อสถานที่เก็บ', 'error');
    el.name.focus();
    return;
  }

  setSubmitting(true);

  try {
    const { error } = await supabaseClient.rpc('admin_upsert_storage_point', {
      p_admin_id: adminId,
      p_storage_id: el.storageId.value || null,
      p_storage_name: name,
      p_room: el.room.value.trim() || null,
      p_description: el.description.value.trim() || null,
    });

    if (error) throw error;

    const wasEdit = Boolean(el.storageId.value);
    resetForm();
    await loadStoragePoints();
    showAlert(
      wasEdit ? 'บันทึกการแก้ไขสถานที่เก็บเรียบร้อยแล้ว' : 'เพิ่มสถานที่เก็บใหม่เรียบร้อยแล้ว',
      'success'
    );
  } catch (error) {
    console.error('บันทึกสถานที่เก็บไม่สำเร็จ:', error);
    showAlert(error.message || 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
  } finally {
    setSubmitting(false);
  }
}

/* ============================================================================
   DELETE
   ============================================================================ */

function openDeleteModal(storageId) {
  const row = el.tbody.querySelector(`tr[data-id="${storageId}"]`);
  const rowText = row ? row.querySelector('.asp-row-name')?.textContent : '';

  pendingDeleteId = storageId;
  el.modalText.textContent = `ต้องการลบ "${rowText || 'สถานที่เก็บนี้'}" ใช่หรือไม่? หากยังมีสิ่งของเก็บอยู่ ระบบจะไม่อนุญาตให้ลบ`;
  el.modal.classList.remove('hidden');
}

function closeDeleteModal() {
  pendingDeleteId = null;
  el.modal.classList.add('hidden');
}

async function confirmDelete() {
  if (!pendingDeleteId) return;

  el.modalConfirm.disabled = true;

  try {
    const { error } = await supabaseClient.rpc('admin_delete_storage_point', {
      p_admin_id: adminId,
      p_storage_id: pendingDeleteId,
    });

    if (error) throw error;

    closeDeleteModal();
    await loadStoragePoints();
    showAlert('ลบสถานที่เก็บเรียบร้อยแล้ว', 'success');
  } catch (error) {
    closeDeleteModal();
    console.error('ลบสถานที่เก็บไม่สำเร็จ:', error);
    showAlert(error.message || 'ลบข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
  } finally {
    el.modalConfirm.disabled = false;
  }
}

/* ============================================================================
   EVENT WIRING
   ============================================================================ */

el.form.addEventListener('submit', handleSubmit);
el.cancelBtn.addEventListener('click', resetForm);

el.tbody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const storageId = button.dataset.id;
  if (button.dataset.action === 'edit') startEditById(storageId);
  if (button.dataset.action === 'delete') openDeleteModal(storageId);
});

el.modalCancel.addEventListener('click', closeDeleteModal);
el.modalConfirm.addEventListener('click', confirmDelete);

el.modal.addEventListener('click', (event) => {
  if (event.target === el.modal) closeDeleteModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !el.modal.classList.contains('hidden')) closeDeleteModal();
});

document.getElementById('admin-badge')?.classList.add('hidden');
if (staffSession.role === 'admin') {
  document.getElementById('admin-badge')?.classList.remove('hidden');
}

loadStoragePoints();