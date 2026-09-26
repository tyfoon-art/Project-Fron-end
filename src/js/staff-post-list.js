import { supabaseClient } from './supabaseClient.js';

const ITEM_TABLE = 'item';
const MEDIA_TABLE = 'item_media';

const STATUS_META = {
  'รอตรวจสอบ': { icon: 'fa-clock', class: 'status-pending' },
  'อยู่ที่จุดรับฝาก': { icon: 'fa-box-archive', class: 'status-stored' },
  'กำลังดำเนินการเคลม': { icon: 'fa-hourglass-half', class: 'status-claiming' },
  'คืนสำเร็จ': { icon: 'fa-circle-check', class: 'status-returned' },
  'หมดอายุ/ทำลายทิ้ง': { icon: 'fa-trash', class: 'status-expired' },
};

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const PENDING_STATUS = 'รอตรวจสอบ';

let allItems = [];

function formatThaiDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  const day = date.getDate();
  const month = THAI_MONTHS[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

function badgeHtml(status) {
  const meta = STATUS_META[status] || { icon: 'fa-circle-question', class: 'status-pending' };
  return `<span class="pl-badge ${meta.class}"><i class="fa-solid ${meta.icon}"></i>${status || '-'}</span>`;
}

function cardHtml(item) {
  const image = item.thumbnailUrl
    ? `<img src="${item.thumbnailUrl}" alt="${item.item_name || ''}">`
    : `<div class="pl-card-noimage"><i class="fa-regular fa-image"></i><span>ไม่มีรูปภาพ</span></div>`;

  return `
    <article class="pl-card">
      <div class="pl-card-image">
        ${image}
        ${badgeHtml(item.status)}
      </div>
      <div class="pl-card-body">
        <h3 class="pl-card-title">${item.item_name || '-'}</h3>
        <p class="pl-card-category">${item.category || '-'}</p>
        <div class="pl-card-meta"><i class="fa-regular fa-calendar"></i>${formatThaiDate(item.found_date_time)}</div>
        <div class="pl-card-meta"><i class="fa-solid fa-location-dot"></i>${item.found_location || item.location_zone || '-'}</div>
        <a class="pl-card-btn" href="staff-post-detail.html?id=${encodeURIComponent(item.item_id)}">
          ดูรายละเอียด <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    </article>
  `;
}

function renderGrid() {
  const grid = document.getElementById('postGrid');
  const empty = document.getElementById('emptyState');

  grid.innerHTML = allItems.map(cardHtml).join('');
  empty.classList.toggle('hidden', allItems.length > 0);
}

async function loadItems() {
  const loading = document.getElementById('loadingState');
  loading.classList.remove('hidden');

  try {
    const { data: items, error } = await supabaseClient
      .from(ITEM_TABLE)
      .select('item_id, reference_id, item_name, category, status, found_location, found_date_time, created_at')
      .eq('status', PENDING_STATUS)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    allItems = items || [];

    if (allItems.length) {
      const itemIds = allItems.map((item) => item.item_id);
      const { data: media, error: mediaError } = await supabaseClient
        .from(MEDIA_TABLE)
        .select('item_id, url, created_at')
        .in('item_id', itemIds)
        .order('created_at', { ascending: true });

      if (!mediaError && media) {
        const firstMediaByItem = {};
        media.forEach((row) => {
          if (!firstMediaByItem[row.item_id]) firstMediaByItem[row.item_id] = row.url;
        });
        allItems = allItems.map((item) => ({ ...item, thumbnailUrl: firstMediaByItem[item.item_id] || null }));
      }
    }

    renderGrid();
  } catch (error) {
    console.error('โหลดรายการไม่สำเร็จ:', error);
    document.getElementById('postGrid').innerHTML = '';
    document.getElementById('emptyState').classList.remove('hidden');
  } finally {
    loading.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadItems();
});