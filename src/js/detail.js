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

async function loadItemDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('id');

  if (!itemId) {
    alert('ไม่พบรหัสรายการ');
    window.location.href = 'browse.html';
    return;
  }

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
  const canClaim = item.status === 'อยู่ที่จุดรับฝาก';

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
  const showStorage = ['อยู่ที่จุดรับฝาก', 'กำลังดำเนินการเคลม', 'คืนสำเร็จ'].includes(item.status);
  storageWrapper.style.display = showStorage ? 'flex' : 'none';
  if (showStorage) {
    document.getElementById('detailStorage').textContent = formatStorageText(item.storage_point);
  }

  const statusText = item.status || 'รอตรวจสอบ';
  const { cls: statusClass, icon: badgeIcon } = getStatusBadgeMeta(item.status);
  const statusEl = document.getElementById('detailStatus');
  statusEl.className = `badge-status ${statusClass}`;
  statusEl.innerHTML = `<i class="${badgeIcon}"></i> <span id="statusText">สถานะ: ${statusText}</span>`;

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
  mainImg.src = currentImagesList[0];
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
  const currentUserName = localStorage.getItem('userName') || '';
  const currentUserRole = localStorage.getItem('userRole') || 'user';

  const reporterUserId = report0 ? report0.user_id : null;
  const isOwner = currentUserId
    ? currentUserId === reporterUserId
    : (!!currentUserName && reporterName.trim() === currentUserName.trim());
  const isStaff = currentUserRole === 'staff' || currentUserRole === 'admin';

  const ownerActionsBox = document.getElementById('ownerActionsBox');
  const staffStorageBox = document.getElementById('staffStorageActionBox');
  const claimBox = document.getElementById('claimActionBox');

  ownerActionsBox.style.display = isOwner ? 'flex' : 'none';
  staffStorageBox.style.display = (isStaff && !showStorage) ? 'block' : 'none';
  claimBox.style.display = (!isOwner && canClaim) ? 'flex' : 'none';
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

// 🟢 ฟังก์ชันสำหรับเปิดหน้าแก้ไขโพสต์
// ใช้หน้า report.html เดิม (หน้าเดียวกับตอนโพสต์ใหม่) แต่ส่ง id + mode=edit ไปด้วย
// เพื่อให้ report.html รู้ว่าต้องโหลดข้อมูลเดิมมา prefill และอัปเดตแทนการสร้างใหม่
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
  if (!confirm('คุณต้องการลบโพสต์นี้ออกจากระบบใช่หรือไม่?')) return;

  const userId = localStorage.getItem('userId');
  if (!userId) {
    alert('กรุณาเข้าสู่ระบบก่อน');
    window.location.href = 'login.html';
    return;
  }

  const report0 = (currentLoadedItem && currentLoadedItem.report && currentLoadedItem.report[0])
    ? currentLoadedItem.report[0]
    : null;

  if (!report0 || !report0.report_id) {
    alert('ไม่พบข้อมูลใบแจ้งของโพสต์นี้ ไม่สามารถลบได้');
    return;
  }

  const { error } = await supabaseClient.rpc('delete_report', {
    p_report_id: report0.report_id,
    p_user_id: userId
  });

  if (error) {
    if (error.message.includes('NOT_OWNER')) {
      alert('คุณไม่ใช่เจ้าของโพสต์นี้ จึงไม่สามารถลบได้');
    } else {
      alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
    }
  } else {
    alert('ลบโพสต์เรียบร้อยแล้ว');
    window.location.href = 'browse.html';
  }
}

async function saveItemToStaffStorage() {
  if (!currentLoadedItem) return;

  const userId = localStorage.getItem('userId');
  if (!userId) {
    alert('กรุณาเข้าสู่ระบบก่อน');
    window.location.href = 'login.html';
    return;
  }

  if (!confirm('คุณต้องการบันทึกสิ่งของนี้เข้าสู่จุดรับฝากของเจ้าหน้าที่ใช่หรือไม่?')) return;

  const { error } = await supabaseClient.rpc('save_item_to_storage', {
    p_item_id: currentLoadedItem.item_id,
    p_user_id: userId
  });

  if (error) {
    if (error.message.includes('NOT_STAFF')) {
      alert('เฉพาะเจ้าหน้าที่เท่านั้นที่ทำรายการนี้ได้');
    } else {
      alert('บันทึกไม่สำเร็จ: ' + error.message);
    }
    return;
  }

  alert('บันทึกสิ่งของเข้าคลังเรียบร้อยแล้ว');
  location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
  loadItemDetail();

  // ผูกปุ่ม "แก้ไขโพสต์" ด้วย JS โดยตรง กันกรณี HTML ไม่มี onclick กำกับไว้
  const btnEdit = document.getElementById('btnEditPost');
  console.log('[DEBUG] btnEditPost element:', btnEdit); // ชั่วคราวสำหรับ debug
  if (btnEdit) {
    btnEdit.addEventListener('click', (e) => {
      console.log('[EDIT BUTTON CLICKED]'); // ชั่วคราวสำหรับ debug
      e.preventDefault();
      editCurrentItem();
    });
  } else {
    console.log('[DEBUG] ไม่พบปุ่ม btnEditPost ใน DOM เลย'); // ชั่วคราวสำหรับ debug
  }
});

// Export Functions for Onclick Events
window.openFullscreenModal = openFullscreenModal;
window.closeFullscreenModal = closeFullscreenModal;
window.prevModalImage = prevModalImage;
window.nextModalImage = nextModalImage;
window.changeImage = changeImage;
window.handleClaim = handleClaim;
window.editCurrentItem = editCurrentItem; // 🟢 เพิ่ม Export ฟังก์ชันสำหรับแก้ไขโพสต์
window.deleteCurrentItem = deleteCurrentItem;
window.saveItemToStaffStorage = saveItemToStaffStorage;