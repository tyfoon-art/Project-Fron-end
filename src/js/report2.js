let maxDateStr = '';
let maxTimeStr = '';

document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  maxDateStr = `${year}-${month}-${day}`;

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  maxTimeStr = `${hours}:${minutes}`;

  const dateInput = document.getElementById('dateInput');
  if (dateInput) {
    dateInput.value = maxDateStr;
    dateInput.max = maxDateStr;
  }

  restoreFromSessionStorage();

  // จำค่าทุกครั้งที่ผู้ใช้แก้ไข เพื่อให้ยังอยู่เมื่อกด "ย้อนกลับ" (ทั้งปุ่มในหน้าและปุ่มของเบราว์เซอร์) แล้วกลับมาใหม่
  ['locationInput', 'dateInput', 'timeInput'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', saveDraft);
    input.addEventListener('change', saveDraft);
  });

  if (sessionStorage.getItem('report_edit_item_id')) {
    const heading = document.querySelector('.report-header h1');
    if (heading) heading.textContent = 'แก้ไขโพสต์';
  }
});

// โหมดแก้ไขต้องย้อนกลับไปพร้อม id + mode=edit ไม่งั้น report.html จะมองว่าเป็นการเริ่มโพสต์ใหม่
// เก็บค่าที่กรอกค้างไว้ลง sessionStorage (ยังไม่ตรวจความถูกต้อง — ตรวจตอนกด "ถัดไป")
function saveDraft() {
  sessionStorage.setItem('report_incident_location', document.getElementById('locationInput')?.value.trim() || '');
  sessionStorage.setItem('report_date', document.getElementById('dateInput')?.value || '');
  sessionStorage.setItem('report_time', document.getElementById('timeInput')?.value || '');
}

function goBack() {
  saveDraft();

  const editItemId = sessionStorage.getItem('report_edit_item_id');
  window.location.href = editItemId
    ? `report.html?id=${editItemId}&mode=edit`
    : 'report.html';
}

function restoreFromSessionStorage() {
  const savedLocation = sessionStorage.getItem('report_incident_location');
  if (savedLocation) {
    const locationInput = document.getElementById('locationInput');
    if (locationInput) {
      locationInput.value = savedLocation;
    }
  }

  const savedDate = sessionStorage.getItem('report_date');
  if (savedDate) {
    const dateInput = document.getElementById('dateInput');
    if (dateInput) dateInput.value = savedDate;
  }

  const savedTime = sessionStorage.getItem('report_time');
  if (savedTime) {
    const timeInput = document.getElementById('timeInput');
    if (timeInput) timeInput.value = savedTime;
  }
}

function clearError(inputId, errorId) {
  const inputElem = document.getElementById(inputId);
  const errorElem = document.getElementById(errorId);

  if (inputElem) inputElem.classList.remove('error');
  if (errorElem) errorElem.style.display = 'none';
}

function validateAndNext() {
  let isValid = true;

  const locationInput = document.getElementById('locationInput');
  const locationError = document.getElementById('locationError');

  const dateInput = document.getElementById('dateInput');
  const dateError = document.getElementById('dateError');

  const timeInput = document.getElementById('timeInput');
  const timeError = document.getElementById('timeError');

  // ตรวจสอบสถานที่เกิดเหตุ (กรอกข้อความอิสระ)
  if (!locationInput || !locationInput.value.trim()) {
    if (locationInput) locationInput.classList.add('error');
    if (locationError) {
      locationError.textContent = 'กรุณาระบุสถานที่เกิดเหตุ / พบสิ่งของ';
      locationError.style.display = 'block';
    }
    isValid = false;
  } else {
    if (locationInput) locationInput.classList.remove('error');
    if (locationError) locationError.style.display = 'none';
  }

  // ตรวจสอบวันที่
  if (!dateInput || !dateInput.value || dateInput.value > maxDateStr) {
    if (dateInput) dateInput.classList.add('error');
    if (dateError) dateError.style.display = 'block';
    isValid = false;
  } else {
    if (dateInput) dateInput.classList.remove('error');
    if (dateError) dateError.style.display = 'none';
  }

  // ตรวจสอบเวลา
  if (!timeInput || !timeInput.value) {
    if (timeInput) timeInput.classList.add('error');
    if (timeError) {
      timeError.textContent = 'กรุณากรอกเวลาโดยประมาณ';
      timeError.style.display = 'block';
    }
    isValid = false;
  } else if (dateInput && dateInput.value === maxDateStr && timeInput.value > maxTimeStr) {
    if (timeInput) timeInput.classList.add('error');
    if (timeError) {
      timeError.textContent = 'ไม่อนุญาตให้เลือกเวลาในอนาคตสำหรับวันนี้';
      timeError.style.display = 'block';
    }
    isValid = false;
  } else {
    if (timeInput) timeInput.classList.remove('error');
    if (timeError) timeError.style.display = 'none';
  }

  if (!isValid) return;

  // บันทึกสถานที่ลง sessionStorage
  const incidentLocation = locationInput.value.trim();
  sessionStorage.setItem('report_incident_location', incidentLocation);
  sessionStorage.setItem('report_date', dateInput.value);
  sessionStorage.setItem('report_time', timeInput.value);

  window.location.href = 'report3.html';
}

// module script ไม่ leak ฟังก์ชันออกไปเป็น global โดยอัตโนมัติ จึงแปะเข้า window
window.clearError = clearError;
window.validateAndNext = validateAndNext;
window.goBack = goBack;