import { supabaseClient } from './supabaseClient.js';

/* ============================================================================
   ข้อสมมติฐานเรื่องโครงสร้างตาราง/สตอเรจ (แก้ให้ตรงกับของจริงได้ที่นี่)
   ----------------------------------------------------------------------------
   - public.claim   : claim_id, recipient_name, status, item_id (FK -> item)
       (status: 'approved' ตอนรออนุมัติแล้ว, เปลี่ยนเป็น 'completed' เมื่อส่งมอบสำเร็จ)
   - public.item    : item_id, item_name, image_url
   - public.handover: handover_id, claim_id, item_id, recipient_name,
                       handover_date, staff_name, proof_image_url, proof_urls (jsonb),
                       signature_image_url, proof_file_count, note
   - Storage bucket : 'handover-evidence' (public bucket)
       เก็บไฟล์หลักฐานที่ path `${claimId}/proof-${index}-${filename}`
       และลายเซ็นที่ path `${claimId}/signature.png`
   ถ้าชื่อ table/column/bucket จริงไม่ตรง แก้ค่าคงที่ด้านล่างได้เลย
   ============================================================================ */

const CLAIM_TABLE = 'claim';
const ITEM_TABLE = 'item';
const HANDOVER_TABLE = 'handover';
const EVIDENCE_BUCKET = 'handover-evidence';

const RETURNED_ITEM_STATUS = 'คืนสำเร็จ';
const MAX_FILES = 5;

/* ============================================================================
   GLOBAL STATE
   ============================================================================ */

let currentClaim = null;
let currentClaimId = '';
let selectedFiles = [];
let isDrawing = false;
let hasSignature = false;
let isSubmitting = false;

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

function isCompletedStatus(status) {
  return String(status || '').toLowerCase() === 'completed';
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

/* ============================================================================
   DATA FETCHING
   ============================================================================ */

async function fetchClaimById(claimId) {
  const { data, error } = await supabaseClient
    .from(CLAIM_TABLE)
    .select(`
      claim_id,
      recipient_name,
      status,
      item:item_id ( item_id, item_name, image_url )
    `)
    .eq('claim_id', claimId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/* ============================================================================
   LOAD CLAIM
   ============================================================================ */

async function loadClaim() {
  const params = new URLSearchParams(window.location.search);
  const claimIdFromUrl = (params.get('id') || '').trim();

  clearClaimDisplay();

  if (!claimIdFromUrl) {
    showMissingClaimNotice('ไม่พบรหัสคำร้องใน URL');
    return;
  }

  currentClaimId = claimIdFromUrl;

  let claim;
  try {
    claim = await fetchClaimById(currentClaimId);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการโหลดคำร้อง:', error);
    showMissingClaimNotice('ไม่สามารถโหลดข้อมูลคำร้องได้ กรุณาลองใหม่อีกครั้ง');
    return;
  }

  if (!claim) {
    showMissingClaimNotice(`ไม่พบรายละเอียดคำร้องที่อนุมัติสำหรับรหัส ${claimIdFromUrl} ในระบบ`);
    return;
  }

  currentClaim = claim;
  applyClaimData(claim);
}

function clearClaimDisplay() {
  currentClaim = null;

  document.getElementById('claimIdText').textContent = '-';
  document.getElementById('itemNameText').textContent = '-';
  document.getElementById('recipientNameText').textContent = '-';

  const itemImage = document.getElementById('itemImage');
  itemImage.onload = null;
  itemImage.onerror = null;
  itemImage.removeAttribute('src');
  itemImage.style.display = 'none';

  document.getElementById('noImagePlaceholder').classList.remove('hidden');

  document.getElementById('claimWarning')?.remove();

  const openSummaryBtn = document.getElementById('openSummaryBtn');
  openSummaryBtn.disabled = false;
  openSummaryBtn.textContent = 'ยืนยันการส่งมอบ';

  const finalSubmitBtn = document.getElementById('finalSubmitBtn');
  finalSubmitBtn.disabled = false;
  finalSubmitBtn.textContent = 'ยืนยันบันทึกสำเร็จ';

  const verifyCheck = document.getElementById('verifyCheck');
  verifyCheck.disabled = false;
  verifyCheck.checked = false;

  const uploadLabel = document.getElementById('uploadLabel');
  uploadLabel.classList.remove('disabled');
  uploadLabel.setAttribute('for', 'photoInput');
}

function applyClaimData(claim) {
  document.getElementById('claimIdText').textContent = claim.claim_id || '-';
  document.getElementById('itemNameText').textContent = claim.item?.item_name || '-';
  document.getElementById('recipientNameText').textContent = claim.recipient_name || '-';

  setItemImage(claim.item?.image_url || '');

  if (isCompletedStatus(claim.status)) {
    showAlreadyCompletedMessage();
  }
}

function setItemImage(imageSource) {
  const itemImage = document.getElementById('itemImage');
  const placeholder = document.getElementById('noImagePlaceholder');

  itemImage.onload = null;
  itemImage.onerror = null;
  itemImage.removeAttribute('src');
  itemImage.style.display = 'none';
  placeholder.classList.remove('hidden');

  if (!imageSource) return;

  itemImage.onload = function () {
    this.style.display = 'block';
    placeholder.classList.add('hidden');
  };

  itemImage.onerror = function () {
    this.style.display = 'none';
    placeholder.classList.remove('hidden');
  };

  itemImage.src = imageSource;
}

function showMissingClaimNotice(message) {
  document.getElementById('claimIdText').textContent = currentClaimId || '-';

  const itemCard = document.getElementById('itemNameText').closest('.panel-card');
  if (itemCard && !document.getElementById('claimWarning')) {
    const warning = document.createElement('div');
    warning.id = 'claimWarning';
    warning.className = 'claim-warning';
    warning.innerHTML = `${escapeHTML(message)}<br>กรุณากลับไปตรวจสอบว่าคำร้องได้รับการอนุมัติเรียบร้อยแล้ว`;
    itemCard.appendChild(warning);
  }

  const openSummaryBtn = document.getElementById('openSummaryBtn');
  openSummaryBtn.disabled = true;
  openSummaryBtn.textContent = 'ไม่พบคำร้อง';
}

function showAlreadyCompletedMessage() {
  const finalSubmitBtn = document.getElementById('finalSubmitBtn');
  finalSubmitBtn.disabled = true;
  finalSubmitBtn.textContent = 'ส่งมอบแล้ว';

  const openSummaryBtn = document.getElementById('openSummaryBtn');
  openSummaryBtn.disabled = true;
  openSummaryBtn.textContent = 'รายการนี้ส่งมอบแล้ว';

  document.getElementById('verifyCheck').disabled = true;

  const uploadLabel = document.getElementById('uploadLabel');
  uploadLabel.classList.add('disabled');
  uploadLabel.removeAttribute('for');
}

/* ============================================================================
   DIGITAL SIGNATURE
   ============================================================================ */

const canvas = document.getElementById('signaturePad');
const ctx = canvas.getContext('2d');

function resetCanvasStyle() {
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#003b7a';
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  let oldSignature = null;
  if (hasSignature && canvas.width > 0 && canvas.height > 0) {
    oldSignature = document.createElement('canvas');
    oldSignature.width = canvas.width;
    oldSignature.height = canvas.height;
    oldSignature.getContext('2d').drawImage(canvas, 0, 0);
  }

  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  resetCanvasStyle();

  if (oldSignature) {
    ctx.drawImage(oldSignature, 0, 0, oldSignature.width, oldSignature.height, 0, 0, rect.width, rect.height);
  }
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  let clientX = e.clientX;
  let clientY = e.clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  }
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function startDrawing(e) {
  isDrawing = true;
  hasSignature = true;
  resetCanvasStyle();
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
  if (!isDrawing) return;
  if (e.type === 'touchmove') e.preventDefault();
  const pos = getPos(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}

function stopDrawing() {
  if (isDrawing) {
    ctx.closePath();
    isDrawing = false;
  }
}

function clearSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSignature = false;
}

/* ============================================================================
   MULTI-FILE UPLOAD (PREVIEW ONLY — อัปโหลดจริงตอนกดยืนยันบันทึก)
   ============================================================================ */

function previewFiles(event) {
  const newFiles = Array.from(event.target.files);
  if (newFiles.length === 0) return;

  const availableSlots = MAX_FILES - selectedFiles.length;
  if (availableSlots <= 0) {
    alert(`สามารถแนบไฟล์ได้สูงสุดไม่เกิน ${MAX_FILES} ไฟล์เท่านั้น`);
    event.target.value = '';
    return;
  }

  if (newFiles.length > availableSlots) {
    alert(`สามารถแนบไฟล์เพิ่มได้อีก ${availableSlots} ไฟล์`);
  }

  selectedFiles = selectedFiles.concat(newFiles.slice(0, availableSlots));
  updateFileInput();
  renderPreviews();
}

function updateFileInput() {
  const input = document.getElementById('photoInput');
  try {
    const dataTransfer = new DataTransfer();
    selectedFiles.forEach((file) => dataTransfer.items.add(file));
    input.files = dataTransfer.files;
  } catch (error) {
    console.warn('ไม่สามารถ sync file input ได้:', error);
  }

  document.getElementById('fileCountText').textContent = `(${selectedFiles.length}/${MAX_FILES})`;
}

function renderPreviews() {
  const container = document.getElementById('previewContainer');
  const clearBtn = document.getElementById('clearAllBtn');

  container.innerHTML = '';

  if (selectedFiles.length === 0) {
    clearBtn.classList.remove('show');
    return;
  }
  clearBtn.classList.add('show');

  selectedFiles.forEach((file, index) => {
    const div = document.createElement('div');
    div.className = 'preview-item';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'preview-remove-btn';
    removeButton.textContent = '✕';
    removeButton.onclick = () => removeFile(index);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = 'Preview';
        img.onclick = () => openImageModal(e.target.result);
        div.appendChild(img);
        div.appendChild(removeButton);
        container.appendChild(div);
      };
      reader.readAsDataURL(file);
    } else {
      const videoTile = document.createElement('div');
      videoTile.className = 'video-tile';
      videoTile.innerHTML = `<i class="fa-solid fa-video"></i><span>${escapeHTML(file.name)}</span>`;
      div.appendChild(videoTile);
      div.appendChild(removeButton);
      container.appendChild(div);
    }
  });
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  updateFileInput();
  renderPreviews();
}

function clearAllFiles() {
  selectedFiles = [];
  document.getElementById('photoInput').value = '';
  updateFileInput();
  renderPreviews();
}

/* ============================================================================
   IMAGE MODAL
   ============================================================================ */

function openImageModal(src) {
  if (!src) return;
  document.getElementById('modalImage').src = src;
  document.getElementById('imageModal').classList.add('show');
}

function closeImageModal() {
  document.getElementById('imageModal').classList.remove('show');
  document.getElementById('modalImage').src = '';
}

/* ============================================================================
   CONFIRM SUMMARY MODAL
   ============================================================================ */

function openConfirmSummaryModal(event) {
  event.preventDefault();

  if (document.getElementById('finalSubmitBtn').disabled) return;

  if (!currentClaim || currentClaim.claim_id !== currentClaimId) {
    alert('ไม่พบข้อมูลคำร้องที่ถูกต้องสำหรับการส่งมอบ กรุณากลับไปตรวจสอบคำร้องอีกครั้ง');
    return;
  }

  if (!document.getElementById('verifyCheck').checked) {
    alert('กรุณายืนยันตัวตนผู้รับคืนก่อนดำเนินการ');
    return;
  }

  if (!hasSignature) {
    alert('กรุณาลงลายเซ็นดิจิทัลก่อนยืนยันการส่งมอบ');
    return;
  }

  document.getElementById('summaryClaimId').innerText = document.getElementById('claimIdText').innerText;
  document.getElementById('summaryItemName').innerText = document.getElementById('itemNameText').innerText;
  document.getElementById('summaryRecipient').innerText = document.getElementById('recipientNameText').innerText;
  document.getElementById('summaryStaff').innerText = document.getElementById('staffNameInput').value;
  document.getElementById('summaryFileCount').innerText = `${selectedFiles.length} ไฟล์`;
  document.getElementById('summarySignatureImg').src = canvas.toDataURL('image/png');

  document.getElementById('confirmSummaryModal').classList.add('show');
}

function closeConfirmSummaryModal() {
  if (isSubmitting) return;
  document.getElementById('confirmSummaryModal').classList.remove('show');
}

/* ============================================================================
   STORAGE UPLOAD HELPERS
   ============================================================================ */

async function uploadEvidenceFiles(claimId, files) {
  const urls = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${claimId}/proof-${Date.now()}-${i}-${safeName}`;

    const { error: uploadError } = await supabaseClient.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabaseClient.storage.from(EVIDENCE_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

async function uploadSignature(claimId, dataUrl) {
  const blob = await dataUrlToBlob(dataUrl);
  const path = `${claimId}/signature-${Date.now()}.png`;

  const { error: uploadError } = await supabaseClient.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/png' });

  if (uploadError) throw uploadError;

  const { data } = supabaseClient.storage.from(EVIDENCE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/* ============================================================================
   SUBMIT FINAL HANDOVER
   ============================================================================ */

async function submitFinalHandover() {
  if (isSubmitting) return;

  if (!currentClaim || currentClaim.claim_id !== currentClaimId) {
    alert('ข้อมูลคำร้องไม่ตรงกับรายการที่กำลังส่งมอบ กรุณาเปิดรายการใหม่อีกครั้ง');
    return;
  }

  if (!hasSignature) {
    alert('ไม่พบลายเซ็นผู้รับคืน กรุณาลงลายเซ็นใหม่อีกครั้ง');
    return;
  }

  isSubmitting = true;

  const finalButton = document.getElementById('finalSubmitBtn');
  finalButton.disabled = true;
  finalButton.innerHTML = `<span class="loading-spinner"></span> กำลังบันทึก...`;

  try {
    // ตรวจสอบสถานะล่าสุดก่อนบันทึก ป้องกันการส่งมอบซ้ำ
    const latestClaim = await fetchClaimById(currentClaimId);
    if (!latestClaim) throw new Error('ไม่พบคำร้องนี้ในระบบ');
    if (isCompletedStatus(latestClaim.status)) throw new Error('คำร้องนี้มีประวัติการส่งมอบแล้ว');

    const claimId = latestClaim.claim_id;
    const itemId = latestClaim.item?.item_id;
    const itemName = latestClaim.item?.item_name || '-';
    const recipientName = latestClaim.recipient_name || '-';
    const staffName = document.getElementById('staffNameInput').value;

    // 1) อัปโหลดหลักฐาน (ถ้ามี) และลายเซ็น
    const proofUrls = selectedFiles.length > 0 ? await uploadEvidenceFiles(claimId, selectedFiles) : [];
    const signatureDataUrl = canvas.toDataURL('image/png');
    const signatureUrl = await uploadSignature(claimId, signatureDataUrl);

    const now = new Date().toISOString();

    // 2) บันทึกประวัติการส่งมอบ
    const { error: insertError } = await supabaseClient.from(HANDOVER_TABLE).insert({
      claim_id: claimId,
      item_id: itemId,
      recipient_name: recipientName,
      handover_date: now,
      staff_name: staffName,
      proof_image_url: proofUrls[0] || null,
      proof_urls: proofUrls,
      signature_image_url: signatureUrl,
      proof_file_count: selectedFiles.length,
      note: 'ส่งมอบคืนเจ้าของพร้อมลงลายเซ็นเรียบร้อยแล้ว',
    });

    if (insertError) throw insertError;

    // 3) อัปเดตสถานะคำร้อง
    const { error: claimUpdateError } = await supabaseClient
      .from(CLAIM_TABLE)
      .update({ status: 'completed' })
      .eq('claim_id', claimId);

    if (claimUpdateError) throw claimUpdateError;

    // 4) อัปเดตสถานะสิ่งของเป็น "คืนสำเร็จ"
    if (itemId) {
      const { error: itemUpdateError } = await supabaseClient
        .from(ITEM_TABLE)
        .update({ status: RETURNED_ITEM_STATUS, updated_at: now })
        .eq('item_id', itemId);

      if (itemUpdateError) throw itemUpdateError;
    }

    document.getElementById('confirmSummaryModal').classList.remove('show');
    document.getElementById('successClaimId').textContent = claimId;
    document.getElementById('successRecipient').textContent = recipientName;
    document.getElementById('successModal').classList.add('show');

    isSubmitting = false;
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการบันทึกการส่งมอบ:', error);

    isSubmitting = false;
    finalButton.disabled = false;
    finalButton.textContent = 'ยืนยันบันทึกสำเร็จ';

    alert(error.message || 'ไม่สามารถบันทึกข้อมูลการส่งมอบได้ กรุณาลองใหม่อีกครั้ง');
  }
}

/* ============================================================================
   NAVIGATION
   ============================================================================ */

function goToDashboard() {
  window.location.href = 'staff-dashboard.html';
}

/* ============================================================================
   EVENT WIRING
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  loadClaim();
  setTimeout(resizeCanvas, 150);

  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
  canvas.addEventListener('touchend', stopDrawing);

  document.getElementById('clearSignatureBtn').addEventListener('click', clearSignature);
  document.getElementById('photoInput').addEventListener('change', previewFiles);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllFiles);
  document.getElementById('itemPhotoFrame').addEventListener('click', () => {
    const img = document.getElementById('itemImage');
    if (img.src && img.style.display !== 'none') openImageModal(img.src);
  });

  document.getElementById('handoverForm').addEventListener('submit', openConfirmSummaryModal);
  document.getElementById('closeConfirmSummaryBtn').addEventListener('click', closeConfirmSummaryModal);
  document.getElementById('finalSubmitBtn').addEventListener('click', submitFinalHandover);
  document.getElementById('goToDashboardBtn').addEventListener('click', goToDashboard);

  document.getElementById('closeImageModalBtn').addEventListener('click', closeImageModal);
  document.getElementById('imageModal').addEventListener('click', function (event) {
    if (event.target === this) closeImageModal();
  });
  document.getElementById('confirmSummaryModal').addEventListener('click', function (event) {
    if (event.target === this) closeConfirmSummaryModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeImageModal();
    closeConfirmSummaryModal();
  });
});