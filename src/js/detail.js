import { supabaseClient } from './supabaseClient.js';

let currentImagesList = [];
let currentModalIndex = 0;
let currentLoadedItem = null;

function formatThaiDate(isoDateString) {
  if (!isoDateString) return '-';
  const d = new Date(isoDateString);
  const monthsThai = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  return `${d.getDate()} ${monthsThai[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function formatThaiTime(isoDateString) {
  if (!isoDateString) return 'ไม่ระบุ';
  const d = new Date(isoDateString);
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function getTimeAgo(isoDateString) {
  if (!isoDateString) return 'เมื่อสักครู่นี้';
  const now = new Date();
  const past = new Date(isoDateString);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'เมื่อสักครู่นี้';
  if (diffMins < 60) return `โพสต์เมื่อ ${diffMins} นาทีที่แล้ว`;
  if (diffHours < 24) return `โพสต์เมื่อ ${diffHours} ชั่วโมงที่แล้ว`;
  if (diffDays === 1) return 'โพสต์เมื่อวานนี้';
  return `โพสต์เมื่อ ${diffDays} วันที่แล้ว`;
}

function formatStorageText(storagePoint) {
  if (!storagePoint) return 'ยังไม่ถูกนำเข้าจุดรับฝาก';
  let text = storagePoint.storage_name || '';
  if (storagePoint.room) text += ` (ห้อง ${storagePoint.room})`;
  return text || 'ยังไม่ถูกนำเข้าจุดรับฝาก';
}

function getStatusBadgeMeta(status) {
  switch (status) {
    case 'อยู่ที่จุดรับฝาก':
      return { cls: 'badge-storage', icon: 'fa-solid fa-box-archive' };
    case 'กำลังดำเนินการเคลม':
      return { cls: 'badge-progress', icon: 'fa-regular fa-hourglass-half' };
    case 'คืนสำเร็จ':
      return { cls: 'badge-success', icon: 'fa-solid fa-circle-check' };
    case 'หมดอายุ/ทำลายทิ้ง':
      return { cls: 'badge-expired', icon: 'fa-solid fa-trash' };
    case 'รอตรวจสอบ':
    default:
      return { cls: 'badge-pending', icon: 'fa-regular fa-clock' };
  }
}

// แสดงตำหนิลับ (ข้อความ หรือ URL รูป) — เรียกเฉพาะเมื่อเป็นเจ้าของโพสต์/เจ้าหน้าที่
function renderDefect(defectNote) {
  const section = document.getElementById('defectSection');
  const imgEl = document.getElementById('defectImage');
  const noteEl = document.getElementById('defectNote');
  const emptyEl = document.getElementById('defectEmpty');
  if (!section) return;

  section.style.display = 'block';
  imgEl.style.display = 'none';
  noteEl.style.display = 'none';
  emptyEl.style.display = 'none';

  if (!defectNote) {
    emptyEl.style.display = 'block';
    return;
  }

  // รูปที่แนบตอนโพสต์ถูกเก็บเป็น data URL (base64) ส่วนรูปจาก Storage เป็น URL ปกติ
  const isImageUrl = /^data:image\//i.test(defectNote)
    || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(defectNote);
  if (isImageUrl) {
    imgEl.src = defectNote;
    imgEl.style.display = 'block';
  } else {
    noteEl.textContent = defectNote;
    noteEl.style.display = 'block';
  }
}

async function loadItemDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('id');

  if (!itemId) {
    alert('ไม่พบรหัสรายการ');
    window.location.href = 'browse.html';
    return;
  }

  // ตำหนิลับไม่ได้อยู่ในตาราง item — ดึงผ่าน RPC get_staff_defect_note (ดู loadDefectNote)
  let { data: item, error } = await supabaseClient
    .from('item')
    .select(`
      item_id,
      item_name,
      description,
      image_url,
      status,
      category_id,
      current_storage_id,
      matched_item_id,
      created_at,
      category ( category_name ),
      storage_point ( storage_name, room, description ),
      report (
        report_id,
        report_type,
        incident_location,
        incident_datetime,
        user_id,
        user_account ( full_name, email, role, avatar_url )
      )
    `)
    .eq('item_id', itemId)
    .is('deleted_at', null)
    .single();

  if (error || !item) {
    alert('ไม่พบข้อมูลรายการนี้ในระบบฐานข้อมูล');
    console.error(error);
    return;
  }

  currentLoadedItem = item;

  const report0 = (item.report && item.report[0]) ? item.report[0] : null;
  const isLostType = report0 ? report0.report_type === 'lost' : false;

  const currentUserRole0 = localStorage.getItem('userRole') || 'user';
  const isStaffUser = currentUserRole0 === 'staff' || currentUserRole0 === 'admin';

  // สถานะ "คืนสำเร็จ / หมดอายุ" มีเฉพาะเจ้าหน้าที่ที่เห็น
  const CLOSED_STATUSES = ['คืนสำเร็จ', 'หมดอายุ/ทำลายทิ้ง'];
  if (!isStaffUser && CLOSED_STATUSES.includes(item.status)) {
    alert('รายการนี้ถูกปิดแล้ว (คืนสำเร็จ/หมดอายุ) ผู้ใช้ทั่วไปไม่สามารถดูได้');
    window.location.href = 'browse.html';
    return;
  }

  // ยื่นอ้างสิทธิ์ได้เฉพาะโพสต์แจ้งพบที่สถานะ "อยู่ที่จุดรับฝาก"
  const canClaim = !isLostType && item.status === 'อยู่ที่จุดรับฝาก';

  // แก้ไข: เจ้าของแก้ไขได้ — แจ้งพบเฉพาะตอนรอตรวจสอบ, แจ้งหายได้ทุกสถานะ
  const canEdit = isLostType || item.status === 'รอตรวจสอบ';

  // ลบ: เจ้าของลบได้ — แจ้งพบเฉพาะสถานะ "รอตรวจสอบ", แจ้งหายลบได้ทุกสถานะ
  const canDelete = isLostType || item.status === 'รอตรวจสอบ';

  if (isLostType) {
    document.getElementById('dateLabelText').textContent = 'วันที่หาย';
    document.getElementById('timeLabelText').textContent = 'เวลาที่หายโดยประมาณ';
    document.getElementById('locationLabelText').textContent = 'สถานที่ทำหาย';
    document.getElementById('posterRoleText').textContent = 'นิสิตผู้ทำของหาย (คณะ ICT)';
  } else {
    document.getElementById('dateLabelText').textContent = 'วันที่พบ';
    document.getElementById('timeLabelText').textContent = 'เวลาที่พบโดยประมาณ';
    document.getElementById('locationLabelText').textContent = 'สถานที่พบ';
    document.getElementById('posterRoleText').textContent = 'ผู้แจ้งประกาศ (คณะ ICT)';
  }

  document.getElementById('detailTitle').textContent = item.item_name;
  document.getElementById('detailRef').textContent = 'REF-' + item.item_id;

  const categoryDisplayName = item.category ? item.category.category_name : '-';
  document.getElementById('detailCategory').innerHTML = `<span>หมวดหมู่: ${categoryDisplayName}</span>`;

  const incidentAt = report0 ? report0.incident_datetime : null;
  document.getElementById('detailDate').textContent = formatThaiDate(incidentAt);
  document.getElementById('detailTime').textContent = formatThaiTime(incidentAt);
  document.getElementById('detailLocation').textContent = (report0 && report0.incident_location) || 'ไม่ระบุ';
  document.getElementById('detailDescription').textContent = item.description || 'ไม่มีรายละเอียดเพิ่มเติม';

  let reporterName = 'ไม่ทราบชื่อผู้แจ้ง';
  let reporterAvatarUrl = null;
  if (report0 && report0.user_account) {
    reporterName = report0.user_account.full_name || reporterName;
    reporterAvatarUrl = report0.user_account.avatar_url || null;
  }

  document.getElementById('posterName').textContent = reporterName;
  document.getElementById('posterTimeAgo').textContent = getTimeAgo(incidentAt || item.created_at);

  const posterAvatarImg = document.getElementById('posterAvatarImg');
  posterAvatarImg.src = reporterAvatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(reporterName)}`;

  const storageWrapper = document.getElementById('storageWrapper');
  const showStorage = !isLostType && ['อยู่ที่จุดรับฝาก', 'กำลังดำเนินการเคลม', 'คืนสำเร็จ'].includes(item.status);
  storageWrapper.style.display = showStorage ? 'flex' : 'none';
  if (showStorage) {
    document.getElementById('detailStorage').textContent = formatStorageText(item.storage_point);
  }

  // โพสต์แจ้งหายมีสถานะเดียว คือ "แจ้งหาย" (ป้ายสีแดง)
  const statusEl = document.getElementById('detailStatus');
  if (isLostType) {
    statusEl.className = 'badge-status badge-lost';
    statusEl.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> <span id="statusText">สถานะ: แจ้งหาย</span>';
  } else {
    const statusText = item.status || 'รอตรวจสอบ';
    const { cls: statusClass, icon: badgeIcon } = getStatusBadgeMeta(item.status);
    statusEl.className = `badge-status ${statusClass}`;
    statusEl.innerHTML = `<i class="${badgeIcon}"></i> <span id="statusText">สถานะ: ${statusText}</span>`;
  }

  const typeEl = document.getElementById('detailReportType');
  if (typeEl) {
    typeEl.className = `badge-type ${isLostType ? 'badge-type-lost' : 'badge-type-found'}`;
    typeEl.innerHTML = isLostType
      ? '<i class="fa-solid fa-magnifying-glass"></i> <span>แจ้งหาย</span>'
      : '<i class="fa-solid fa-hand-holding"></i> <span>พบสิ่งของ</span>';
  }

  const matchedBox = document.getElementById('matchedItemBox');
  if (matchedBox) {
    if (item.matched_item_id) {
      const { data: matchedItem } = await supabaseClient
        .from('item')
        .select('item_id, item_name')
        .eq('item_id', item.matched_item_id)
        .single();
      if (matchedItem) {
        matchedBox.style.display = 'flex';
        matchedBox.href = `detail.html?id=${matchedItem.item_id}`;
        matchedBox.innerHTML = `<i class="fa-solid fa-link"></i> จับคู่แล้วกับ: ${matchedItem.item_name}`;
      }
    } else {
      matchedBox.style.display = 'none';
    }
  }

  const imgSrc = item.image_url || null;
  currentImagesList = imgSrc ? [imgSrc] : [];
  currentModalIndex = 0;

  const mainImg = document.getElementById('mainDisplayImg');
  if (currentImagesList.length > 0) {
    mainImg.src = currentImagesList[0];
    mainImg.style.display = '';
  } else {
    // ไม่มีรูป: อย่าตั้ง src เป็น undefined
    mainImg.removeAttribute('src');
    mainImg.style.display = 'none';
  }
  mainImg.alt = item.item_name;

  const thumbContainer = document.getElementById('thumbnailContainer');
  thumbContainer.innerHTML = '';

  currentImagesList.forEach((imgUrl, index) => {
    const thumb = document.createElement('div');
    thumb.className = `thumb-item ${index === 0 ? 'active' : ''}`;
    thumb.onclick = function () { changeImage(this, imgUrl, index); };
    thumb.innerHTML = `<img src="${imgUrl}" alt="${item.item_name}">`;
    thumbContainer.appendChild(thumb);
  });

  const currentUserId = localStorage.getItem('userId') || '';

  // เจ้าของโพสต์ = ผู้ที่ล็อกอินด้วย user_id เดียวกับผู้แจ้ง (ไม่เทียบจากชื่อ เพราะชื่อซ้ำกันได้)
  const reporterUserId = report0 ? report0.user_id : null;
  const isOwner = !!currentUserId && currentUserId === reporterUserId;

  const ownerActionsBox = document.getElementById('ownerActionsBox');
  const claimBox = document.getElementById('claimActionBox');
  const btnEditPost = document.getElementById('btnEditPost');
  const btnDeletePost = document.getElementById('btnDeletePost');

  // ปุ่มแก้ไข / ลบ แยกสิทธิ์กัน (เผยแต่ละปุ่มเฉพาะกรณีที่ทำได้จริง)
  const isOwnerUser = !!isOwner;

  ownerActionsBox.style.display = (isOwnerUser && (canEdit || canDelete)) ? 'flex' : 'none';
  if (btnEditPost) btnEditPost.style.display = (isOwnerUser && canEdit) ? '' : 'none';
  if (btnDeletePost) btnDeletePost.style.display = (isOwnerUser && canDelete) ? '' : 'none';

  claimBox.style.display = (!isOwnerUser && canClaim) ? 'flex' : 'none';

  // ตำหนิลับ: มีเฉพาะโพสต์แจ้งพบ และเห็นเฉพาะเจ้าของโพสต์กับเจ้าหน้าที่
  // (ฝั่ง server เก็บแยกในตาราง item_secret อ่านได้ทาง RPC get_staff_defect_note เท่านั้น)
  loadDefectNote(item.item_id, !isLostType && isOwnerUser, !isLostType && isStaffUser);
}

// ดึงรูปตำหนิลับผ่าน RPC (ตรวจสิทธิ์ซ้ำฝั่ง server)
async function loadDefectNote(itemId, isOwner, isStaff) {
  // โพสต์แจ้งหาย และผู้ใช้อื่น ไม่เห็นแม้แต่หัวข้อตำหนิลับ
  if (!isOwner && !isStaff) {
    const section = document.getElementById('defectSection');
    if (section) section.style.display = 'none';
    return;
  }

  // บอกเหตุผลที่ผู้ใช้คนนี้เห็นตำหนิลับ (เจ้าของโพสต์ หรือ เจ้าหน้าที่)
  const badge = document.getElementById('defectViewerBadge');
  if (badge) {
    badge.textContent = isOwner
      ? 'คุณเห็นเพราะเป็นเจ้าของโพสต์'
      : 'คุณเห็นเพราะเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่';
  }

  const userId = localStorage.getItem('userId') || null;

  const { data, error } = await supabaseClient.rpc('get_staff_defect_note', {
    p_item_id: itemId,
    p_user_id: userId
  });

  if (error) {
    console.error('โหลดตำหนิลับไม่สำเร็จ:', error);
    renderDefect('');
    return;
  }

  renderDefect(data || '');
}

function changeImage(element, src, index) {
  currentModalIndex = index;
  document.getElementById('mainDisplayImg').src = src;
  document.querySelectorAll('.thumb-item').forEach(el => {
    el.classList.remove('active');
  });
  element.classList.add('active');
}

function openFullscreenModal() {
  if (currentImagesList.length > 0) {
    updateModalImage();
    document.getElementById('fullscreenModal').style.display = 'flex';
  }
}

function closeFullscreenModal() {
  document.getElementById('fullscreenModal').style.display = 'none';
}

function prevModalImage() {
  currentModalIndex = (currentModalIndex - 1 + currentImagesList.length) % currentImagesList.length;
  updateModalImage();
}

function nextModalImage() {
  currentModalIndex = (currentModalIndex + 1) % currentImagesList.length;
  updateModalImage();
}

function updateModalImage() {
  document.getElementById('modalFullscreenImg').src = currentImagesList[currentModalIndex];
  document.getElementById('modalImageCounter').textContent = `รูปภาพขนาดเต็ม (${currentModalIndex + 1}/${currentImagesList.length})`;
}

function handleClaim(event) {
  event.preventDefault();
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('id');
  window.location.href = `claim.html?id=${itemId}`;
}

// เปิดหน้าแก้ไขโพสต์: ใช้ report.html เดิม ส่ง id + mode=edit
function editCurrentItem() {
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('id');

  if (!itemId) {
    alert('ไม่พบรหัสรายการที่ต้องการแก้ไข');
    return;
  }

  window.location.href = `report.html?id=${itemId}&mode=edit`;
}

async function deleteCurrentItem() {
  const item = currentLoadedItem;
  const reportMeta = (item && item.report && item.report[0]) ? item.report[0] : null;
  const isLostType = reportMeta ? reportMeta.report_type === 'lost' : false;

  // แจ้งพบลบได้เฉพาะสถานะรอตรวจสอบ / แจ้งหายลบได้ทุกสถานะ
  if (item && !isLostType && item.status !== 'รอตรวจสอบ') {
    alert('โพสต์แจ้งพบสามารถลบได้เฉพาะตอนสถานะ "รอตรวจสอบ" เท่านั้น');
    return;
  }

  if (!confirm('คุณต้องการลบโพสต์นี้ออกจากระบบใช่หรือไม่?')) return;

  const userId = localStorage.getItem('userId');
  if (!userId) {
    alert('กรุณาเข้าสู่ระบบก่อน');
    window.location.href = 'login.html';
    return;
  }

  if (!reportMeta || !reportMeta.report_id) {
    alert('ไม่พบข้อมูลใบแจ้งของโพสต์นี้ ไม่สามารถลบได้');
    return;
  }

  const { error } = await supabaseClient.rpc('delete_report', {
    p_report_id: reportMeta.report_id,
    p_user_id: userId
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('NOT_OWNER')) {
      alert('คุณไม่ใช่เจ้าของโพสต์นี้ จึงไม่สามารถลบได้');
    } else if (msg.includes('EDIT_NOT_ALLOWED')) {
      alert('โพสต์แจ้งพบสามารถลบได้เฉพาะตอนสถานะ "รอตรวจสอบ" เท่านั้น');
    } else if (msg.includes('REPORT_NOT_FOUND')) {
      alert('ไม่พบโพสต์นี้ในระบบ อาจถูกลบไปแล้ว');
      window.location.href = 'browse.html';
    } else {
      alert('เกิดข้อผิดพลาดในการลบ: ' + msg);
    }
  } else {
    alert('ลบโพสต์เรียบร้อยแล้ว');
    window.location.href = 'browse.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadItemDetail();

  // ผูกปุ่ม "แก้ไขโพสต์" ด้วย JS โดยตรง
  const btnEdit = document.getElementById('btnEditPost');
  if (btnEdit) {
    btnEdit.addEventListener('click', (e) => {
      e.preventDefault();
      editCurrentItem();
    });
  }
});

// Export Functions for Onclick Events
window.openFullscreenModal = openFullscreenModal;
window.closeFullscreenModal = closeFullscreenModal;
window.prevModalImage = prevModalImage;
window.nextModalImage = nextModalImage;
window.changeImage = changeImage;
window.handleClaim = handleClaim;
window.editCurrentItem = editCurrentItem;
window.deleteCurrentItem = deleteCurrentItem;