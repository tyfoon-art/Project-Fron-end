import { supabaseClient } from './supabaseClient.js';

const CLAIMABLE_STATUS = 'อยู่ที่จุดรับฝาก';
let currentItem = null;
let currentUserId = null;
let currentUserProfile = null;

function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                   'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const buddhistYear = d.getFullYear() + 543;
  return `${d.getDate()} ${months[d.getMonth()]} ${buddhistYear}`;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ช่องอัปโหลดหลักฐาน: เลือกไฟล์แล้วลบออกได้ (กรณีเลือกผิด) โดยไม่ต้องเลือกไฟล์ใหม่มาทับ
function setupUploadBox({ boxId, titleId, descId, inputId, removeBtnId, allowPdf }) {
  const box = document.getElementById(boxId);
  const title = document.getElementById(titleId);
  const desc = document.getElementById(descId);
  const input = document.getElementById(inputId);
  const removeBtn = document.getElementById(removeBtnId);
  const defaultTitle = title.textContent;
  const defaultDesc = desc.innerHTML;

  function clearFile() {
    input.value = '';
    box.classList.remove('has-file');
    title.textContent = defaultTitle;
    desc.innerHTML = defaultDesc;
    removeBtn.style.display = 'none';
  }

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) {
      clearFile();
      return;
    }

    const isAllowedType = file.type.startsWith('image/') || (allowPdf && file.type === 'application/pdf');
    if (!isAllowedType) {
      clearFile();
      alert(allowPdf ? 'รองรับเฉพาะไฟล์รูปภาพหรือ PDF เท่านั้น' : 'รองรับเฉพาะไฟล์รูปภาพเท่านั้น');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      clearFile();
      alert('ไฟล์มีขนาดเกิน 5 MB กรุณาเลือกไฟล์ใหม่');
      return;
    }

    box.classList.add('has-file');
    title.textContent = 'เลือกไฟล์แล้ว';
    desc.textContent = file.name;
    removeBtn.style.display = '';
  });

  removeBtn.addEventListener('click', (event) => {
    event.stopPropagation(); // ไม่ให้คลิกทะลุไปเปิดหน้าต่างเลือกไฟล์ของกล่องอัปโหลด
    clearFile();
  });
}

setupUploadBox({
  boxId: 'proofBox', titleId: 'proofBoxTitle', descId: 'proofBoxDesc',
  inputId: 'proofImgInput', removeBtnId: 'proofRemoveBtn', allowPdf: false
});

setupUploadBox({
  boxId: 'idBox', titleId: 'idBoxTitle', descId: 'idBoxDesc',
  inputId: 'idCardInput', removeBtnId: 'idRemoveBtn', allowPdf: true
});

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('id');

  if (!itemId) {
    alert('ไม่พบรหัสสิ่งของที่ต้องการขอรับคืน');
    window.location.href = 'browse.html';
    return;
  }

  // แก้ไข: ใช้คีย์ "userEmail" ให้ตรงกับที่ login.js / profile.js ตั้งไว้จริง
  const currentUserEmail = localStorage.getItem('userEmail');
  if (!currentUserEmail) {
    alert('กรุณาเข้าสู่ระบบก่อนยื่นคำร้องขอรับคืนสิ่งของ');
    window.location.href = `login.html?redirect=claim.html?id=${itemId}`;
    return;
  }

const { data: userAccount, error: userError } = await supabaseClient
    .from('user_account')
    .select('user_id, full_name, email, phone_number')
    .eq('email', currentUserEmail)
    .maybeSingle();

  if (userError || !userAccount) {
    alert('ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    window.location.href = `login.html?redirect=claim.html?id=${itemId}`;
    return;
  }

  currentUserId = userAccount.user_id;
  currentUserProfile = userAccount;

  document.getElementById('breadcrumbDetailLink').href = `detail.html?id=${itemId}`;

  try {
    // แก้ไข: ดึงเฉพาะคอลัมน์ที่มีอยู่จริงในตาราง item (item_date, image,
    const { data: item, error } = await supabaseClient
      .from('item')
      .select('item_id, item_name, status, description, image_url')
      .eq('item_id', itemId)
      .maybeSingle();

    if (error) throw error;

    if (!item) {
      alert('ไม่พบข้อมูลรายการสิ่งของที่ต้องการขอรับคืน');
      window.location.href = 'browse.html';
      return;
    }

    if (item.status !== CLAIMABLE_STATUS) {
      alert(`รายการนี้มีสถานะเป็น "${item.status}" จึงไม่สามารถดำเนินการยื่นคำร้องขอรับคืนได้ในขณะนี้`);
      window.location.href = `detail.html?id=${itemId}`;
      return;
    }

    currentItem = item;

    let foundDateText = '-';
    let foundLocationText = 'ไม่ระบุ';

    const { data: foundReport, error: reportError } = await supabaseClient
      .from('report')
      .select('incident_datetime, incident_location')
      .eq('item_id', itemId)
      .eq('report_type', 'found')
      .order('incident_datetime', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportError) {
      console.error('Failed to load found-report info:', reportError);
    } else if (foundReport) {
      foundDateText = formatThaiDate(foundReport.incident_datetime);
      foundLocationText = foundReport.incident_location || 'ไม่ระบุ';
    }

    document.getElementById('claimItemTitle').textContent = item.item_name;
    document.getElementById('claimItemDate').textContent = `พบเมื่อ: ${foundDateText}`;
    document.getElementById('claimItemLocation').textContent = `สถานที่: ${foundLocationText}`;
    document.getElementById('claimItemStatus').textContent = `สถานะ: ${item.status}`;
    document.getElementById('claimItemImg').src = item.image_url || 'images/no-image.png';
  } catch (err) {
    console.error('Failed to load item:', err);
    alert('เกิดข้อผิดพลาดในการโหลดข้อมูลสิ่งของ กรุณาลองใหม่อีกครั้ง');
  }
});

async function uploadEvidenceFile(file, prefix) {
  const fileExt = file.name.split('.').pop();
  const filePath = `${currentUserId}/${prefix}-${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabaseClient
    .storage
    .from('claim-evidence')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabaseClient
    .storage
    .from('claim-evidence')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function submitClaim() {
  if (!currentItem || !currentUserId) {
    alert('ไม่พบข้อมูลสิ่งของหรือผู้ใช้งาน กรุณาโหลดหน้านี้ใหม่');
    return;
  }

  const evidenceText = document.getElementById('evidenceText').value.trim();
  const proofFile = document.getElementById('proofImgInput').files[0];
  const idFile = document.getElementById('idCardInput').files[0];

  if (!evidenceText) {
    alert('กรุณากรอกรายละเอียดลักษณะเฉพาะของสิ่งของ');
    return;
  }
  if (!proofFile || !idFile) {
    alert('กรุณาอัปโหลดหลักฐานยืนยันตัวตนและสิ่งของให้ครบถ้วน');
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>กำลังส่งคำร้อง...</span>';

  try {
    const [proofUrl, idUrl] = await Promise.all([
      uploadEvidenceFile(proofFile, 'proof'),
      uploadEvidenceFile(idFile, 'idcard')
    ]);

    // รวมคำอธิบาย + URL ไฟล์หลักฐานทั้งสองไว้ในสตริง JSON เดียว
    const ownershipEvidence = JSON.stringify({
      description: evidenceText,
      proof_image_url: proofUrl,
      id_card_url: idUrl
    });

    // เขียนผ่าน RPC create_claim (anon เขียนตารางตรงไม่ได้ เพราะเปิด RLS)
    const { error } = await supabaseClient.rpc('create_claim', {
      p_item_id: currentItem.item_id,
      p_user_id: currentUserId,
      p_claimant_name: currentUserProfile?.full_name || null,
      p_claimant_student_id: null,
      p_description: evidenceText,
      p_email: currentUserProfile?.email || null,
      p_faculty: null,
      p_ownership_evidence: ownershipEvidence,
      p_phone: currentUserProfile?.phone_number || null
    });

    if (error) throw error;

    alert('ส่งคำร้องขอรับคืนสิ่งของสำเร็จเรียบร้อยแล้ว! เจ้าหน้าที่กำลังตรวจสอบข้อมูล');
    window.location.href = 'home.html';
  } catch (err) {
    console.error('Failed to submit claim:', err);
    alert('เกิดข้อผิดพลาดในการส่งคำร้อง กรุณาลองใหม่อีกครั้ง');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>ส่งคำร้องขอรับคืน</span><i class="fa-solid fa-arrow-right"></i>';
  }
}

// script type="module" มี scope ปิด ต้อง export ฟังก์ชันที่ HTML เรียกผ่าน
// onclick ออกไปที่ window เอง ไม่งั้นปุ่ม "ส่งคำร้องขอรับคืน" จะกดแล้วไม่ทำงาน
window.submitClaim = submitClaim;