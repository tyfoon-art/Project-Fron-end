import { supabaseClient } from './supabaseClient.js';

/* ============================================================================
   ข้อสมมติฐานเรื่องโครงสร้างตาราง (แก้ชื่อ table/column ให้ตรงกับของจริงได้ที่นี่)
   ----------------------------------------------------------------------------
   - public.claim              : claim_id, item_id (FK -> item.item_id),
                                  claimant_name, claimant_student_id, faculty,
                                  phone, email, description,
                                  status ('pending' | 'approved' | 'rejected' | 'more_info'),
                                  reviewer_name, reviewer_note,
                                  created_at, updated_at, approved_at
   - public.claim_proof        : proof_id, claim_id, name, url, created_at
     (ไฟล์หลักฐานที่ผู้ยื่นคำร้องแนบมา แยกจาก item_media ซึ่งเป็นรูปตอนบันทึกของเข้าคลัง)
   - public.claim_activity_log : log_id, claim_id, title, created_at
     (ถ้าตารางนี้ยังไม่มีหรือไม่มีข้อมูล ระบบจะสร้างรายการเริ่มต้นจาก
      วันที่บันทึกของเข้าคลัง (item.created_at) และวันที่ยื่นคำร้อง (claim.created_at) แทน)
   - public.item                : ใช้ join เอาชื่อ/หมวดหมู่/สถานที่พบของสิ่งของมาแสดง
                                  (item_id, item_name, category, found_location,
                                   found_date_time, recorded_by, created_at)
   ============================================================================ */

const CLAIM_TABLE = 'claim';
const CLAIM_PROOF_TABLE = 'claim_proof';
const ACTIVITY_LOG_TABLE = 'claim_activity_log';

let currentClaim = null;
let currentItem = null;
let currentProofs = [];
let currentLogs = [];
let currentReviewerName = 'เจ้าหน้าที่';

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

function formatDateTimeThai(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';

  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const time = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543} (${time} น.)`;
}

function getClaimIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || '';
}

function goToHandoverPage() {
  if (!currentClaim) return;
  window.location.href = `staff-handover.html?id=${encodeURIComponent(currentClaim.claim_id)}`;
}

/* ============================================================================
   DATA FETCHING
   ============================================================================ */

async function fetchClaimDetail(claimId) {
  const { data, error } = await supabaseClient
    .from(CLAIM_TABLE)
    .select(`
      claim_id, claimant_name, claimant_student_id, faculty, phone, email,
      description, status, reviewer_name, reviewer_note, created_at, approved_at,
      item:item_id ( item_id, item_name, category, found_location, found_date_time, recorded_by, created_at )
    `)
    .eq('claim_id', claimId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchClaimProofs(claimId) {
  const { data, error } = await supabaseClient
    .from(CLAIM_PROOF_TABLE)
    .select('name, url, created_at')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('ไม่สามารถโหลดไฟล์หลักฐานได้:', error);
    return [];
  }
  return data || [];
}

async function fetchActivityLogs(claimId, claim, item) {
  const { data, error } = await supabaseClient
    .from(ACTIVITY_LOG_TABLE)
    .select('title, created_at')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: false });

  if (!error && data && data.length) return data;

  // ไม่มีตาราง log จริง หรือยังไม่มีข้อมูล -> สร้างรายการพื้นฐานจากข้อมูลที่มีอยู่
  const fallback = [];

  if (claim?.created_at) {
    fallback.push({ title: 'ยื่นคำร้องขอรับคืนสำเร็จ', created_at: claim.created_at });
  }
  if (item?.created_at) {
    fallback.push({ title: 'บันทึกของพบเข้าสู่ระบบ', created_at: item.created_at });
  }

  return fallback.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function fetchReviewerName() {
  try {
    const { data } = await supabaseClient.auth.getUser();
    return data?.user?.user_metadata?.full_name || data?.user?.email || 'เจ้าหน้าที่';
  } catch {
    return 'เจ้าหน้าที่';
  }
}

async function insertActivityLog(claimId, title) {
  try {
    await supabaseClient.from(ACTIVITY_LOG_TABLE).insert({ claim_id: claimId, title });
  } catch (error) {
    console.warn('ไม่สามารถบันทึกประวัติกิจกรรมได้:', error);
  }
}

/* ============================================================================
   STATUS DISPLAY
   ============================================================================ */

const statusDisplayMap = {
  approved: { text: 'อนุมัติแล้ว' },
  rejected: { text: 'ปฏิเสธคำร้อง' },
  more_info: { text: 'ขอข้อมูลเพิ่มเติม' },
  pending: { text: 'รอการตรวจสอบ' },
};

function getStatusText(status) {
  return (statusDisplayMap[status] || statusDisplayMap.pending).text;
}

function renderStatusBadge(status) {
  const container = document.getElementById('statusBadgeContainer');
  const text = getStatusText(status);
  const cls = statusDisplayMap[status] ? status : 'pending';

  container.innerHTML = `
    <span class="status-badge ${cls}">
      <span class="dot"></span>
      ${escapeHTML(text)}
    </span>
  `;
}

/* ============================================================================
   DECISION BUTTONS STATE
   ============================================================================ */

function updateDecisionButtons() {
  const approveBtn = document.getElementById('approveBtn');
  const goToHandoverBtn = document.getElementById('goToHandoverBtn');
  const moreInfoBtn = document.getElementById('moreInfoBtn');
  const rejectBtn = document.getElementById('rejectBtn');

  // reset ค่าเริ่มต้นก่อนทุกครั้ง
  approveBtn.classList.remove('hidden');
  approveBtn.disabled = false;
  goToHandoverBtn.classList.add('hidden');
  moreInfoBtn.disabled = false;
  rejectBtn.disabled = false;

  if (currentClaim.status === 'approved') {
    // อนุมัติแล้ว -> ซ่อนปุ่มอนุมัติ, ปิดปุ่มขอข้อมูล/ปฏิเสธ, โชว์ปุ่มส่งคืนเจ้าของแทน
    approveBtn.classList.add('hidden');
    moreInfoBtn.disabled = true;
    rejectBtn.disabled = true;
    goToHandoverBtn.classList.remove('hidden');
  } else if (currentClaim.status !== 'pending') {
    // rejected / more_info -> ปิดปุ่มขอข้อมูล/ปฏิเสธ (คงปุ่มอนุมัติไว้เผื่อกลับมาพิจารณาใหม่)
    moreInfoBtn.disabled = true;
    rejectBtn.disabled = true;
  }
}

/* ============================================================================
   RENDER PAGE
   ============================================================================ */

function renderClaimPage() {
  const item = currentItem || {};

  document.getElementById('displayClaimId').textContent = `#${currentClaim.claim_id}`;
  renderStatusBadge(currentClaim.status);

  document.getElementById('itemTitle').textContent = item.item_name || 'ไม่ระบุชื่อสิ่งของ';
  document.getElementById('itemCategory').textContent = item.category || '-';
  document.getElementById('itemLocation').textContent = item.found_location || '-';
  document.getElementById('itemFoundDate').textContent = formatDateTimeThai(item.found_date_time);
  document.getElementById('itemRecorder').textContent = item.recorded_by || '-';

  document.getElementById('claimantName').textContent = currentClaim.claimant_name || '-';
  document.getElementById('claimantId').textContent = currentClaim.claimant_student_id || '-';
  document.getElementById('claimantFaculty').textContent = currentClaim.faculty || '-';
  document.getElementById('claimantPhone').textContent = currentClaim.phone || '-';
  document.getElementById('claimantEmail').textContent = currentClaim.email || '-';

  document.getElementById('claimDescription').textContent = currentClaim.description || '-';

  document.getElementById('reviewerName').value = currentClaim.reviewer_name || currentReviewerName;

  const noteEl = document.getElementById('reviewerNote');
  if (currentClaim.reviewer_note) noteEl.value = currentClaim.reviewer_note;

  renderProofFiles();
  renderLogs();
  updateDecisionButtons();
}

function renderProofFiles() {
  const container = document.getElementById('proofFilesContainer');

  if (!currentProofs.length) {
    container.innerHTML = `
      <div class="proof-empty">
        <i class="fa-regular fa-file"></i>
        <p>ไม่มีไฟล์หลักฐานแนบ</p>
      </div>
    `;
    return;
  }

  container.innerHTML = currentProofs.map((proof, index) => `
    <div class="proof-item" data-name="${escapeHTML(proof.name)}" data-url="${escapeHTML(proof.url)}">
      <img src="${escapeHTML(proof.url)}" alt="${escapeHTML(proof.name)}" onerror="this.style.display='none';">
      <div class="proof-item-overlay">
        <div class="proof-item-top">
          <span class="proof-item-tag">หลักฐาน ${index + 1}</span>
          <span class="proof-item-zoom"><i class="fa-solid fa-magnifying-glass-plus"></i></span>
        </div>
        <div>
          <p class="proof-item-name">${escapeHTML(proof.name)}</p>
          <p class="proof-item-hint">คลิกเพื่อดูภาพขยาย</p>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.proof-item').forEach((el) => {
    el.addEventListener('click', () => openImageModal(el.dataset.name, el.dataset.url));
  });
}

function renderLogs() {
  const container = document.getElementById('activityLogContainer');

  if (!currentLogs.length) {
    container.innerHTML = `<p class="activity-empty">ยังไม่มีประวัติกิจกรรม</p>`;
    return;
  }

  container.innerHTML = currentLogs.map((log, index) => `
    <div class="activity-entry ${index === 0 ? '' : 'inactive'}">
      <span class="activity-dot"></span>
      <div>
        <p class="activity-title">${escapeHTML(log.title)}</p>
        <p class="activity-date">${formatDateTimeThai(log.created_at)}</p>
      </div>
    </div>
  `).join('');
}

/* ============================================================================
   IMAGE MODAL
   ============================================================================ */

function openImageModal(name, url) {
  document.getElementById('modalFileName').textContent = name;
  document.getElementById('modalImagePreview').src = url;
  document.getElementById('imageModal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeImageModal() {
  document.getElementById('imageModal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

/* ============================================================================
   APPROVE CONFIRM MODAL
   ============================================================================ */

function resetApproveButton() {
  const confirmButton = document.getElementById('confirmApproveButton');
  const confirmText = document.getElementById('confirmApproveText');
  const confirmIcon = document.getElementById('confirmApproveIcon');

  confirmButton.disabled = false;
  confirmButton.classList.remove('success');
  confirmIcon.textContent = '✓';
  confirmText.textContent = 'ยืนยันการอนุมัติ';
}

function openApproveModal() {
  document.getElementById('approveModalClaimId').textContent = `#${currentClaim.claim_id}`;
  document.getElementById('approveModalClaimant').textContent = currentClaim.claimant_name || '-';
  document.getElementById('approveModalItem').textContent = currentItem?.item_name || '-';

  const title = document.getElementById('approveModalTitle');
  const description = document.getElementById('approveModalDescription');
  const infoText = document.getElementById('approveModalInfoText');
  const confirmText = document.getElementById('confirmApproveText');
  const confirmIcon = document.getElementById('confirmApproveIcon');
  const confirmButton = document.getElementById('confirmApproveButton');

  resetApproveButton();

  if (currentClaim.status === 'approved') {
    title.textContent = 'คำร้องนี้ได้รับการอนุมัติแล้ว';
    description.innerHTML = 'คำร้องนี้ได้รับการอนุมัติเรียบร้อยแล้ว<br>คุณสามารถไปยังหน้าส่งคืนเจ้าของได้ทันที';
    infoText.innerHTML = 'ข้อมูลคำร้องนี้ถูกบันทึกไว้ในระบบแล้ว และพร้อมสำหรับขั้นตอน <strong>ส่งคืนเจ้าของ</strong>';
    confirmText.textContent = 'ไปหน้าส่งคืนเจ้าของ';
    confirmIcon.textContent = '→';
    confirmButton.classList.add('success');
  } else {
    title.textContent = 'ยืนยันการอนุมัติคำร้อง';
    description.innerHTML = 'คุณกำลังจะอนุมัติคำร้องนี้<br>กรุณาตรวจสอบข้อมูลก่อนยืนยันการดำเนินการ';
    infoText.innerHTML = 'เมื่อยืนยันแล้ว ระบบจะเปลี่ยนสถานะคำร้องเป็น <strong>อนุมัติแล้ว</strong> และนำข้อมูลไปยังหน้า <strong>ส่งคืนเจ้าของ</strong>';
  }

  document.getElementById('approveConfirmModal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeApproveModal() {
  document.getElementById('approveConfirmModal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  resetApproveButton();
}

/* ============================================================================
   SIMPLE TOAST MESSAGE
   ============================================================================ */

function showSimpleMessage(message, type) {
  document.getElementById('simpleMessage')?.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'simpleMessage';
  wrapper.className = `simple-message ${type}`;
  wrapper.innerHTML = `
    <div class="simple-message-icon">${type === 'success' ? '✓' : '!'}</div>
    <p>${escapeHTML(message)}</p>
  `;

  document.body.appendChild(wrapper);
  setTimeout(() => wrapper.remove(), 2500);
}

/* ============================================================================
   CONFIRM APPROVAL
   ============================================================================ */

async function confirmApproval() {
  const confirmButton = document.getElementById('confirmApproveButton');
  const confirmText = document.getElementById('confirmApproveText');
  const confirmIcon = document.getElementById('confirmApproveIcon');

  if (confirmButton.disabled) return;

  // ถ้าอนุมัติไปแล้ว ไปหน้า handover ได้ทันที ไม่ต้องบันทึกซ้ำ
  if (currentClaim.status === 'approved') {
    confirmButton.disabled = true;
    confirmIcon.innerHTML = '<span class="spinner"></span>';
    confirmText.textContent = 'กำลังเปิดหน้าส่งคืน...';

    setTimeout(() => {
      goToHandoverPage();
    }, 300);
    return;
  }

  confirmButton.disabled = true;
  confirmIcon.innerHTML = '<span class="spinner"></span>';
  confirmText.textContent = 'กำลังบันทึก...';

  const note = document.getElementById('reviewerNote').value.trim();
  const nowIso = new Date().toISOString();

  try {
    const { error } = await supabaseClient
      .from(CLAIM_TABLE)
      .update({
        status: 'approved',
        reviewer_note: note,
        reviewer_name: currentReviewerName,
        approved_at: nowIso,
        updated_at: nowIso,
      })
      .eq('claim_id', currentClaim.claim_id);

    if (error) throw error;

    await insertActivityLog(currentClaim.claim_id, 'เจ้าหน้าที่อนุมัติคำร้อง');

    currentClaim.status = 'approved';
    currentClaim.reviewer_note = note;
    currentLogs.unshift({ title: 'เจ้าหน้าที่อนุมัติคำร้อง', created_at: nowIso });

    renderStatusBadge('approved');
    renderLogs();
    updateDecisionButtons();

    setTimeout(() => {
      document.getElementById('approveConfirmModal').classList.add('hidden');

      document.getElementById('approvalSuccessTitle').textContent = 'อนุมัติคำร้องสำเร็จ';
      document.getElementById('approvalSuccessDescription').textContent = 'ระบบกำลังนำคุณไปยังหน้าส่งคืนเจ้าของ';
      document.getElementById('approvalSuccessModal').classList.remove('hidden');

      setTimeout(() => {
        goToHandoverPage();
      }, 1000);
    }, 350);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการอนุมัติคำร้อง:', error);
    resetApproveButton();
    showSimpleMessage('ไม่สามารถบันทึกการอนุมัติได้ กรุณาลองใหม่อีกครั้ง', 'warning');
  }
}

/* ============================================================================
   DECISION HANDLER (more_info / reject)
   ============================================================================ */

async function handleDecision(type) {
  const note = document.getElementById('reviewerNote').value.trim();

  if (type === 'approve') {
    openApproveModal();
    return;
  }

  if (type === 'more_info') {
    if (!note) {
      showSimpleMessage('กรุณาระบุข้อความขอข้อมูลเพิ่มเติมก่อนส่ง', 'warning');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabaseClient
        .from(CLAIM_TABLE)
        .update({ status: 'more_info', reviewer_note: note, reviewer_name: currentReviewerName, updated_at: nowIso })
        .eq('claim_id', currentClaim.claim_id);

      if (error) throw error;

      await insertActivityLog(currentClaim.claim_id, 'เจ้าหน้าที่ส่งคำขอข้อมูลเพิ่มเติม');

      currentClaim.status = 'more_info';
      currentClaim.reviewer_note = note;
      currentLogs.unshift({ title: 'เจ้าหน้าที่ส่งคำขอข้อมูลเพิ่มเติม', created_at: nowIso });

      renderStatusBadge('more_info');
      renderLogs();
      updateDecisionButtons();
      showSimpleMessage('ส่งคำขอข้อมูลเพิ่มเติมเรียบร้อยแล้ว', 'success');
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการขอข้อมูลเพิ่มเติม:', error);
      showSimpleMessage('ไม่สามารถบันทึกสถานะคำร้องได้ กรุณาลองใหม่อีกครั้ง', 'warning');
    }

    return;
  }

  if (type === 'reject') {
    if (!note) {
      showSimpleMessage('กรุณาระบุเหตุผลก่อนปฏิเสธคำร้อง', 'warning');
      return;
    }

    if (!window.confirm('ยืนยันที่จะปฏิเสธคำร้องนี้หรือไม่?')) return;

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabaseClient
        .from(CLAIM_TABLE)
        .update({ status: 'rejected', reviewer_note: note, reviewer_name: currentReviewerName, updated_at: nowIso })
        .eq('claim_id', currentClaim.claim_id);

      if (error) throw error;

      await insertActivityLog(currentClaim.claim_id, 'เจ้าหน้าที่ปฏิเสธคำร้อง');

      showSimpleMessage('ปฏิเสธคำร้องเรียบร้อยแล้ว', 'success');
      setTimeout(() => { window.location.href = 'staff-verify-claims.html'; }, 700);
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการปฏิเสธคำร้อง:', error);
      showSimpleMessage('ไม่สามารถบันทึกสถานะการปฏิเสธได้ กรุณาลองใหม่อีกครั้ง', 'warning');
    }
  }
}

/* ============================================================================
   INITIALIZE
   ============================================================================ */

async function initPage() {
  const claimId = getClaimIdFromURL();

  if (!claimId) {
    showNotFound('');
    return;
  }

  try {
    const claim = await fetchClaimDetail(claimId);

    if (!claim) {
      showNotFound(claimId);
      return;
    }

    currentClaim = claim;
    currentItem = claim.item || null;

    const [proofs, logs, reviewerName] = await Promise.all([
      fetchClaimProofs(claimId),
      fetchActivityLogs(claimId, claim, currentItem),
      fetchReviewerName(),
    ]);

    currentProofs = proofs;
    currentLogs = logs;
    currentReviewerName = reviewerName;

    renderClaimPage();
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลคำร้อง:', error);
    showNotFound(claimId);
  }
}

function showNotFound(claimId) {
  document.getElementById('contentGrid').classList.add('hidden');
  document.getElementById('statusBadgeContainer').classList.add('hidden');
  document.getElementById('notFoundState').classList.remove('hidden');
  document.getElementById('displayClaimId').textContent = claimId ? `#${claimId}` : '#-';
}

/* ============================================================================
   EVENT WIRING
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('approveBtn')?.addEventListener('click', () => handleDecision('approve'));
  document.getElementById('goToHandoverBtn')?.addEventListener('click', goToHandoverPage);
  document.getElementById('moreInfoBtn')?.addEventListener('click', () => handleDecision('more_info'));
  document.getElementById('rejectBtn')?.addEventListener('click', () => handleDecision('reject'));

  document.getElementById('cancelApproveButton')?.addEventListener('click', closeApproveModal);
  document.getElementById('confirmApproveButton')?.addEventListener('click', confirmApproval);
  document.getElementById('approveConfirmModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'approveConfirmModal') closeApproveModal();
  });

  document.getElementById('closeImageModalBtn')?.addEventListener('click', closeImageModal);
  document.getElementById('closeImageModalBtn2')?.addEventListener('click', closeImageModal);
  document.getElementById('imageModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'imageModal') closeImageModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeImageModal();
      closeApproveModal();
    }
  });

  initPage();
});