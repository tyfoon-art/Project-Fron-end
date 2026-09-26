import { supabaseClient } from './supabaseClient.js';

/* ============================================================================
   ข้อสมมติฐานเรื่องโครงสร้างตาราง (แก้ชื่อ table/column ให้ตรงกับของจริงได้ที่นี่)
   ----------------------------------------------------------------------------
   - public.item            : item_id, item_name, status, created_at, deleted_at
                               (status ใช้ enum เดียวกับหน้า home:
                                'รอตรวจสอบ' | 'อยู่ที่จุดรับฝาก' | 'กำลังดำเนินการเคลม'
                                | 'คืนสำเร็จ' | 'หมดอายุ/ทำลายทิ้ง')
   - public.handover         : handover_id, item_id, recipient_name,
                               handover_date, staff_name, proof_image_url, note
     (ตารางบันทึกการ "ส่งมอบคืนเจ้าของ" ที่เสร็จสมบูรณ์แล้ว — ถ้าชื่อจริงไม่ตรง
      ให้แก้ค่าคงที่ HANDOVER_TABLE ด้านล่างได้เลย)
   ============================================================================ */

const ITEM_TABLE = 'item';
const HANDOVER_TABLE = 'handover';

const OVERDUE_DAYS = 30;

const OPEN_STATUSES = ['รอตรวจสอบ', 'อยู่ที่จุดรับฝาก', 'กำลังดำเนินการเคลม'];
const PENDING_STATUSES = ['รอตรวจสอบ'];
const DISPOSED_STATUS = 'หมดอายุ/ทำลายทิ้ง';

/* ============================================================================
   HELPERS
   ============================================================================ */

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatHandoverDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function daysSince(dateString) {
  if (!dateString) return 0;
  const start = new Date(dateString);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = nowDay.getTime() - startDay.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/* ============================================================================
   DATA FETCHING
   ============================================================================ */

async function getAllOpenItems() {
  const { data, error } = await supabaseClient
    .from(ITEM_TABLE)
    .select('item_id, status, created_at')
    .is('deleted_at', null);

  if (error) throw error;
  return data || [];
}

async function getTotalCount() {
  const { count, error } = await supabaseClient
    .from(ITEM_TABLE)
    .select('item_id', { count: 'exact', head: true })
    .is('deleted_at', null);

  if (error) throw error;
  return count || 0;
}

async function getDisposedCount() {
  const { count, error } = await supabaseClient
    .from(ITEM_TABLE)
    .select('item_id', { count: 'exact', head: true })
    .eq('status', DISPOSED_STATUS)
    .is('deleted_at', null);

  if (error) throw error;
  return count || 0;
}

async function getCompletedHandovers() {
  const { data, error } = await supabaseClient
    .from(HANDOVER_TABLE)
    .select(`
      handover_id,
      recipient_name,
      handover_date,
      staff_name,
      proof_image_url,
      note,
      item:item_id ( item_id, item_name )
    `)
    .order('handover_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/* ============================================================================
   RENDER — STAT CARDS
   ============================================================================ */

function setStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = Number(value).toLocaleString('th-TH');
}

/* ============================================================================
   RENDER — COMPLETED HANDOVER TABLE
   ============================================================================ */

function renderCompletedTable(list) {
  const tbody = document.getElementById('completed-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!Array.isArray(list) || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="cell-empty">ยังไม่มีประวัติการส่งมอบคืนเสร็จสมบูรณ์ในระบบปัจจุบัน</td>
      </tr>
    `;
    return;
  }

  list.forEach((row) => {
    const claimId = String(row.handover_id ?? row.item?.item_id ?? '-');
    const itemName = row.item?.item_name || '-';
    const recipient = row.recipient_name || '-';
    const date = formatHandoverDate(row.handover_date);
    const staffName = row.staff_name || 'เจ้าหน้าที่';
    const proofUrl = row.proof_image_url || '';
    const note = row.note || '';

    const tr = document.createElement('tr');
    tr.dataset.claimId = claimId;
    tr.dataset.itemName = itemName;
    tr.dataset.recipient = recipient;
    tr.dataset.date = date;
    tr.dataset.proofUrl = proofUrl;
    tr.dataset.note = note;

    tr.innerHTML = `
      <td class="cell-id">${escapeHTML(claimId)}</td>
      <td class="cell-item">${escapeHTML(itemName)}</td>
      <td class="cell-recipient">${escapeHTML(recipient)}</td>
      <td>${escapeHTML(date)}</td>
      <td>${escapeHTML(staffName)}</td>
      <td><span class="status-pill"><span class="dot"></span>ส่งมอบแล้ว</span></td>
      <td>
        <button type="button" class="btn-proof" title="ดูหลักฐานการส่งคืน">
          <span class="btn-proof-icon"><i class="fa-regular fa-image"></i></span>
          <span>ดูหลักฐาน</span>
        </button>
      </td>
    `;

    tr.querySelector('.btn-proof').addEventListener('click', () => {
      openProofModal(claimId, itemName, recipient, date, proofUrl, note);
    });

    tbody.appendChild(tr);
  });
}

/* ============================================================================
   FETCH + RENDER DASHBOARD
   ============================================================================ */

async function fetchRealtimeDashboardData() {
  const tbody = document.getElementById('completed-table-body');

  try {
    const [openItems, totalCount, disposedCount, completedList] = await Promise.all([
      getAllOpenItems(),
      getTotalCount(),
      getDisposedCount(),
      getCompletedHandovers(),
    ]);

    const pendingCount = openItems.filter((item) =>
      PENDING_STATUSES.includes(item.status)
    ).length;

    const overdueCount = openItems.filter(
      (item) =>
        OPEN_STATUSES.includes(item.status) &&
        daysSince(item.created_at) >= OVERDUE_DAYS
    ).length;

    setStat('stat-total', totalCount);
    setStat('stat-pending', pendingCount);
    setStat('stat-handover-success', completedList.length);
    setStat('stat-overdue', overdueCount);
    setStat('stat-disposed', disposedCount);

    renderCompletedTable(completedList);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลแดชบอร์ด:', error);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="cell-error">ไม่สามารถโหลดข้อมูลได้ กรุณาลองรีเฟรชอีกครั้ง</td>
        </tr>
      `;
    }
  }
}

/* ============================================================================
   SYSTEM STATUS TOGGLE
   (ยังใช้ localStorage เพราะเป็นค่ากำหนดของหน้าจอฝั่งเจ้าหน้าที่ ไม่ใช่ข้อมูลหลักในระบบ
    หากมีตาราง settings ใน Supabase แล้ว ให้เปลี่ยนสองฟังก์ชันนี้ไปอ่าน/เขียนตารางนั้นแทน)
   ============================================================================ */

function updateSystemStatusUI(isAccepting) {
  const badge = document.getElementById('system-status-badge');
  const btnText = document.getElementById('toggle-btn-text');
  if (!badge || !btnText) return;

  if (isAccepting) {
    badge.className = 'status-badge on';
    badge.innerHTML = `<span class="status-dot pulse"></span>เปิดรับแจ้งความ`;
    btnText.textContent = 'ระงับรับแจ้งชั่วคราว';
  } else {
    badge.className = 'status-badge off';
    badge.innerHTML = `<span class="status-dot"></span>ระงับการรับแจ้งความ`;
    btnText.textContent = 'เปิดระบบรับแจ้งความ';
  }
}

function toggleSystemStatus() {
  const currentStatus = localStorage.getItem('system_accepting_reports') !== 'false';
  const newStatus = !currentStatus;
  localStorage.setItem('system_accepting_reports', String(newStatus));
  updateSystemStatusUI(newStatus);
}

/* ============================================================================
   PROOF MODAL
   ============================================================================ */

function openProofModal(id, name, recipient, date, proofUrl, note) {
  const modal = document.getElementById('proof-modal');
  const modalItemId = document.getElementById('modal-item-id');
  const modalItemName = document.getElementById('modal-item-name');
  const modalRecipient = document.getElementById('modal-recipient');
  const modalDate = document.getElementById('modal-date');
  const modalNote = document.getElementById('modal-note');
  const imgEl = document.getElementById('modal-proof-img');
  const noImgEl = document.getElementById('modal-no-img');
  const imgNameEl = document.getElementById('modal-img-name');

  if (
    !modal || !modalItemId || !modalItemName || !modalRecipient ||
    !modalDate || !modalNote || !imgEl || !noImgEl || !imgNameEl
  ) return;

  modalItemId.innerText = String(id).startsWith('#') ? id : `#${id}`;
  modalItemName.innerText = name;
  modalRecipient.innerText = recipient;
  modalDate.innerText = date;
  modalNote.innerText = note ? `"${note}"` : 'ส่งมอบคืนเจ้าของสำเร็จเรียบร้อยแล้ว';

  imgEl.onerror = null;
  imgEl.src = '';
  imgEl.classList.add('hidden');
  noImgEl.classList.remove('hidden');
  imgNameEl.innerText = 'ไม่พบไฟล์รูปถ่ายหลักฐาน';

  if (proofUrl && String(proofUrl).trim() !== '') {
    imgEl.src = String(proofUrl);
    imgEl.classList.remove('hidden');
    noImgEl.classList.add('hidden');
    imgEl.onerror = () => {
      imgEl.classList.add('hidden');
      noImgEl.classList.remove('hidden');
      imgNameEl.innerText = 'ไม่สามารถเปิดไฟล์หลักฐานได้';
    };
  }

  modal.classList.remove('hidden');
  requestAnimationFrame(() => modal.classList.add('show'));
  document.body.classList.add('overflow-hidden');
}

function closeProofModal() {
  const modal = document.getElementById('proof-modal');
  if (!modal) return;
  modal.classList.remove('show');
  setTimeout(() => modal.classList.add('hidden'), 200);
  document.body.classList.remove('overflow-hidden');
}

function handleModalBackgroundClick(event) {
  const modal = document.getElementById('proof-modal');
  if (event.target === modal) closeProofModal();
}

/* ============================================================================
   EVENT WIRING
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const isAccepting = localStorage.getItem('system_accepting_reports') !== 'false';
  updateSystemStatusUI(isAccepting);

  document.getElementById('toggle-system-btn')?.addEventListener('click', toggleSystemStatus);
  document.getElementById('refresh-btn')?.addEventListener('click', fetchRealtimeDashboardData);
  document.getElementById('proof-modal-close')?.addEventListener('click', closeProofModal);
  document.getElementById('proof-modal')?.addEventListener('click', handleModalBackgroundClick);

  document.addEventListener('keydown', (event) => {
    const modal = document.getElementById('proof-modal');
    if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeProofModal();
    }
  });

  fetchRealtimeDashboardData();
});

window.addEventListener('focus', fetchRealtimeDashboardData);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') fetchRealtimeDashboardData();
});