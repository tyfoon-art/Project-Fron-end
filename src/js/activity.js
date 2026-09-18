import { supabaseClient } from './supabaseClient.js';

// ผู้ใช้ปัจจุบันต้อง login ไว้ก่อน (เก็บ user_id ไว้ใน localStorage)
function getCurrentUserId() {
  return localStorage.getItem('currentUserId')
      || localStorage.getItem('userId')
      || localStorage.getItem('user_id')
      || null;
}

function formatThaiDate(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const monthsThai = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  return `${d.getDate()} ${monthsThai[d.getMonth()]} ${d.getFullYear() + 543}`;
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1582139329536-e7284fece509?q=80&w=600&auto=format&fit=crop';

function getStatusMeta(status) {
  switch (status) {
    case 'อยู่ที่จุดรับฝาก':
      return { cls: 'pending', icon: 'fa-regular fa-clock' };
    case 'กำลังดำเนินการเคลม':
      return { cls: 'progress', icon: 'fa-solid fa-arrows-rotate' };
    case 'คืนสำเร็จ':
      return { cls: 'success', icon: 'fa-regular fa-circle-check' };
    case 'หมดอายุ/ทำลายทิ้ง':
      return { cls: 'expired', icon: 'fa-solid fa-trash' };
    case 'รอตรวจสอบ':
    default:
      return { cls: 'warning', icon: 'fa-regular fa-circle-question' };
  }
}

function showEmpty(message, subMessage, icon = 'fa-regular fa-folder-open') {
  const container = document.getElementById('activityList');
  if (container) {
    container.innerHTML = `
      <div class="empty-box">
        <i class="${icon}"></i>
        <h3>${message}</h3>
        <p>${subMessage}</p>
      </div>
    `;
  }
}

function showLoading() {
  const container = document.getElementById('activityList');
  if (container) {
    container.innerHTML = `
      <div class="empty-box">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <h3>กำลังโหลดข้อมูล...</h3>
        <p>กรุณารอสักครู่</p>
      </div>
    `;
  }
}

// ---------- แท็บ "ของที่ฉันแจ้งหาย/พบ" : ดึงจากตาราง report ผูกกับ item ----------
async function renderReportedItems(userId) {
  showLoading();

  const { data, error } = await supabaseClient
    .from('report')
    .select(`
      report_id,
      report_type,
      incident_location,
      incident_datetime,
      item_id,
      item:item_id ( item_name, description, status, image_url, deleted_at )
    `)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('incident_datetime', { ascending: false });

  if (error) {
    console.error('โหลดประกาศของฉันไม่สำเร็จ:', error);
    showEmpty('โหลดข้อมูลไม่สำเร็จ', 'กรุณาลองรีเฟรชหน้าใหม่อีกครั้ง', 'fa-solid fa-triangle-exclamation');
    return;
  }

  const visibleData = (data || []).filter(rep => !rep.item || !rep.item.deleted_at);

  if (visibleData.length === 0) {
    showEmpty('ยังไม่มีรายการที่คุณแจ้งประกาศ', 'คุณยังไม่ได้สร้างประกาศแจ้งหายหรือแจ้งพบสิ่งของในระบบด้วยบัญชีนี้');
    return;
  }

  const listContainer = document.getElementById('activityList');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  visibleData.forEach(rep => {
    const isLost = rep.report_type === 'lost';
    const badgeClass = isLost ? 'lost' : 'found';
    const badgeText = isLost ? 'แจ้งหาย' : 'พบเจอ';

    const itemName = (rep.item && rep.item.item_name) || 'ไม่พบชื่อสิ่งของ';
    const description = (rep.item && rep.item.description) || 'ไม่มีรายละเอียดเพิ่มเติม';
    const status = (rep.item && rep.item.status) || 'รอตรวจสอบ';
    const imgSrc = (rep.item && rep.item.image_url) || FALLBACK_IMAGE;
    const { cls: statusClass, icon: statusIcon } = getStatusMeta(status);

    const card = document.createElement('div');
    card.className = 'activity-card';
    card.style.cursor = 'pointer';
    card.onclick = () => window.location.href = `detail.html?id=${rep.item_id}`;
    card.innerHTML = `
      <div class="card-main-row">
        <div class="card-img-box">
          <img src="${imgSrc}" alt="${itemName}">
        </div>
        <div class="card-content-box">
          <div class="card-top-row">
            <h3 class="card-title">${itemName}</h3>
            <span class="badge-type ${badgeClass}">${badgeText}</span>
          </div>
          <p class="card-desc">${description}</p>
          <div class="card-bottom-row">
            <div class="card-date">
              <i class="fa-regular fa-calendar"></i>
              <span>${formatThaiDate(rep.incident_datetime)}</span>
            </div>
            <div class="status-indicator ${statusClass}">
              <i class="${statusIcon}"></i>
              <span>${status}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

// ---------- แท็บ "คำร้องขอคืนของฉัน" : ดึงจากตาราง claim ผูกกับ item ----------
async function renderMyClaims(userId) {
  showLoading();

  const { data, error } = await supabaseClient
    .from('claim')
    .select(`
      claim_id,
      claim_status,
      created_at,
      ownership_evidence,
      item_id,
      item:item_id ( item_name, image_url )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('โหลดคำร้องขอคืนของไม่สำเร็จ:', error);
    showEmpty('โหลดข้อมูลไม่สำเร็จ', 'กรุณาลองรีเฟรชหน้าใหม่อีกครั้ง', 'fa-solid fa-triangle-exclamation');
    return;
  }

  if (!data || data.length === 0) {
    showEmpty('ยังไม่มีคำร้องขอคืนสิ่งของ', 'คุณยังไม่ได้ทำรายการอ้างสิทธิ์ความเป็นเจ้าของสิ่งของใดๆ ในระบบ', 'fa-regular fa-clipboard');
    return;
  }

  const listContainer = document.getElementById('activityList');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  const statusTextMap = {
    pending: 'รอตรวจสอบ',
    approved: 'อนุมัติแล้ว รอมารับของ',
    rejected: 'ถูกปฏิเสธ',
    handed_over: 'รับของเรียบร้อยแล้ว'
  };
  const statusClassMap = {
    pending: 'pending',
    approved: 'progress',
    rejected: 'warning',
    handed_over: 'success'
  };
  const statusIconMap = {
    pending: 'fa-regular fa-clock',
    approved: 'fa-solid fa-arrows-rotate',
    rejected: 'fa-regular fa-circle-xmark',
    handed_over: 'fa-regular fa-circle-check'
  };

  data.forEach(claim => {
    const itemName = (claim.item && claim.item.item_name) || 'ไม่พบชื่อสิ่งของ';
    const imgSrc = (claim.item && claim.item.image_url) || FALLBACK_IMAGE;
    const statusText = statusTextMap[claim.claim_status] || claim.claim_status;
    const statusClass = statusClassMap[claim.claim_status] || 'pending';
    const statusIcon = statusIconMap[claim.claim_status] || 'fa-regular fa-clock';

    const card = document.createElement('div');
    card.className = 'activity-card';
    card.style.cursor = 'pointer';
    card.onclick = () => window.location.href = `detail.html?id=${claim.item_id}`;
    card.innerHTML = `
      <div class="card-main-row">
        <div class="card-img-box">
          <img src="${imgSrc}" alt="${itemName}">
        </div>
        <div class="card-content-box">
          <div class="card-top-row">
            <h3 class="card-title">${itemName}</h3>
          </div>
          <p class="card-desc">${claim.ownership_evidence || 'ไม่มีหลักฐานเพิ่มเติม'}</p>
          <div class="card-bottom-row">
            <div class="card-date">
              <i class="fa-regular fa-calendar"></i>
              <span>${formatThaiDate(claim.created_at)}</span>
            </div>
            <div class="status-indicator ${statusClass}">
              <i class="${statusIcon}"></i>
              <span>${statusText}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

function renderMyActivities(tabType = 'reported') {
  const userId = getCurrentUserId();

  if (!userId) {
    showEmpty('กรุณาเข้าสู่ระบบ', 'คุณต้องเข้าสู่ระบบก่อนจึงจะดูกิจกรรมส่วนตัวได้', 'fa-solid fa-circle-user');
    return;
  }

  if (tabType === 'reported') {
    renderReportedItems(userId);
  } else {
    renderMyClaims(userId);
  }
}

// ฟังก์ชันสำหรับสลับแท็บ
export function switchTab(tabType) {
  const tabReported = document.getElementById('tabReported');
  const tabClaimed = document.getElementById('tabClaimed');

  const isReported = tabType === 'reported';

  if (tabReported && tabClaimed) {
    if (isReported) {
      tabReported.classList.add('active');
      tabClaimed.classList.remove('active');
    } else {
      tabClaimed.classList.add('active');
      tabReported.classList.remove('active');
    }
  }

  renderMyActivities(isReported ? 'reported' : 'claimed');
}

// ผูกฟังก์ชันเข้ากับ window เผื่อกรณีใช้แบบ Inline
window.switchTab = switchTab;

// เมื่อโหลด DOM เสร็จ ให้ผูก Event Listener และเรนเดอร์แท็บแรก
document.addEventListener('DOMContentLoaded', () => {
  const tabReported = document.getElementById('tabReported');
  const tabClaimed = document.getElementById('tabClaimed');

  if (tabReported) {
    tabReported.addEventListener('click', () => switchTab('reported'));
  }

  if (tabClaimed) {
    tabClaimed.addEventListener('click', () => switchTab('claimed'));
  }

  renderMyActivities('reported');
});