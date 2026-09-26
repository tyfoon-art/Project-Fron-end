import { supabaseClient } from './supabaseClient.js';

/* ============================================================================
   ข้อสมมติฐานเรื่องโครงสร้างตาราง (แก้ชื่อ table/column ให้ตรงกับของจริงได้ที่นี่)
   ----------------------------------------------------------------------------
   - public.claim : claim_id (text, เช่น "CLM-24-0891"), item_id (FK -> item.item_id),
                    claimant_name, status, note, created_at, updated_at
     (status ของ "คำร้อง" เป็นคนละชุดกับ status ของ "สิ่งของ" ในตาราง item:
      'pending' | 'approved' | 'rejected' | 'more_info')
   - public.item  : ใช้ join เอาชื่อ/หมวดหมู่ของสิ่งของมาแสดง
                    (item_id, item_name, category, category_key, description)
   ============================================================================ */

const CLAIM_TABLE = 'claim';

let allClaims = [];
let selectedStatus = 'all';

/* ============================================================================
   STATUS DISPLAY
   ============================================================================ */

const statusDisplayMap = {
  approved: { text: 'อนุมัติแล้ว', action: 'ดูรายละเอียด' },
  rejected: { text: 'ปฏิเสธคำร้อง', action: 'ดูรายละเอียด' },
  more_info: { text: 'ขอข้อมูลเพิ่มเติม', action: 'ดูรายละเอียด' },
  pending: { text: 'รอตรวจสอบ', action: 'ตรวจสอบ' },
};

function getStatusDisplay(status) {
  return statusDisplayMap[status] || statusDisplayMap.pending;
}

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

function formatThaiDate(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';

  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function toDateKey(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/* ============================================================================
   DATA FETCHING
   ============================================================================ */

async function fetchClaims() {
  const { data, error } = await supabaseClient
    .from(CLAIM_TABLE)
    .select(`
      claim_id,
      claimant_name,
      status,
      note,
      created_at,
      item:item_id ( item_id, item_name, category, category_key, description )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/* ============================================================================
   RENDER — DATE FILTER OPTIONS
   ============================================================================ */

function populateDateFilter(claims) {
  const dateFilter = document.getElementById('dateFilter');
  const currentValue = dateFilter.value;

  const uniqueDates = [...new Set(claims.map((claim) => toDateKey(claim.created_at)).filter(Boolean))]
    .sort((a, b) => (a < b ? 1 : -1));

  dateFilter.innerHTML = '<option value="all">วันที่ทั้งหมด</option>';

  uniqueDates.forEach((dateKey) => {
    const option = document.createElement('option');
    option.value = dateKey;
    option.textContent = formatThaiDate(dateKey);
    dateFilter.appendChild(option);
  });

  if (uniqueDates.includes(currentValue)) {
    dateFilter.value = currentValue;
  }
}

/* ============================================================================
   RENDER — TABLE ROWS
   ============================================================================ */

function renderRow(claim) {
  const item = claim.item || {};
  const itemName = item.item_name || 'ไม่ระบุชื่อสิ่งของ';
  const itemDesc = item.description || '';
  const category = item.category_key || item.category || '';
  const claimId = claim.claim_id || '-';
  const status = claim.status || 'pending';
  const display = getStatusDisplay(status);
  const dateKey = toDateKey(claim.created_at);

  const row = document.createElement('tr');
  row.className = 'claim-row';
  row.dataset.claimId = claimId;
  row.dataset.category = category;
  row.dataset.status = status;
  row.dataset.date = dateKey;
  row.dataset.search = `${claimId} ${itemName} ${claim.claimant_name || ''}`.toLowerCase();

  row.innerHTML = `
    <td class="claim-id-cell">${escapeHTML(claimId)}</td>
    <td>
      <div class="item-cell">
        <div class="item-icon"><i class="fa-regular fa-image"></i></div>
        <div>
          <p class="item-name">${escapeHTML(itemName)}</p>
          ${itemDesc ? `<p class="item-desc">${escapeHTML(itemDesc)}</p>` : ''}
        </div>
      </div>
    </td>
    <td class="claimant-cell">${escapeHTML(claim.claimant_name || '-')}</td>
    <td class="date-cell">${formatThaiDate(claim.created_at)}</td>
    <td>
      <span class="status-badge ${status}">
        <span class="dot"></span>
        ${display.text}
      </span>
    </td>
    <td class="center">
      <a href="staff-verify-detail.html?id=${encodeURIComponent(claimId)}" class="action-button ${status}">
        <i class="fa-regular fa-eye"></i>
        ${display.action}
      </a>
    </td>
  `;

  return row;
}

function renderTable(claims) {
  const tbody = document.getElementById('claimTableBody');
  tbody.innerHTML = '';
  claims.forEach((claim) => tbody.appendChild(renderRow(claim)));
}

/* ============================================================================
   FILTER / SORT
   ============================================================================ */

function applyFilters() {
  const categoryFilter = document.getElementById('categoryFilter').value;
  const dateFilter = document.getElementById('dateFilter').value;
  const searchText = document.getElementById('searchInput').value.trim().toLowerCase();

  const rows = document.querySelectorAll('.claim-row');
  let visibleCount = 0;

  rows.forEach((row) => {
    const categoryMatch = categoryFilter === 'all' || row.dataset.category === categoryFilter;
    const dateMatch = dateFilter === 'all' || row.dataset.date === dateFilter;
    const statusMatch = selectedStatus === 'all' || row.dataset.status === selectedStatus;
    const searchMatch = searchText === '' || (row.dataset.search || '').includes(searchText);

    const visible = categoryMatch && dateMatch && statusMatch && searchMatch;
    row.style.display = visible ? '' : 'none';
    if (visible) visibleCount += 1;
  });

  document.getElementById('emptyState').classList.toggle('hidden', visibleCount !== 0);
}

function applySorting() {
  const tbody = document.getElementById('claimTableBody');
  const sortType = document.getElementById('sortFilter').value;

  const rows = Array.from(tbody.querySelectorAll('.claim-row'));

  rows.sort((a, b) => {
    const dateA = new Date(a.dataset.date || 0);
    const dateB = new Date(b.dataset.date || 0);
    return sortType === 'oldest' ? dateA - dateB : dateB - dateA;
  });

  rows.forEach((row) => tbody.appendChild(row));
  applyFilters();
}

function setActiveStatusTab(status) {
  selectedStatus = status;

  document.querySelectorAll('.status-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.status === status);
  });

  applyFilters();
}

function resetFilters() {
  document.getElementById('categoryFilter').value = 'all';
  document.getElementById('dateFilter').value = 'all';
  document.getElementById('searchInput').value = '';
  document.getElementById('sortFilter').value = 'latest';

  setActiveStatusTab('all');
  applySorting();
}

/* ============================================================================
   FETCH + RENDER PAGE
   ============================================================================ */

async function refreshPageData() {
  const tbody = document.getElementById('claimTableBody');

  try {
    allClaims = await fetchClaims();
    populateDateFilter(allClaims);
    renderTable(allClaims);
    applySorting();
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลคำร้อง:', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="cell-error">ไม่สามารถโหลดข้อมูลได้ กรุณาลองรีเฟรชอีกครั้ง</td></tr>`;
    }
  }
}

/* ============================================================================
   EVENT WIRING
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('categoryFilter')?.addEventListener('change', applyFilters);
  document.getElementById('dateFilter')?.addEventListener('change', applyFilters);
  document.getElementById('sortFilter')?.addEventListener('change', applySorting);
  document.getElementById('searchInput')?.addEventListener('input', applyFilters);
  document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);

  document.querySelectorAll('.status-tab').forEach((button) => {
    button.addEventListener('click', () => setActiveStatusTab(button.dataset.status));
  });

  refreshPageData();
});

window.addEventListener('focus', refreshPageData);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshPageData();
});