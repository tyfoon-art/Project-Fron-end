// เก็บรูปที่ผู้ใช้เลือกไว้ชั่วคราวระหว่างเดินไปมาในขั้นตอนโพสต์ (report → report2 → report3)
// ใช้ IndexedDB เพราะรูป base64 ขนาดหลาย MB ใหญ่เกินโควตาของ sessionStorage
// ทุกฟังก์ชันไม่ throw — ถ้า IndexedDB ใช้ไม่ได้ ก็แค่ไม่จำรูปให้ (ผู้ใช้เลือกรูปใหม่ได้ตามปกติ)

const DB_NAME = 'lf_report_draft';
const STORE = 'images';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, action) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = action(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(req.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('ใช้งานที่เก็บรูปชั่วคราวไม่ได้:', err);
    return undefined;
  }
}

// key: 'main' (รูปประกาศ) | 'secret' (รูปตำหนิลับ)
export function saveDraftImage(key, dataUrl) {
  return withStore('readwrite', store => (dataUrl ? store.put(dataUrl, key) : store.delete(key)));
}

export async function loadDraftImage(key) {
  return (await withStore('readonly', store => store.get(key))) || '';
}

export function clearDraftImages() {
  return withStore('readwrite', store => store.clear());
}
