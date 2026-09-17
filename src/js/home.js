import { supabaseClient } from '/src/supabaseClient.js';

const MAX_RECENT_ITEMS = 6;

function formatThaiDate(isoDateString) {
  if (!isoDateString) return 'ไม่ระบุวันที่';
  const d = new Date(isoDateString);
  const monthsThai = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  return `${d.getDate()} ${monthsThai[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// 1. ดึงรายการล่าสุดจากตาราง public.item พร้อม Join ตาราง category, storage_point และ report
async function getRecentItems() {
  try {
    const { data, error } = await supabaseClient
      .from('item')
      .select(`
        item_id,
        item_name,
        description,
        image_url,
        status,
        created_at,
        category:category_id ( category_name ),
        storage_point:current_storage_id ( storage_name ),
        report:report!report_item_id_fkey ( incident_location, incident_datetime )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลสิ่งของ:', err);
    return [];
  }
}

// 2. ดึงจำนวนไอเทมที่ 'คืนสำเร็จ' จาก public.item
async function getReturnedSuccessCount() {
  try {
    const { count, error } = await supabaseClient
      .from('item')
      .select('item_id', { count: 'exact', head: true })
      .eq('status', 'คืนสำเร็จ')
      .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการนับจำนวนส่งคืนสำเร็จ:', err);
    return 0;
  }
}

// 3. คำนวณและแสดงผลหน้าหลัก
async function renderHomePage() {
  const items = await getRecentItems();
  const returnedCount = await getReturnedSuccessCount();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let todayFoundCount = 0;
  let openItemsCount = 0;

  items.forEach(item => {
    // นับรายการที่พบ/ลงทะเบียนวันนี้
    const itemDate = new Date(item.created_at);
    itemDate.setHours(0, 0, 0, 0);
    if (itemDate.getTime() === today.getTime()) {
      todayFoundCount++;
    }

    // นับรายการที่ยังเปิดอยู่ (ยังไม่คืน/ไม่ทำลาย)
    if (['รอตรวจสอบ', 'อยู่ที่จุดรับฝาก', 'กำลังดำเนินการเคลม'].includes(item.status)) {
      openItemsCount++;
    }
  });

  // กรองแสดงเฉพาะรายการที่ยังไม่สำเร็จในหน้าแรก
  const visibleItems = items.filter(item => item.status !== 'คืนสำเร็จ' && item.status !== 'หมดอายุ/ทำลายทิ้ง');
  const recentItems = visibleItems.slice(0, MAX_RECENT_ITEMS);

  const container = document.getElementById('recentItemsContainer');
  container.innerHTML = '';

  if (recentItems.length === 0) {
    container.innerHTML = `
      <div class="empty-today-box">
        <i class="fa-regular fa-calendar-xmark"></i>
        <h3>ยังไม่มีรายการแจ้งพบสิ่งของ</h3>
        <p>รายการที่พบในอดีตสามารถค้นหาและตรวจสอบได้ในหน้าค้นหาและฟิลเตอร์</p>
        <a href="browse.html" class="btn-browse-history">
          <span>ไปที่หน้าค้นหาและฟิลเตอร์</span>
          <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    `;
  } else {
    recentItems.forEach(item => {
      // แมปปิ้ง Badge Class ตาม public.item_status_enum
      let badgeClass = 'badge-pending';
      let badgeIcon = 'fa-solid fa-clock';

      switch (item.status) {
        case 'อยู่ที่จุดรับฝาก':
          badgeClass = 'badge-storage';
          badgeIcon = 'fa-solid fa-box-archive';
          break;
        case 'กำลังดำเนินการเคลม':
          badgeClass = 'badge-claiming';
          badgeIcon = 'fa-solid fa-spinner';
          break;
        case 'คืนสำเร็จ':
          badgeClass = 'badge-returned';
          badgeIcon = 'fa-solid fa-check-circle';
          break;
        case 'หมดอายุ/ทำลายทิ้ง':
          badgeClass = 'badge-disposed';
          badgeIcon = 'fa-solid fa-trash';
          break;
        default:
          badgeClass = 'badge-pending';
          badgeIcon = 'fa-solid fa-clock';
      }

      const badgeHtml = `<span class="item-badge ${badgeClass}"><i class="${badgeIcon}"></i> ${item.status}</span>`;
      
      // ดึงสถานที่จากตาราง report หรือ storage_point
      const reportData = Array.isArray(item.report) ? item.report[0] : item.report;
      const locationText = reportData?.incident_location || item.storage_point?.storage_name || 'ไม่ระบุสถานที่';
      const categoryName = item.category?.category_name || 'หมวดหมู่ทั่วไป';
      const displayDate = reportData?.incident_datetime || item.created_at;

      // แสดงกรอบกรณีไม่มีรูปภาพ
      const imageContent = item.image_url 
        ? `<img src="${item.image_url}" alt="${item.item_name}">`
        : `<div class="no-image-placeholder">
             <i class="fa-solid fa-image"></i>
             <span>ไม่มีรูปภาพ</span>
           </div>`;

      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-image-wrapper">
          ${imageContent}
          ${badgeHtml}
        </div>
        <div class="item-body">
          <div class="item-info">
            <h3 class="item-title">${item.item_name}</h3>
            <div class="item-category">${categoryName}</div>
            <div class="item-meta">
              <span><i class="fa-regular fa-calendar"></i> ${formatThaiDate(displayDate)}</span>
              <span><i class="fa-solid fa-location-dot"></i> ${locationText}</span>
            </div>
          </div>
          <a href="detail.html?id=${item.item_id}" class="btn-detail">
            <span>ดูรายละเอียด</span>
            <i class="fa-solid fa-arrow-right"></i>
          </a>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // อัปเดตสถิติ
  document.getElementById('statTodayFound').textContent = todayFoundCount;
  document.getElementById('statReturnedSuccess').textContent = returnedCount;
  document.getElementById('statOpenItems').textContent = openItemsCount;
}

document.addEventListener('DOMContentLoaded', renderHomePage);