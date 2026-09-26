import { supabaseClient } from './supabaseClient.js';

/* ============================================================================
   ข้อสมมติฐานเรื่องโครงสร้างตาราง (แก้ชื่อ table/column ให้ตรงกับของจริงได้ที่นี่)
   ----------------------------------------------------------------------------
   - public.item       : item_id, reference_id, item_name, category, category_key,
                          storage_room, shelf_id, bin_id, storage_location,
                          found_date_time, status, created_at, updated_at,
                          disposed_at (วันที่ดำเนินการจำหน่ายออกสำเร็จ), deleted_at
                          (status ใช้ enum เดียวกับหน้า dashboard:
                           'รอตรวจสอบ' | 'อยู่ที่จุดรับฝาก' | 'กำลังดำเนินการเคลม'
                           | 'คืนสำเร็จ' | 'หมดอายุ/ทำลายทิ้ง')
   - public.item_media : media_id, item_id, url, type, name, created_at
     (ใช้ดึงรูปแรกของแต่ละชิ้นมาแสดงเป็นภาพตัวอย่างในตาราง)
   ============================================================================ */

const ITEM_TABLE = 'item';
const MEDIA_TABLE = 'item_media';

const DISPOSAL_DAYS = 30;

const OPEN_STATUSES = ['รอตรวจสอบ', 'อยู่ที่จุดรับฝาก', 'กำลังดำเนินการเคลม'];
const DISPOSED_STATUS = 'หมดอายุ/ทำลายทิ้ง';

const categoryFilterMap = {
  electronics: 'อุปกรณ์ไอที',
  bags: 'เครื่องแต่งกาย / เครื่องประดับ',
  clothing: 'เครื่องแต่งกาย / เครื่องประดับ',
  documents: 'เอกสาร / บัตร',
  personal: 'อื่นๆ',
  other: 'อื่นๆ',
};

let allItems = [];
let mediaByItemId = new Map();

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

function normalizeCategory(category) {
  return String(category || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/ๆ/g, '')
    .replace(/\//g, '');
}

function formatThaiDate(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';

  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function calculateDaysInStorage(item) {
  const dateValue = item.created_at;
  if (!dateValue) return 0;

  const created = new Date(dateValue);
  if (Number.isNaN(created.getTime())) return 0;

  const now = new Date();
  const start = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function getCategory(item) {
  const key = String(item.category_key || '').trim().toLowerCase();
  if (categoryFilterMap[key]) return categoryFilterMap[key];
  return item.category || 'อื่นๆ';
}

function getStorageLocation(item) {
  if (item.storage_location) return item.storage_location;

  const parts = [];
  if (item.storage_room) parts.push(item.storage_room);
  if (item.shelf_id) parts.push(item.shelf_id);
  if (item.bin_id) parts.push(`ช่อง ${item.bin_id}`);

  return parts.length ? parts.join(' / ') : '-';
}

/* ============================================================================
   DATA FETCHING
   ============================================================================ */

async function fetchOpenItems() {
  const { data, error } = await supabaseClient
    .from(ITEM_TABLE)
    .select('*')
    .in('status', OPEN_STATUSES)
    .is('deleted_at', null);

  if (error) throw error;
  return data || [];
}

async function fetchDisposedThisMonthCount() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { count, error } = await supabaseClient
    .from(ITEM_TABLE)
    .select('item_id', { count: 'exact', head: true })
    .eq('status', DISPOSED_STATUS)
    .gte('disposed_at', monthStart)
    .lt('disposed_at', monthEnd);

  if (error) throw error;
  return count || 0;
}

async function fetchFirstMediaByItem(itemIds) {
  if (!itemIds.length) return new Map();

  const { data, error } = await supabaseClient
    .from(MEDIA_TABLE)
    .select('item_id, url, created_at')
    .in('item_id', itemIds)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const map = new Map();
  (data || []).forEach((row) => {
    if (!map.has(row.item_id)) {
      map.set(row.item_id, row.url);
    }
  });

  return map;
}

/* ============================================================================
   RENDER — THUMBNAIL / DURATION / DISPOSAL BUTTON
   ============================================================================ */

function createThumbHTML(itemId) {
  const url = mediaByItemId.get(itemId);

  if (url) {
    return `
      <div class="ov-item-thumb">
        <img src="${escapeHTML(url)}" alt="รูปสิ่งของ" onerror="this.parentElement.innerHTML='<i class=&quot;fa-regular fa-image&quot;></i>'">
      </div>
    `;
  }

  return `<div class="ov-item-thumb"><i class="fa-regular fa-image"></i></div>`;
}

function createDurationBadge(days) {
  if (days >= DISPOSAL_DAYS) {
    return `<span class="duration-pill overdue"><span class="dot"></span>${days} วัน</span>`;
  }

  const remaining = Math.max(0, DISPOSAL_DAYS - days);
  return `<span class="duration-pill pending"><span class="dot"></span>${days} วัน <span class="rest">(เหลือ ${remaining} วัน)</span></span>`;
}

function createDisposalButton(item, days) {
  const itemId = item.item_id || item.reference_id || '';

  if (!itemId) {
    return `<button type="button" disabled class="disposal-btn disabled" title="ไม่พบรหัสสิ่งของ"><i class="fa-solid fa-lock"></i> ไม่พบรหัส</button>`;
  }

  if (days >= DISPOSAL_DAYS) {
    return `<a href="staff-dispose-process.html?id=${encodeURIComponent(itemId)}" class="disposal-btn active" title="ดำเนินการจำหน่ายสิ่งของ"><i class="fa-solid fa-box-archive"></i> จำหน่ายออก</a>`;
  }

  const remaining = Math.max(0, DISPOSAL_DAYS - days);
  return `<button type="button" disabled class="disposal-btn disabled" title="ยังไม่ครบ 30 วัน ไม่สามารถจำหน่ายได้"><i class="fa-solid fa-lock"></i> รออีก ${remaining} วัน</button>`;
}

/* ============================================================================
   RENDER TABLE
   ============================================================================ */

function renderRow(item) {
  const days = calculateDaysInStorage(item);
  const category = getCategory(item);
  const location = getStorageLocation(item);
  const itemId = item.item_id || item.reference_id || '-';
  const name = item.item_name || 'ไม่ระบุชื่อสิ่งของ';
  const date = formatThaiDate(item.found_date_time || item.created_at);

  const row = document.createElement('tr');
  row.dataset.days = days;
  row.dataset.category = normalizeCategory(category);
  row.dataset.search = `${itemId} ${name} ${category} ${location}`.toLowerCase().trim();

  row.innerHTML = `
    <td>
      <div class="ov-item-cell">
        ${createThumbHTML(item.item_id)}
        <div>
          <p class="ov-item-name">${escapeHTML(name)}</p>
          <p class="ov-item-id">${escapeHTML(itemId)}</p>
        </div>
      </div>
    </td>
    <td>${escapeHTML(category)}</td>
    <td>${escapeHTML(date)}</td>
    <td>${createDurationBadge(days)}</td>
    <td><span class="ov-location-cell" title="${escapeHTML(location)}">${escapeHTML(location)}</span></td>
    <td class="center">${createDisposalButton(item, days)}</td>
  `;

  return row;
}

function renderTable(items) {
  const tbody = document.getElementById('overdueTableBody');
  const table = document.getElementById('overdueTable');
  const emptyState = document.getElementById('emptyState');
  const emptyStateMessage = document.getElementById('emptyStateMessage');

  tbody.innerHTML = '';

  const sorted = [...items].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  if (sorted.length === 0) {
    table.classList.add('hidden');
    emptyState.classList.remove('hidden');
    emptyStateMessage.textContent = 'ยังไม่มีสิ่งของที่ถูกบันทึกเข้าคลัง หรือรายการทั้งหมดถูกจำหน่ายหรือส่งคืนแล้ว';
    return;
  }

  table.classList.remove('hidden');
  emptyState.classList.add('hidden');

  sorted.forEach((item) => tbody.appendChild(renderRow(item)));
}

/* ============================================================================
   STATISTICS
   ============================================================================ */

function updateStatCards(items, disposedThisMonth) {
  const total = items.length;
  const over30 = items.filter((item) => calculateDaysInStorage(item) >= DISPOSAL_DAYS).length;

  document.getElementById('totalOverdue').textContent = total;
  document.getElementById('over30Days').textContent = over30;
  document.getElementById('disposedThisMonth').textContent = disposedThisMonth;
}

/* ============================================================================
   FILTER
   ============================================================================ */

function filterTable() {
  const searchValue = document.getElementById('searchInput').value.toLowerCase().trim();
  const categoryValue = normalizeCategory(document.getElementById('categoryFilter').value);
  const timeValue = document.getElementById('timeFilter').value;

  const rows = document.querySelectorAll('#overdueTableBody tr');
  const table = document.getElementById('overdueTable');
  const emptyState = document.getElementById('emptyState');
  const emptyStateMessage = document.getElementById('emptyStateMessage');

  let visibleCount = 0;

  rows.forEach((row) => {
    const rowSearch = row.dataset.search || '';
    const rowCategory = row.dataset.category || '';
    const days = parseInt(row.dataset.days || '0', 10);

    const matchesSearch = rowSearch.includes(searchValue);
    const matchesCategory = categoryValue === '' || rowCategory.includes(categoryValue);

    let matchesTime = true;
    if (timeValue === '30') matchesTime = days >= 30;
    if (timeValue === '60') matchesTime = days >= 60;

    const visible = matchesSearch && matchesCategory && matchesTime;
    row.style.display = visible ? '' : 'none';
    if (visible) visibleCount += 1;
  });

  if (rows.length === 0) {
    table.classList.add('hidden');
    emptyState.classList.remove('hidden');
    emptyStateMessage.textContent = 'ยังไม่มีสิ่งของที่ถูกบันทึกเข้าคลัง หรือรายการทั้งหมดถูกจำหน่ายหรือส่งคืนแล้ว';
  } else if (visibleCount === 0) {
    table.classList.remove('hidden');
    emptyState.classList.remove('hidden');
    emptyStateMessage.textContent = 'ไม่พบรายการตามเงื่อนไขที่ค้นหา';
  } else {
    table.classList.remove('hidden');
    emptyState.classList.add('hidden');
  }
}

/* ============================================================================
   FETCH + RENDER PAGE
   ============================================================================ */

async function refreshPageData() {
  const tbody = document.getElementById('overdueTableBody');

  try {
    const items = await fetchOpenItems();
    const itemIds = items.map((item) => item.item_id).filter(Boolean);

    const [mediaMap, disposedThisMonth] = await Promise.all([
      fetchFirstMediaByItem(itemIds),
      fetchDisposedThisMonthCount(),
    ]);

    allItems = items;
    mediaByItemId = mediaMap;

    renderTable(allItems);
    updateStatCards(allItems, disposedThisMonth);
    filterTable();
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลรายการตกค้าง:', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="cell-error">ไม่สามารถโหลดข้อมูลได้ กรุณาลองรีเฟรชอีกครั้ง</td></tr>`;
    }
  }
}

/* ============================================================================
   TOP SEARCH / URL PARAMS
   ============================================================================ */

function loadSearchFromURL() {
  const params = new URLSearchParams(window.location.search);
  const search = params.get('search');
  if (!search) return;

  document.getElementById('searchInput').value = search;
  filterTable();
}

/* ============================================================================
   EVENT WIRING
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchInput')?.addEventListener('input', filterTable);
  document.getElementById('categoryFilter')?.addEventListener('change', filterTable);
  document.getElementById('timeFilter')?.addEventListener('change', filterTable);

  refreshPageData().then(loadSearchFromURL);
});

window.addEventListener('focus', refreshPageData);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshPageData();
});