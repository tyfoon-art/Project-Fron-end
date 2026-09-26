import { supabaseClient } from './supabaseClient.js';

const ITEM_TABLE = 'item';
const MEDIA_TABLE = 'item_media';

const STATUS_CLASS = {
  'รอตรวจสอบ': 'status-pending',
  'อยู่ที่จุดรับฝาก': 'status-stored',
  'กำลังดำเนินการเคลม': 'status-claiming',
  'คืนสำเร็จ': 'status-returned',
  'หมดอายุ/ทำลายทิ้ง': 'status-expired',
};

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function formatThaiDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function formatTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatPostedAgo(isoString) {
  if (!isoString) return '-';
  const created = new Date(isoString).getTime();
  if (Number.isNaN(created)) return '-';
  const days = Math.max(0, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'โพสต์เมื่อวันนี้';
  return `โพสต์เมื่อ ${days} วันที่แล้ว`;
}

function getItemIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id');
}

function renderMedia(mediaList) {
  const mainImage = document.getElementById('mainImage');
  const noImage = document.getElementById('noImagePlaceholder');
  const thumbStrip = document.getElementById('thumbStrip');

  if (!mediaList.length) {
    mainImage.classList.add('hidden');
    noImage.classList.remove('hidden');
    return;
  }

  noImage.classList.add('hidden');
  mainImage.classList.remove('hidden');
  mainImage.src = mediaList[0].url;
  mainImage.alt = mediaList[0].name || '';

  thumbStrip.innerHTML = mediaList
    .map((media, index) => `<img src="${media.url}" data-index="${index}" class="${index === 0 ? 'active' : ''}" alt="thumb">`)
    .join('');

  thumbStrip.querySelectorAll('img').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      const index = Number(thumb.dataset.index);
      mainImage.src = mediaList[index].url;
      thumbStrip.querySelectorAll('img').forEach((t) => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });
}

function wireLightbox() {
  const mainImage = document.getElementById('mainImage');
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const expandBtn = document.getElementById('expandBtn');
  const closeBtn = document.getElementById('closeLightbox');

  const open = () => {
    if (!mainImage.src) return;
    lightboxImage.src = mainImage.src;
    lightbox.classList.remove('hidden');
  };
  const close = () => lightbox.classList.add('hidden');

  expandBtn.addEventListener('click', open);
  mainImage.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) close();
  });
}

async function loadDetail() {
  const itemId = getItemIdFromUrl();
  const loading = document.getElementById('loadingState');
  const notFound = document.getElementById('notFoundState');
  const content = document.getElementById('detailContent');

  if (!itemId) {
    loading.classList.add('hidden');
    notFound.classList.remove('hidden');
    return;
  }

  try {
    const { data: item, error } = await supabaseClient
      .from(ITEM_TABLE)
      .select('*')
      .eq('item_id', itemId)
      .maybeSingle();

    if (error) throw error;
    if (!item) {
      loading.classList.add('hidden');
      notFound.classList.remove('hidden');
      return;
    }

    const { data: media } = await supabaseClient
      .from(MEDIA_TABLE)
      .select('url, type, name, created_at')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true });

    document.getElementById('reporterName').textContent = item.reporter_name || 'เจ้าหน้าที่ระบบ';
    document.getElementById('reporterRole').textContent = item.reporter_role || 'ผู้แจ้งประกาศ';
    document.getElementById('postedAgo').textContent = formatPostedAgo(item.created_at);

    const statusClass = STATUS_CLASS[item.status] || 'neutral';
    document.getElementById('tagRow').innerHTML = `
      <span class="pd-tag blue"><i class="fa-solid fa-hand-holding"></i> พบสิ่งของ</span>
      <span class="pd-tag ${statusClass}">สถานะ: ${item.status || '-'}</span>
      <span class="pd-tag neutral">หมวดหมู่: ${item.category || '-'}</span>
    `;

    document.getElementById('itemName').textContent = item.item_name || '-';
    document.getElementById('referenceId').textContent = item.reference_id || '-';
    document.getElementById('foundDate').textContent = formatThaiDate(item.found_date_time);
    document.getElementById('foundTime').textContent = formatTime(item.found_date_time);
    document.getElementById('foundLocation').textContent = item.found_location || '-';
    document.getElementById('publicDescription').textContent = item.description || 'ไม่มีรายละเอียดเพิ่มเติม';
    document.getElementById('staffDefectNote').textContent = item.staff_defect_note || 'ไม่มีการระบุตำหนิเฉพาะ';

    renderMedia(media || []);

    const storeButton = document.getElementById('storeButton');
    if (item.status === 'อยู่ที่จุดรับฝาก') {
      storeButton.innerHTML = '<i class="fa-solid fa-circle-check"></i> บันทึกเข้าคลังแล้ว';
      storeButton.disabled = true;
      storeButton.style.opacity = '0.6';
      storeButton.style.cursor = 'not-allowed';
    } else {
      storeButton.addEventListener('click', () => {
        window.location.href = `staff-inventory-add.html?id=${encodeURIComponent(item.item_id)}`;
      });
    }

    loading.classList.add('hidden');
    content.classList.remove('hidden');
    wireLightbox();
  } catch (error) {
    console.error('โหลดรายละเอียดไม่สำเร็จ:', error);
    loading.classList.add('hidden');
    notFound.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', loadDetail);