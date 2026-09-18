import { supabaseClient } from './supabaseClient.js';

async function loadUserProfile() {
  const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !authUser) return;

  const { data: profile, error } = await supabaseClient
    .from('user_account')
    .select('user_id, full_name, role')
    .eq('user_id', authUser.id)
    .single();

  if (error) {
    console.error('โหลดโปรไฟล์ผู้ใช้ไม่สำเร็จ:', error);
    return;
  }

  if (profile) {
    document.getElementById('navProfileName').textContent = profile.full_name;
    localStorage.setItem('currentUserName', profile.full_name);
    localStorage.setItem('currentUserRole', profile.role);
    localStorage.setItem('currentUserId', profile.user_id);
  }
}

function formatThaiDate(isoDateString) {
  if (!isoDateString) return 'ไม่ระบุวันที่';
  const d = new Date(isoDateString);
  if (isNaN(d.getTime())) return 'ไม่ระบุวันที่';
  const monthsThai = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  return `${d.getDate()} ${monthsThai[d.getMonth()]} ${d.getFullYear() + 543}`;
}

async function loadCategoryFilters() {
  const container = document.getElementById('categoryCheckboxList');

  const { data, error } = await supabaseClient
    .from('category')
    .select('category_id, category_name')
    .eq('is_active', true)
    .order('category_name', { ascending: true });

  if (error || !data || data.length === 0) {
    container.innerHTML = '<span style="font-size: 13px; color: #94a3b8;">ไม่พบหมวดหมู่ในระบบ</span>';
    return;
  }

  container.innerHTML = '';
  data.forEach(cat => {
    const label = document.createElement('label');
    label.className = 'checkbox-item';
    label.innerHTML = `
      <input type="checkbox" name="category" value="${cat.category_id}" checked onchange="applyFilter()">
      <span>${cat.category_name}</span>
    `;
    container.appendChild(label);
  });
}

async function fetchItemsFromSupabase() {
  const { data: items, error } = await supabaseClient
    .from('item')
    .select(`
      item_id, item_name, description, image_url, status, created_at,
      category_id, category:category_id(category_name),
      storage:current_storage_id(storage_name, room),
      report(report_type, incident_location, incident_datetime, user:user_id(full_name))
    `)
    .neq('status', 'คืนสำเร็จ')
    .neq('status', 'หมดอายุ/ทำลายทิ้ง');

  if (error) {
    console.error('Error fetching items:', error);
    const grid = document.getElementById('itemsGrid');
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 30px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; color: #be123c;">
        <strong>โหลดข้อมูลไม่สำเร็จ</strong>
        <p style="margin-top: 8px;">${error.message}</p>
      </div>
    `;
    return [];
  }

  const formattedItems = items.map(item => {
    const rep = Array.isArray(item.report) && item.report.length > 0 ? item.report[0] : null;

    return {
      id: item.item_id,
      title: item.item_name || 'ไม่ระบุชื่อสิ่งของ',
      description: item.description,
      categoryName: (item.category && item.category.category_name) || 'หมวดหมู่ทั่วไป',
      categoryId: item.category_id || '',
      storageName: (item.storage && item.storage.storage_name) || '',
      locationText: (rep && rep.incident_location) || item.storage?.storage_name || 'ไม่ระบุสถานที่',
      image_url: item.image_url,
      timestamp: (rep && rep.incident_datetime)
        ? new Date(rep.incident_datetime).toISOString()
        : new Date(item.created_at).toISOString(),
      type: rep ? rep.report_type : 'found',
      status: item.status || 'รอตรวจสอบ',
      poster: (rep && rep.user && rep.user.full_name) || 'ผู้แจ้งประกาศ'
    };
  });

  // เรียงลำดับจากวันที่ล่าสุด (ใหม่สุด -> เก่าสุด)
  formattedItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return formattedItems;
}

async function renderBrowseItems() {
  const items = await fetchItemsFromSupabase();
  const grid = document.getElementById('itemsGrid');
  grid.innerHTML = '';

  if (items.length === 0) {
    document.getElementById('resultCountText').textContent = 'พบ 0 รายการ';
    document.getElementById('noResults').style.display = 'block';
    return;
  }

  items.forEach(item => {
    // แมปปิ้ง Badge Class
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

    const imageContent = item.image_url 
      ? `<img src="${item.image_url}" alt="${item.title}">`
      : `<div class="no-image-placeholder">
           <i class="fa-solid fa-image"></i>
           <span>ไม่มีรูปภาพ</span>
         </div>`;

    const card = document.createElement('div');
    card.className = 'item-card';
    card.setAttribute('data-type', item.type);
    card.setAttribute('data-category', item.categoryId);
    card.setAttribute('data-location-name', item.locationText);
    card.setAttribute('data-date', item.timestamp.split('T')[0]);
    card.setAttribute('data-status', item.status);
    card.setAttribute('data-title', item.title);

    card.innerHTML = `
      <div class="item-image-wrapper">
        ${imageContent}
        ${badgeHtml}
      </div>
      <div class="item-body">
        <div class="item-info">
          <h3 class="item-title">${item.title}</h3>
          <div class="item-category">${item.categoryName}</div>
          <div class="item-meta">
            <span><i class="fa-regular fa-calendar"></i> ${formatThaiDate(item.timestamp)}</span>
            <span><i class="fa-solid fa-location-dot"></i> ${item.locationText}</span>
          </div>
        </div>
        <a href="detail.html?id=${item.id}" class="btn-detail">
          <span>ดูรายละเอียด</span>
          <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    `;
    grid.appendChild(card);
  });

  applyFilter();
}

function applyFilter() {
  const selectedTypes = Array.from(document.querySelectorAll('input[name="type_status"]:checked')).map(cb => cb.value);
  const selectedCategories = Array.from(document.querySelectorAll('input[name="category"]:checked')).map(cb => cb.value);
  const selectedStatus = document.getElementById('statusFilter').value;
  const selectedDate = document.getElementById('dateFilter').value;
  const locationSearchText = document.getElementById('locationSearchInput')
    ? document.getElementById('locationSearchInput').value.trim().toLowerCase()
    : '';
  const searchQuery = document.getElementById('searchInput') ? document.getElementById('searchInput').value.trim().toLowerCase() : '';

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const cards = document.querySelectorAll('.item-card');
  let visibleCount = 0;

  cards.forEach(card => {
    const cardType = card.getAttribute('data-type');
    const cardCategory = card.getAttribute('data-category');
    const cardLocationName = (card.getAttribute('data-location-name') || '').toLowerCase();
    const cardDateStr = card.getAttribute('data-date');
    const cardStatus = card.getAttribute('data-status') || '';
    const cardTitle = card.getAttribute('data-title').toLowerCase();

    const cardDate = new Date(cardDateStr);
    cardDate.setHours(0, 0, 0, 0);

    const diffTime = currentDate - cardDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const matchType = selectedTypes.length === 0 || selectedTypes.includes(cardType);
    const matchCategory = selectedCategories.length === 0 || selectedCategories.includes(cardCategory);

    let matchStatus = true;
    if (selectedStatus !== 'all') {
      matchStatus = (cardStatus === selectedStatus);
    }

    let matchDate = true;
    if (selectedDate === 'today') {
      matchDate = (diffDays === 0);
    } else if (selectedDate === 'yesterday') {
      matchDate = (diffDays === 1);
    } else if (selectedDate === '7days') {
      matchDate = (diffDays >= 0 && diffDays <= 7);
    } else if (selectedDate === '30days') {
      matchDate = (diffDays >= 0 && diffDays <= 30);
    }

    const matchLocation = locationSearchText === '' || cardLocationName.includes(locationSearchText);
    const matchSearch = searchQuery === '' ||
                        cardTitle.includes(searchQuery) ||
                        cardLocationName.includes(searchQuery) ||
                        cardStatus.toLowerCase().includes(searchQuery);

    if (matchType && matchCategory && matchStatus && matchDate && matchLocation && matchSearch) {
      card.classList.remove('hidden');
      visibleCount++;
    } else {
      card.classList.add('hidden');
    }
  });

  document.getElementById('resultCountText').textContent = `พบ ${visibleCount} รายการ`;

  const noResultsBox = document.getElementById('noResults');
  if (noResultsBox) {
    noResultsBox.style.display = (visibleCount === 0) ? 'block' : 'none';
  }
}

window.applyFilter = applyFilter;
window.renderBrowseItems = renderBrowseItems;

document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  await loadCategoryFilters();
  await renderBrowseItems();

  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    document.getElementById('searchInput').value = searchQuery;
  }
  applyFilter();

  // Bind Event ให้ปุ่มรีเฟรชข้อมูล (เช็ก Selector ให้ตรงกับ HTML เช่น id="btnRefresh" หรือ class="btn-refresh")
  const refreshBtn = document.getElementById('btnRefresh') || document.querySelector('.btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      const originalText = refreshBtn.innerHTML;
      refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...';

      await renderBrowseItems();

      refreshBtn.disabled = false;
      refreshBtn.innerHTML = originalText;
    });
  }
});