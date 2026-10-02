import './staff-auth.js';
import { supabaseClient } from './supabaseClient.js';
import { staffSession } from './staff-auth.js';

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
  const diffMs = Date.now() - created;
  const mins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (mins < 1) return 'โพสต์เมื่อสักครู่นี้';
  if (mins < 60) return `โพสต์เมื่อ ${mins} นาทีที่แล้ว`;
  if (hours < 24) return `โพสต์เมื่อ ${hours} ชั่วโมงที่แล้ว`;
  return `โพสต์เมื่อ ${days} วันที่แล้ว`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
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
    thumbStrip.innerHTML = '';
    return;
  }

  noImage.classList.add('hidden');
  mainImage.classList.remove('hidden');
  mainImage.src = mediaList[0].url;
  mainImage.alt = mediaList[0].name || '';

  thumbStrip.innerHTML = mediaList
    .map((media, index) => `<img src="${escapeHtml(media.url)}" data-index="${index}" class="${index === 0 ? 'active' : ''}" alt="thumb">`)
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

function renderDefect(defectNote) {
  const defectImgEl = document.getElementById('staffDefectImage');
  const defectNoteEl = document.getElementById('staffDefectNote');
  const defectPlaceholder = document.getElementById('staffDefectPlaceholder');

  // ซ่อนทุกอย่างก่อน แล้วค่อยเปิดอันที่ต้องใช้
  if (defectImgEl) defectImgEl.style.display = 'none';
  if (defectNoteEl) defectNoteEl.style.display = 'none';
  if (defectPlaceholder) defectPlaceholder.style.display = 'none';

  if (!defectNote) {
    if (defectPlaceholder) defectPlaceholder.style.display = 'block';
    return;
  }

  // รูปที่แนบตอนโพสต์เป็น data URL (base64) / รูปจาก Storage เป็น URL (อาจมี query string)
  const isImageUrl = /^data:image\//i.test(defectNote)
    || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(defectNote);
  if (isImageUrl && defectImgEl) {
    defectImgEl.src = defectNote;
    defectImgEl.style.display = 'block';
  } else if (defectNoteEl) {
    defectNoteEl.textContent = defectNote;
    defectNoteEl.style.display = 'block';
  }
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
    // query ชุดเดียวกับ detail.js ฝั่งผู้ใช้
    // ตำหนิลับไม่ได้อยู่ในตาราง item — ดึงผ่าน RPC get_staff_defect_note ด้านล่าง
    const { data: item, error } = await supabaseClient
      .from(ITEM_TABLE)
      .select(`
        item_id,
        item_name,
        description,
        image_url,
        status,
        created_at,
        category ( category_name ),
        report (
          report_id,
          report_type,
          incident_location,
          incident_datetime,
          user_id,
          user_account ( full_name, role, avatar_url )
        )
      `)
      .eq('item_id', itemId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!item) {
      loading.classList.add('hidden');
      notFound.classList.remove('hidden');
      return;
    }

    // report เป็น array (ตาม detail.js)
    const report0 = Array.isArray(item.report) ? (item.report[0] || null) : (item.report || null);
    const isLost = report0?.report_type === 'lost';
    const incidentAt = report0?.incident_datetime || null;

    // รูปภาพ: image_url เป็นหลัก + รูปเพิ่มเติมจาก item_media (ถ้ามี)
    const mediaList = [];
    if (item.image_url) mediaList.push({ url: item.image_url, name: item.item_name });

    const { data: extraMedia, error: mediaError } = await supabaseClient
      .from(MEDIA_TABLE)
      .select('url, type, name, created_at')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true });

    if (mediaError) {
      console.warn('โหลด item_media ไม่สำเร็จ (ข้ามไป):', mediaError);
    } else {
      (extraMedia || []).forEach((m) => {
        if (m.url && !mediaList.some((x) => x.url === m.url)) mediaList.push(m);
      });
    }

    // ผู้แจ้ง
    const reporterName = report0?.user_account?.full_name || 'ไม่ทราบชื่อผู้แจ้ง';
    document.getElementById('reporterName').textContent = reporterName;
    document.getElementById('reporterRole').textContent = isLost
      ? 'นิสิตผู้ทำของหาย (คณะ ICT)'
      : 'ผู้แจ้งประกาศ (คณะ ICT)';
    document.getElementById('postedAgo').textContent = formatPostedAgo(item.created_at);

    const avatarUrl = report0?.user_account?.avatar_url;
    if (avatarUrl) {
      const avatarBox = document.querySelector('.pd-reporter-avatar');
      if (avatarBox) {
        avatarBox.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      }
    }

    // แท็ก
    const statusClass = STATUS_CLASS[item.status] || 'neutral';
    const categoryName = item.category?.category_name || '-';
    document.getElementById('tagRow').innerHTML = `
      <span class="pd-tag ${isLost ? 'red' : 'blue'}"><i class="fa-solid ${isLost ? 'fa-triangle-exclamation' : 'fa-hand-holding'}"></i> ${isLost ? 'แจ้งหาย' : 'แจ้งพบ'}</span>
      <span class="pd-tag ${statusClass}">สถานะ: ${escapeHtml(item.status || '-')}</span>
      <span class="pd-tag neutral">หมวด: ${escapeHtml(categoryName)}</span>
    `;

    document.getElementById('itemName').textContent = item.item_name || '-';
    document.getElementById('referenceId').textContent = 'REF-' + item.item_id;
    document.getElementById('foundDate').textContent = formatThaiDate(incidentAt);
    document.getElementById('foundTime').textContent = formatTime(incidentAt);
    document.getElementById('foundLocation').textContent = report0?.incident_location || '-';
    document.getElementById('publicDescription').textContent = item.description || 'ไม่มีรายละเอียดเพิ่มเติม';

    renderDefect('');
    renderMedia(mediaList);

    // ตำหนิลับมีเฉพาะโพสต์แจ้งพบ — โพสต์แจ้งหายซ่อนทั้งหัวข้อ
    const defectSection = document.getElementById('staffDefectSection');
    if (defectSection) defectSection.classList.toggle('hidden', isLost);

    if (!isLost) {
      // ดึงผ่าน RPC (เจ้าหน้าที่/เจ้าของโพสต์เท่านั้นที่ RPC จะคืนค่าให้)
      const { data: defectNote, error: defectError } = await supabaseClient.rpc('get_staff_defect_note', {
        p_item_id: itemId,
        p_user_id: staffSession.userId || null
      });

      if (defectError) {
        console.warn('โหลดตำหนิลับไม่สำเร็จ:', defectError);
      } else {
        renderDefect(defectNote || '');
      }
    }

    // ปุ่มบันทึกเข้าคลัง
    const storeButton = document.getElementById('storeButton');
    storeButton.classList.remove('hidden');

    const disableStoreButton = (html) => {
      storeButton.innerHTML = html;
      storeButton.disabled = true;
      storeButton.style.opacity = '0.6';
      storeButton.style.cursor = 'not-allowed';
    };

    if (isLost) {
      disableStoreButton('<i class="fa-solid fa-circle-info"></i> โพสต์แจ้งหายไม่สามารถบันทึกเข้าคลังได้');
    } else if (item.status === 'อยู่ที่จุดรับฝาก') {
      disableStoreButton('<i class="fa-solid fa-circle-check"></i> บันทึกเข้าคลังแล้ว');
    } else if (item.status !== 'รอตรวจสอบ') {
      disableStoreButton(`<i class="fa-solid fa-circle-info"></i> สถานะปัจจุบัน: ${escapeHtml(item.status || '-')}`);
    } else {
      storeButton.innerHTML = '<i class="fa-solid fa-box-archive"></i> บันทึกสิ่งของเข้าคลัง (Staff Storage)';
      storeButton.disabled = false;
      storeButton.style.opacity = '1';
      storeButton.style.cursor = 'pointer';
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