/**
 * โหลดข้อมูลสิทธิ์และโปรไฟล์ผู้ใช้งาน
 */
async function loadUserProfile() {
  const currentEmail = localStorage.getItem('currentUserEmail') || localStorage.getItem('userEmail') || '';
  if (!currentEmail) return;

  let { data: user, error } = await supabaseClient
    .from('user_account')
    .select('*')
    .eq('email', currentEmail)
    .single();

  if (user) {
    const profileNameEl = document.getElementById('navProfileName');
    if (profileNameEl) profileNameEl.textContent = user.full_name;
    localStorage.setItem('currentUserName', user.full_name);
    localStorage.setItem('currentUserRole', user.user_type);
  }
}

/**
 * แปลงวันที่ ISO เป็นรูปแบบวันที่ไทย
 */
function formatThaiDate(isoDateString) {
  if (!isoDateString) return '2 ก.ย. 2569';
  const d = new Date(isoDateString);
  const monthsThai = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  return `${d.getDate()} ${monthsThai[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/**
 * รับชื่อหมวดหมู่ภาษาไทยตาม Category ID
 */
function getCategoryDisplayName(catId) {
  const map = {
    'CAT001': 'อุปกรณ์อิเล็กทรอนิกส์',
    'CAT002': 'อุปกรณ์การเรียน',
    'CAT003': 'กระเป๋า/สัมภาระ/กุญแจ',
    'CAT004': 'ของใช้ส่วนตัว',
    'CAT005': 'เอกสาร/บัตร/อื่นๆ'
  };
  return map[catId] || 'อื่นๆ';
}

/**
 * ดึงข้อมูลสิ่งของจาก Supabase
 */
async function fetchItemsFromSupabase() {
  console.log('กำลังดึงข้อมูลจาก ITEM...');

  const { data: items, error } = await supabaseClient
    .from('item')
    .select('*')
    .neq('status', 'คืนสำเร็จ')
    .order('item_date', { ascending: false });

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

  return items.map(item => ({
    id: item.item_id,
    title: item.item_name,
    category: item.category_id || 'CAT005',
    categoryName: getCategoryDisplayName(item.category_id),
    locationName: item.location_id || 'ไม่ระบุสถานที่',
    locationType: '',
    room: '',
    image: item.image || 'https://images.unsplash.com/photo-1582139329536-e7284fece509?q=80&w=600&auto=format&fit=crop',
    timestamp: item.item_date ? new Date(item.item_date).toISOString() : new Date().toISOString(),
    type: item.status === 'แจ้งหาย' ? 'lost' : 'found',
    status: item.status || 'พบใหม่',
    poster: 'ผู้แจ้งประกาศ'
  }));
}

/**
 * เรนเดอร์การ์ดสิ่งของทั้งหมด
 */
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
    let statusText = item.status;
    let badgeClass = 'badge-new';
    let badgeIcon = 'fa-solid fa-sparkles';

    if (item.status === 'อยู่ที่จุดรับฝาก') {
      badgeClass = 'badge-storage';
      badgeIcon = 'fa-solid fa-box-archive';
    } else if (item.status === 'แจ้งหาย') {
      badgeClass = 'badge-lost';
      badgeIcon = 'fa-solid fa-triangle-exclamation';
    } else {
      statusText = 'พบใหม่';
      badgeClass = 'badge-new';
      badgeIcon = 'fa-solid fa-sparkles';
    }

    const card = document.createElement('div');
    card.className = 'item-card';
    card.setAttribute('data-type', item.type);
    card.setAttribute('data-category', item.category);
    card.setAttribute('data-location-type', item.locationType);
    card.setAttribute('data-location-name', item.locationName);
    card.setAttribute('data-room', item.room);
    card.setAttribute('data-date', item.timestamp.split('T')[0]);
    card.setAttribute('data-status', item.status);
    card.setAttribute('data-title', item.title);

    const locationDisplay = item.room ? `${item.locationName} (${item.room})` : item.locationName;

    card.innerHTML = `
      <div class="item-image-wrapper">
        <img src="${item.image}" alt="${item.title}" onerror="this.src='https://images.unsplash.com/photo-1582139329536-e7284fece509?q=80&w=600&auto=format&fit=crop'">
        <span class="item-badge ${badgeClass}">
          <i class="${badgeIcon}"></i> ${statusText}
        </span>
      </div>
      <div class="item-body">
        <div class="item-info">
          <h3 class="item-title">${item.title}</h3>
          <div class="item-category">${item.categoryName}</div>
          <div class="item-meta">
            <span><i class="fa-regular fa-calendar"></i> ${formatThaiDate(item.timestamp)}</span>
            <span><i class="fa-solid fa-location-dot"></i> ${locationDisplay}</span>
            <span style="font-size: 12px; color: #64748b; margin-top: 2px;">
              <i class="fa-regular fa-user" style="color: #64748b;"></i> ผู้โพสต์: ${item.poster}
            </span>
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

/**
 * ควบคุมการแสดงผลอินพุตเพิ่มเติมตามสถานที่
 */
function handleMainLocationChange() {
  const mainLoc = document.getElementById('locationFilter').value;
  const customClassroomGroup = document.getElementById('customClassroomGroup');
  const customDepartmentGroup = document.getElementById('customDepartmentGroup');
  const customClassroomInput = document.getElementById('customClassroomInput');
  const customDepartmentInput = document.getElementById('customDepartmentInput');

  customClassroomGroup.style.display = 'none';
  customDepartmentGroup.style.display = 'none';
  customClassroomInput.value = '';
  customDepartmentInput.value = '';

  if (mainLoc === 'ห้องเรียน') {
    customClassroomGroup.style.display = 'flex';
  } else if (mainLoc === 'ห้องสาขา') {
    customDepartmentGroup.style.display = 'flex';
  }
}

/**
 * ใช้ตัวกรองค้นหาการ์ดตามเงื่อนไขทั้งหมด
 */
function applyFilter() {
  const selectedTypes = Array.from(document.querySelectorAll('input[name="type_status"]:checked'))
                             .map(cb => cb.value);

  const selectedCategories = Array.from(document.querySelectorAll('input[name="category"]:checked'))
                                .map(cb => cb.value);

  const selectedStatus = document.getElementById('statusFilter').value;
  const selectedDate = document.getElementById('dateFilter').value;
  const mainLocation = document.getElementById('locationFilter').value;
  const customClassroomText = document.getElementById('customClassroomInput') ? document.getElementById('customClassroomInput').value.trim().toLowerCase() : '';
  const customDepartmentText = document.getElementById('customDepartmentInput') ? document.getElementById('customDepartmentInput').value.trim().toLowerCase() : '';
  const searchQuery = document.getElementById('searchInput') ? document.getElementById('searchInput').value.trim().toLowerCase() : '';

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const cards = document.querySelectorAll('.item-card');
  let visibleCount = 0;

  cards.forEach(card => {
    const cardType = card.getAttribute('data-type');
    const cardCategory = card.getAttribute('data-category');
    const cardLocationType = card.getAttribute('data-location-type') || '';
    const cardLocationName = (card.getAttribute('data-location-name') || '').toLowerCase();
    const cardRoom = (card.getAttribute('data-room') || '').toLowerCase();
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

    let matchLocation = true;
    if (mainLocation !== 'all') {
      matchLocation = cardLocationType === mainLocation;
      if (matchLocation && mainLocation === 'ห้องเรียน' && customClassroomText) {
        matchLocation = cardRoom.includes(customClassroomText);
      }
      if (matchLocation && mainLocation === 'ห้องสาขา' && customDepartmentText) {
        matchLocation = cardLocationName.includes(customDepartmentText);
      }
    }

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

/* Event Listener เมื่อโหลด DOM เสร็จสมบูรณ์ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  await renderBrowseItems();

  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = searchQuery;
  }
  applyFilter();
});