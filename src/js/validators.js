// กติกากลางของช่องข้อมูลส่วนตัว (ชื่อ–นามสกุล / อีเมล / เบอร์โทรศัพท์)
// ใช้ร่วมกันทุกหน้าที่มีช่องเหล่านี้ เพื่อให้ขอบเขตและข้อความแจ้งเตือนตรงกัน
// แต่ละฟังก์ชันคืนข้อความ error (string) หรือ '' ถ้าผ่าน

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254; // ความยาวสูงสุดของอีเมลตามมาตรฐาน
export const PHONE_LENGTH = 10;

// ตัวอักษรไทย/อังกฤษ เว้นวรรค จุด ขีด และ ' (เช่น "ดร. สมชาย ใจดี", "Mary-Jane O'Neil")
const NAME_PATTERN = /^[A-Za-z฀-๿][A-Za-z฀-๿ .'-]*$/;
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
// เบอร์โทรศัพท์ไทย: ขึ้นต้นด้วย 0 ตามด้วยตัวเลขอีก 9 หลัก
const PHONE_PATTERN = /^0\d{9}$/;

export function validateFullName(value) {
  const name = (value || '').trim();
  if (!name) return 'กรุณากรอกชื่อ - นามสกุล';
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    return `ชื่อ - นามสกุลต้องยาว ${NAME_MIN_LENGTH}–${NAME_MAX_LENGTH} ตัวอักษร`;
  }
  if (!NAME_PATTERN.test(name)) {
    return 'ชื่อ - นามสกุลใช้ได้เฉพาะตัวอักษรไทยหรืออังกฤษ (ไม่มีตัวเลขหรือสัญลักษณ์พิเศษ)';
  }
  return '';
}

// ตรวจเฉพาะรูปแบบและความยาว — กติกาโดเมน (@gmail.com / @up.ac.th / @staff.com) แต่ละหน้าตรวจเองตาม role
export function validateEmailFormat(value) {
  const email = (value || '').trim();
  if (!email) return 'กรุณากรอกอีเมล';
  if (email.length > EMAIL_MAX_LENGTH) return `อีเมลต้องยาวไม่เกิน ${EMAIL_MAX_LENGTH} ตัวอักษร`;
  if (!EMAIL_PATTERN.test(email)) return 'รูปแบบอีเมลไม่ถูกต้อง (เช่น name@up.ac.th)';
  return '';
}

export function validatePhone(value) {
  const phone = (value || '').trim();
  if (!phone) return 'กรุณากรอกเบอร์โทรศัพท์';
  if (!PHONE_PATTERN.test(phone)) {
    return `เบอร์โทรศัพท์ต้องเป็นตัวเลข ${PHONE_LENGTH} หลัก ขึ้นต้นด้วย 0 (เช่น 0812345678)`;
  }
  return '';
}

// จำกัดความยาวที่พิมพ์ได้ในช่องกรอก และให้ช่องเบอร์โทรรับเฉพาะตัวเลข
export function applyFieldLimits({ name, email, phone }) {
  if (name) name.maxLength = NAME_MAX_LENGTH;
  if (email) email.maxLength = EMAIL_MAX_LENGTH;
  if (phone) {
    phone.maxLength = PHONE_LENGTH;
    phone.inputMode = 'numeric';
    phone.addEventListener('input', () => {
      const digits = phone.value.replace(/\D/g, '').slice(0, PHONE_LENGTH);
      if (digits !== phone.value) phone.value = digits;
    });
  }
}
