import { supabaseClient } from './supabaseClient.js';

const CLAIMABLE_STATUS = 'อยู่ที่จุดรับฝาก';
let currentItem = null;
let currentUserId = null;

function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                   'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const buddhistYear = d.getFullYear() + 543;
  return `${d.getDate()} ${months[d.getMonth()]} ${buddhistYear}`;
}

function markFileSelected(boxId, titleId, descId, file) {
  document.getElementById(boxId).classList.add('has-file');
  document.getElementById(titleId).textContent = 'เลือกไฟล์แล้ว';
  document.getElementById(descId).textContent = file.name;
}

document.getElementById('proofImgInput').addEventListener('change', (e) => {
  if (e.target.files[0]) markFileSelected('proofBox', 'proofBoxTitle', 'proofBoxDesc', e.target.files[0]);
});

document.getElementById('idCardInput').addEventListener('change', (e) => {
  if (e.target.files[0]) markFileSelected('idBox', 'idBoxTitle', 'idBoxDesc', e.target.files[0]);
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
    .select('user_id')
    .eq('email', currentUserEmail)
    .maybeSingle();

  if (userError || !userAccount) {
    alert('ไม่พบบัญชีผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    window.location.href = `login.html?redirect=claim.html?id=${itemId}`;
    return;
  }

  currentUserId = userAccount.user_id;

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

    // แก้ไข: ไม่กำหนด claim_id เอง
    const { error } = await supabaseClient
      .from('claim')
      .insert([{
        ownership_evidence: ownershipEvidence,
        item_id: currentItem.item_id,
        user_id: currentUserId
      }]);

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