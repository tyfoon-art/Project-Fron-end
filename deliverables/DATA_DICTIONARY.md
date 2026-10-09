# Data Dictionary — Lost & Found ICT

พจนานุกรมข้อมูลของระบบ อ้างอิงจากการอ่านโค้ดใน `src/js/*.js` ทั้งหมด
เอกสารนี้จึงรวบรวมหลักฐานจากฝั่ง client ทุกจุดที่เรียกตารางและ RPC
คู่กับ [schema.sql](schema.sql) ซึ่งเป็น DDL ร่าง (MySQL 8) ที่สร้างจากแผนภาพ ER — ครบ 14 ตาราง
แต่ยังไม่ครอบคลุม RPC/RLS/trigger (ในระบบจริงถูกสร้างผ่าน SQL Editor โดยตรง)

อัปเดตล่าสุด: จากสถานะโค้ดปัจจุบัน · ชนิด/ความยาวคอลัมน์ใน `schema.sql` เป็นข้อสันนิษฐานจาก diagram
ซึ่งบางจุดต่างจากหลักฐานโค้ดจริง (เช่น `item_id` โค้ดใช้ข้อความ `ITM-2026-0001` แต่ DDL ร่างเป็น `INT`) — ดูหัวข้อ 8

---

## 1. ภาพรวม

| หมวด | จำนวน | หมายเหตุ |
|------|------|----------|
| ตาราง (schema `public`) | 14 | ดูหัวข้อ 3 |
| RPC ที่โค้ดเรียกจริง | 16 | ดูหัวข้อ 5 |
| Storage bucket | 4 | `item-media`, `claim-evidence`, `handover-evidence`, `avatars` (หัวข้อ 6) |
| View | **0** | ไม่พบการเรียก view ใด ๆ ในโค้ด |
| Trigger | **0** | ไม่พบหลักฐาน (ดูหัวข้อ 7) |
| Function นอกชุด RPC | **0** | มีเฉพาะ 16 RPC หัวข้อ 5 |
| ตารางที่โค้ดไม่ได้เรียกเลย | 2 | `notification`, `item_history_log` (+ `disposal` อ่านตรงเป็น 0 — เขียนผ่าน RPC เท่านั้น) |

**วิธีเขียน:** การเขียนข้อมูลทุกตารางเกิดผ่าน RPC เท่านั้น — ไม่พบ `.insert()` / `.update()` / `.upsert()` / `.delete()`
ที่เรียกตารางใด ๆ ใน `src/js` (มีแต่ `.remove()` ของ DOM) จึงสรุปได้ว่า client ไม่มีสิทธิ์เขียนตรง
และ RLS เปิดบังคับอยู่

---

## 2. ระดับหลักฐาน

| ระดับหลักฐาน | ความหมาย |
|-----------|----------|
| ✅ [จริง] | **โค้ดเรียกจริง** — พบใน `.select()` / `.eq()` / พารามิเตอร์ RPC |
| ⬜ [สันนิษฐาน] | **คอมเมนต์นักพัฒนาในโค้ด** — หัวข้อ "ข้อสมมติฐานเรื่องโครงสร้างตาราง" 8 ไฟล์ (ยังไม่ยืนยันกับ DB จริง) |
| ❓ [ต้องยืนยัน] | **ขัดแย้งหรือไม่พบหลักฐาน** — ต้องยืนยันกับฐานข้อมูลจริง (โครง `schema.sql` ยังเป็นข้อสันนิษฐาน) |

คอมเมนต์ ⬜ [สันนิษฐาน] เจอใน: `staff-inventory-add.js:5-33`, `staff-verify-detail.js:3-23`, `staff-dispose-item.js:3-18`,
`staff-overdue-list.js:3-17`, `staff-handover.js:3-19`, `staff-dashboard.js:3-15`, `staff-verify-claims.js:3-13`,
`staff-profile.js:3-15` (ทุกไฟล์ขึ้นต้นว่า *"ข้อสมมติฐาน … แก้ชื่อ table/column ให้ตรงกับของจริงได้ที่นี่"*)

**ชนิดข้อมูลที่ยืนยันได้จากโค้ด:** `category_id` = uuid (`report.js:28`), `user_id` = uuid (`report3.js:140`),
`incident_datetime` = timestamptz (`report3.js:126`), `handover.proof_urls` = jsonb (`staff-handover.js:12`)
ส่วนชนิดที่เหลือให้ยึด [schema.sql](schema.sql) (ไฟล์ DDL ร่างที่เติมไว้) เป็นหลัก แต่อย่าลืมว่ายังเป็นข้อสันนิษฐาน

---

## 3. ตารางทั้ง 14 ตาราง

### 3.1 `category` — หมวดหมู่สิ่งของ (Master Data)

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `category_id` | ✅ [จริง] uuid (`report.js:28`) | PK |
| `category_name` | ✅ [จริง] (`browse.js:47-50`) | ชื่อหมวดภาษาไทย |
| `is_active` | ✅ [จริง] (`browse.js:49`, `report.js:14`) | ปิดหมวดที่เลิกใช้โดยไม่ลบแถว |

### 3.2 `claim` — คำร้องขอรับคืน

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `claim_id` | ⬜ [สันนิษฐาน] text รูปแบบ `CLM-24-0891` (`staff-verify-claims.js:7`) | PK |
| `item_id` | ✅ [จริง] FK → `item` (`staff-verify-detail.js:77`) | สิ่งของที่ยื่นคำร้อง |
| `user_id` | ✅ [จริง] (`activity.js:157` `.eq('user_id', ...)`) | ผู้ยื่นคำร้อง — ไม่อยู่ใน requirements 7.2 แต่โค้ดใช้จริง |
| `claimant_name` | ✅ [จริง] (`staff-verify-detail.js:75`) | |
| `claimant_student_id` | ✅ [จริง] (`staff-verify-detail.js:75`) | ยังส่ง `null` เสมอ (`claim.js:180`) |
| `faculty` | ✅ [จริง] (`staff-verify-detail.js:76`) | ยังส่ง `null` เสมอ (`claim.js:183`) |
| `phone` | ✅ [จริง] (`staff-verify-detail.js:76`, `create_claim` p_phone) | |
| `email` | ✅ [จริง] (`staff-verify-detail.js:76`, `create_claim` p_email) | |
| `description` | ✅ [จริง] (`staff-verify-detail.js:76`, `create_claim` p_description) | ข้อความให้การ |
| `ownership_evidence` | ✅ [จริง] (`activity.js:153`, `create_claim` p_ownership_evidence) | JSON แนบหลักฐาน (ดูข้อขัดแย้งหัวข้อ 8) |
| `status` | ✅ [จริง] (`staff-verify-detail.js:76`, `staff-verify-claims.js:79`) | enum คำร้อง — หัวข้อ 4 |
| `claim_status` | ❓ [ต้องยืนยัน] (`activity.js:151` อ่านอย่างเดียว) | ชื่อคอลัมน์ที่ขัดกับที่อื่น — หัวข้อ 8 |
| `note` | ✅ [จริง] (`staff-verify-claims.js:79`) | |
| `reviewer_name` | ✅ [จริง] (`staff-verify-detail.js:76`, p_reviewer_name) | |
| `reviewer_note` | ✅ [จริง] (`staff-verify-detail.js:76`, p_reviewer_note) | |
| `created_at` | ✅ [จริง] (`staff-verify-detail.js:76`) | |
| `updated_at` | ⬜ [สันนิษฐาน] (`staff-verify-detail.js:13`) | |
| `approved_at` | ✅ [จริง] (`staff-verify-detail.js:76`) | |

### 3.3 `claim_activity_log` — ประวัติความเคลื่อนไหวของคำร้อง

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `log_id` | ⬜ [สันนิษฐาน] (`staff-verify-detail.js:16`) | PK |
| `claim_id` | ✅ [จริง] FK → `claim` (`staff-verify-detail.js:104`) | |
| `title` | ✅ [จริง] (`staff-verify-detail.js:103`) | ข้อความเหตุการณ์ |
| `created_at` | ✅ [จริง] (`staff-verify-detail.js:103`) | |

ถ้าตารางว่างหรือไม่มี โค้ดจะสร้างไทม์ไลน์จาก `item.created_at` + `claim.created_at` แทน (`staff-verify-detail.js:17-18`)

### 3.4 `claim_proof` — ไฟล์หลักฐานแนบคำร้อง

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `proof_id` | ⬜ [สันนิษฐาน] (`staff-verify-detail.js:14`) | PK |
| `claim_id` | ✅ [จริง] FK → `claim` (`staff-verify-detail.js:90`) | |
| `name` | ✅ [จริง] (`staff-verify-detail.js:89`) | ชื่อไฟล์ต้นฉบับ (requirements 7.2 เขียน `title` ❓ [ต้องยืนยัน]) |
| `url` | ✅ [จริง] (`staff-verify-detail.js:89`) | ชี้ไป bucket `claim-evidence` |
| `created_at` | ✅ [จริง] (`staff-verify-detail.js:89`) | |

### 3.5 `disposal` — การจำหน่ายสิ่งของ

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `disposal_id` | ⬜ [สันนิษฐาน] (`staff-dispose-item.js:15`) | PK |
| `item_id` | ⬜ [สันนิษฐาน] + ✅ [จริง] ผ่าน RPC (`staff_dispose_item` p_item_id) | FK → `item` |
| `dispose_type` | ✅ [จริง] (`staff-dispose-item.js:313`) | `donate` \| `destroy` \| `other` (`staff-dispose-item.html:94-110`) |
| `note` | ✅ [จริง] (p_note, บังคับกรอก `staff-dispose-item.js:304-307`) | เหตุผล/รายละเอียด |
| `disposed_at` | ⬜ [สันนิษฐาน] (`staff-dispose-item.js:15-16`) | วันเวลาจำหน่ายจริง |
| `days_in_storage` | ⬜ [สันนิษฐาน] (`staff-dispose-item.js:15-16`) | จำนวนวันที่จัดเก็บ ณ วันจำหน่าย |

**หมายเหตุ:** ค่าคงที่ `DISPOSAL_TABLE` ถูกประกาศ (`staff-dispose-item.js:22`) แต่**ไม่เคยถูกเรียก `.from()`**
— ฝั่งเว็บอ่าน/เขียนตารางนี้ผ่าน RPC `staff_dispose_item` เท่านั้น

### 3.6 `handover` — การส่งมอบของคืน

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `handover_id` | ⬜ [สันนิษฐาน] (`staff-handover.js:11`) | PK |
| `claim_id` | ⬜ [สันนิษฐาน] + p_claim_id (`staff-handover.js:528`) | FK → `claim` |
| `item_id` | ✅ [จริง] (`staff-dashboard.js:106`) | FK → `item` |
| `recipient_name` | ✅ [จริง] (`staff-dashboard.js:101`) | ชื่อผู้รับ |
| `handover_date` | ✅ [จริง] (`staff-dashboard.js:102`) | |
| `staff_name` | ✅ [จริง] (`staff-dashboard.js:103`) | เจ้าหน้าที่ผู้ส่งมอบ |
| `proof_image_url` | ✅ [จริง] (`staff-dashboard.js:104`) | ภาพหลักฐาน |
| `proof_urls` | ⬜ [สันนิษฐาน] jsonb (`staff-handover.js:12`, p_proof_urls) | หลายไฟล์ |
| `signature_image_url` | ⬜ [สันนิษฐาน] (`staff-handover.js:13`, p_signature_image_url) | ลายเซ็น |
| `proof_file_count` | ⬜ [สันนิษฐาน] (`staff-handover.js:13`) | |
| `note` | ✅ [จริง] (`staff-dashboard.js:105`, p_note) | |

### 3.7 `item` — ตารางหลักของระบบ

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `item_id` | ⬜ [สันนิษฐาน] text รูปแบบ `ITM-2026-0001` (`staff-inventory-add.js:8`), ✅ [จริง] ใช้ทุกหน้า | PK (ไม่ใช่ uuid — หัวข้อ 8) |
| `reference_id` | ⬜ [สันนิษฐาน] รูปแบบ `INV-2026-001` (`staff-inventory-add.js:9`, สร้างที่ `:269`) | เลขอ้างอิงคลัง |
| `item_name` | ✅ [จริง] ทุกหน้า | |
| `category` | ✅ [จริง] (`staff-verify-detail.js:77`, payload `staff-inventory-add.js:613`) | ชื่อหมวดเป็นข้อความ — ❓ [ต้องยืนยัน] อาจซ้ำกับ `category_id` |
| `category_key` | ⬜ [สันนิษฐาน] + payload (`staff-inventory-add.js:614`) | คีย์หมวด (`mainCategory`) |
| `sub_category` | ⬜ [สันนิษฐาน] + payload (`staff-inventory-add.js:615`) | |
| `category_id` | ✅ [จริง] FK → `category` (`detail.js:110`, `staff-dispose-item.js:94`) | |
| `description` | ✅ [จริง] (`detail.js`, `browse.js`) | |
| `location_zone` | ⬜ [สันนิษฐาน] + payload (`staff-inventory-add.js:617`) | ประเภทสถานที่ |
| `location_detail` | ⬜ [สันนิษฐาน] + payload (`staff-inventory-add.js:618`) | |
| `location_landmark` | ⬜ [สันนิษฐาน] + payload (`staff-inventory-add.js:619`) | |
| `found_location` | ✅ [จริง] (`staff-verify-detail.js:77`) | ข้อความสรุปสถานที่พบ |
| `found_date_time` | ✅ [จริง] (`staff-verify-detail.js:77`) | |
| `image_url` | ✅ [จริง] (`detail.js`, `staff-dispose-item.js:91`) | ❓ [ต้องยืนยัน] ตอนนี้เก็บ base64 ของโพสต์ — หัวข้อ 8 |
| `storage_room` | ⬜ [สันนิษฐาน] + payload (`staff-inventory-add.js:622`) | ระบุผ่าน `staff_receive_item` ด้วย |
| `shelf_id` | ⬜ [สันนิษฐาน] + payload (`staff-inventory-add.js:623`, p_shelf_id) | |
| `bin_id` | ⬜ [สันนิษฐาน] + payload (`staff-inventory-add.js:624`, p_bin_id) | |
| `storage_location` | ⬜ [สันนิษฐาน] + payload (`staff-inventory-add.js:625`, p_storage_location) | ข้อความสรุปตำแหน่ง |
| `current_storage_id` | ✅ [จริง] FK → `storage_point` (`detail.js:110`, `admin-storage-points.js:69`) | |
| `matched_item_id` | ✅ [จริง] อ่านอย่างเดียว (`detail.js:229-245`) | ❓ [ต้องยืนยัน] ไม่มีโค้ดเขียนค่านี้ — F-05 |
| `recorded_by` | ✅ [จริง] (`staff-verify-detail.js:77`) | ผู้บันทึกของเข้าคลัง |
| `status` | ✅ [จริง] ทุกหน้า | `item_status_enum` — หัวข้อ 4 |
| `created_at` | ✅ [จริง] ทุกหน้า | ฐานนับ 90 วันในโค้ดปัจจุบัน (BR-08 ❓ [ต้องยืนยัน]) |
| `updated_at` | ⬜ [สันนิษฐาน] (`staff-overdue-list.js:10`) | |
| `disposed_at` | ✅ [จริง] (`staff-overdue-list.js:127`) | วันจำหน่าย (ไม่อยู่ใน requirements 7.2) |
| `deleted_at` | ✅ [จริง] Soft delete ทุกหน้า (`staff-dispose-item.js:92`) | |

คอลัมน์ที่ส่งเข้า `staff_create_item` (`staff-inventory-add.js:611-626`):
`reference_id, item_name, category, category_key, sub_category, description, location_zone, location_detail,
location_landmark, found_location, found_date_time, storage_room, shelf_id, bin_id, storage_location, status`

### 3.8 `item_history_log` — ประวัติสถานะรายชิ้น

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `item_id`, `status`, `changed_by`, `changed_at`, `note` | ⬜ [สันนิษฐาน] เฉพาะ requirements 7.2 | ไม่พบโค้ดเรียกตารางนี้แม้แต่ที่เดียว |

**สถานะ:** ยังไม่ทำงาน — ต้องให้ RPC/Trigger เขียนอัตโนมัติทุกครั้งที่สถานะเปลี่ยน (KP-08, BR-09)

### 3.9 `item_media` — สื่อประกอบสิ่งของ

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `media_id` | ⬜ [สันนิษฐาน] (`staff-inventory-add.js:22`) | PK |
| `item_id` | ✅ [จริง] FK → `item` (`staff-post-detail.js:195`) | |
| `url` | ✅ [จริง] (`staff-post-detail.js:193`) | ชี้ไป bucket `item-media` |
| `type` | ✅ [จริง] payload (`staff-inventory-add.js:489`) | MIME type ของไฟล์ |
| `name` | ✅ [จริง] (`staff-post-detail.js:193`) | ชื่อไฟล์ต้นฉบับ |
| `size` | ⬜ [สันนิษฐาน] + payload (`staff-inventory-add.js:490`) | หน่วย byte |
| `created_at` | ✅ [จริง] (`staff-post-detail.js:193`) | |

### 3.10 `item_secret` — ข้อมูลลับสำหรับยืนยันสิทธิ์

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `item_id` | ⬜ [สันนิษฐาน] + ✅ [จริง] ผ่าน RPC เท่านั้น | FK → `item` |
| `defect_note` | ⬜ [สันนิษฐาน] (`staff-inventory-add.js:20`) | ตำหนิลับ อ่านผ่าน `get_staff_defect_note` เท่านั้น |
| `created_at`, `updated_at` | ⬜ [สันนิษฐาน] (requirements 7.2) | |
| ปลายทางของ `p_secret_image` | ❓ [ต้องยืนยัน] | `report3.js:147` ส่งรูปลับเข้า `create_report` — ต้องยืนยันว่าลงตารางนี้ ไม่ใช่ `report`/`item` |

### 3.11 `notification` — การแจ้งเตือนผู้ใช้

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `notification_id`, `user_id`, `type`, `payload`, `is_read`, `created_at` | ⬜ [สันนิษฐาน] เฉพาะ requirements 7.2 | **ไม่พบโค้ดเรียกตารางนี้เลย** |

**สถานะ:** ยังไม่ทำงาน — ไม่มีการเขียน ไม่มีหน้าจอแสดง (F-05, TS-06)

### 3.12 `report` — ใบแจ้งของหาย / ของที่พบ

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `report_id` | ✅ [จริง] (`activity.js:73`, p_report_id) | PK |
| `item_id` | ✅ [จริง] (`activity.js:77`, join ทุกหน้า) | FK → `item` |
| `user_id` | ✅ [จริง] (`activity.js:78`, `.eq('user_id', userId)` ที่ `:80`) | uuid → `user_account` |
| `report_type` | ✅ [จริง] (`activity.js:74`) | `report_type_enum`: `lost` \| `found` (`report.js:60`) |
| `incident_location` | ✅ [จริง] (`activity.js:75`) | |
| `incident_datetime` | ✅ [จริง] (`activity.js:76`, timestamptz `report3.js:126`) | |
| `description` | ⬜ [สันนิษฐาน] (requirements 7.2) + p_description (`report3.js:143`) | ❓ [ต้องยืนยัน] ปลายทางจริงอาจเป็น `item.description` — หน้าเว็บอ่านจาก `item` เสมอ |
| `image_url` | ⬜ [สันนิษฐาน] (requirements 7.2) + p_image_url (`report3.js:144`) | ❓ [ต้องยืนยัน] ปลายทางจริงอาจเป็น `item.image_url` (base64) |
| `deleted_at` | ⬜ [สันนิษฐาน] (requirements 7.2) + `delete_report` = Soft delete | |

### 3.13 `storage_point` — จุดรับฝาก (Master Data)

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `storage_id` | ✅ [จริง] PK (`admin-storage-points.js:130`) | |
| `storage_name` | ✅ [จริง] (`admin-storage-points.js:130`) | |
| `room` | ✅ [จริง] (`admin-storage-points.js:130`, p_room) | requirements 7.2 เขียน `storage_room` ❓ [ต้องยืนยัน] |
| `description` | ✅ [จริง] (`admin-storage-points.js:130`, p_description) | requirements 7.2 เขียน `storage_location` ❓ [ต้องยืนยัน] |
| `is_active` | ❓ [ต้องยืนยัน] ไม่พบในโค้ด (ทั้งที่ DD-09 สันนิษฐานไว้) | ต้องยืนยันว่า `admin_delete_storage_point` ทำ soft/hard delete |

### 3.14 `user_account` — บัญชีผู้ใช้ทุกบทบาท

| คอลัมน์ | หลักฐาน | คำอธิบาย |
|---------|---------|----------|
| `user_id` | ✅ [จริง] uuid (`report3.js:140`) | PK |
| `email` | ✅ [จริง] (`profile.js:46`, `forgotpassword.js:34`) | ซ้ำไม่ได้ (`EMAIL_ALREADY_EXISTS`) |
| `password` | ⬜ [สันนิษฐาน] (requirements 7.2) + p_password (`register.js:115`) | ❓ [ต้องยืนยัน] โอนรหัสผ่านเข้า RPC — ต้องยืนยันว่าถูก hash ใน DB |
| `full_name` | ✅ [จริง] (`profile.js:46`) | |
| `phone_number` | ✅ [จริง] (`profile.js:46`) | |
| `avatar_url` | ✅ [จริง] (`profile.js:46`) | base64 หรือ URL จาก bucket `avatars` |
| `role` | ✅ [จริง] (`browse.js:16`, `profile.js:46`) | `user` \| `staff` \| `admin` (`profile.js:69`) |

**RLS ที่ยืนยันจากคอมเมนต์โค้ด:** `user_account` เปิด RLS ไม่มี UPDATE policy ให้ client —
อัปเดตผ่าน RPC `update_user_profile` ที่เป็น `SECURITY DEFINER` (`profile.js:140-143`) ·
`claim` ก็ปิดเขียนตรงเช่นกัน (`claim.js:175`) · `disposal` เขียนผ่าน RPC เท่านั้น (`staff-dispose-item.js:310`)

---

## 4. ชุดค่าสถานะ / Enum

### `report_type_enum` (ตาราง `report.report_type`)
`lost` | `found` — ตัวพิมพ์เล็กเท่านั้น (`report.js:60`)

### `item_status_enum` (ตาราง `item.status`) — ค่าที่โค้ดใช้จริง
| ค่า | หลักฐาน / นิยาม |
|-----|-----------------|
| `รอตรวจสอบ` | `PENDING_STATUS` (`staff-inventory-add.js:41`) — โพสต์ยังไม่เข้าคลัง |
| `อยู่ที่จุดรับฝาก` | `NEW_ITEM_STATUS` (`staff-inventory-add.js:40`), `CLAIMABLE_STATUS` (`claim.js:3`) — ยื่นคำร้องได้เฉพาะสถานะนี้ |
| `กำลังดำเนินการเคลม` | `OPEN_STATUSES` (`staff-overdue-list.js:23`) — มีคำร้องค้างพิจารณา |
| `คืนสำเร็จ` | `RETURNED_ITEM_STATUS` (`staff-handover.js:25`), `CLOSED_STATUSES` (`detail.js:145`) — ปิดเคส |
| `หมดอายุ/ทำลายทิ้ง` | `DISPOSED_STATUS` (`staff-dispose-item.js:25`) — ปิดเคส |

- `OPEN_STATUSES = ['รอตรวจสอบ', 'อยู่ที่จุดรับฝาก', 'กำลังดำเนินการเคลม']` — รายการที่ยังดูแลได้ (`staff-overdue-list.js:23`)
- `INACTIVE_STATUSES = ['หมดอายุ/ทำลายทิ้ง', 'คืนสำเร็จ']` — ปิดเคสแล้ว (`staff-dispose-item.js:26`)
- หมายเหตุ: requirements 7.2 ระบุ `แจ้งพบ`/`แจ้งหาย` เป็นค่าสถานะ — **โค้ดไม่ได้ใช้** สองคำนี้เป็นเพียงป้ายบนหน้าจอ
  (มาจาก `report_type` ไม่ใช่ `item.status`) — ดูหัวข้อ 8

### `claim.status` (ตาราง `claim`)
`pending` | `more_info` | `approved` | `rejected` | `completed`
- `pending` = รอพิจารณา (`staff-verify-claims.js:26`), `more_info` = ขอข้อมูลเพิ่ม (`:27`)
- `approved` → ปุ่มส่งมอบปรากฏ (`staff-handover.js:9`), `completed` = ส่งมอบแล้ว (`staff-handover.js:53`)
- ❓ [ต้องยืนยัน] `activity.js:151` อ่าน `claim_status` แทน `status` — หัวข้อ 8

### ค่าอื่น ๆ
| ชุดค่า | ค่า | หลักฐาน |
|--------|-----|---------|
| `disposal.dispose_type` | `donate` \| `destroy` \| `other` | `staff-dispose-item.html:94-110` |
| `user_account.role` | `user` \| `staff` \| `admin` | `profile.js:69` |
| โดเมนอีเมล | ทั่วไป: `@gmail.com`, `@up.ac.th` · เจ้าหน้าที่: `@staff.com` เท่านั้น | `profile.js:8-9`, `register.js:125` |

---

## 5. RPC ทั้ง 16 ตัว (ที่โค้ดเรียกจริง)

| # | RPC | หน้าที่ | ผู้เรียก | พารามิเตอร์ที่สังเกตได้ |
|---|-----|--------|---------|------------------------|
| 1 | `register_user` | สมัครสมาชิก | `register.js:112` | `p_full_name, p_email, p_password, p_phone_number` |
| 2 | `verify_login` | เข้าสู่ระบบ | `login.js:94` | `p_email, p_password` |
| 3 | `update_user_profile` | แก้โปรไฟล์ผู้ใช้ (SECURITY DEFINER) | `profile.js` | `p_user_id, p_full_name, p_email, p_phone_number, p_avatar_url` |
| 4 | `staff_upsert_profile` | เพิ่ม/แก้โปรไฟล์เจ้าหน้าที่ | `staff-profile.js` | `p_staff_id, p_full_name, p_email, p_phone` |
| 5 | `staff_update_avatar` | เปลี่ยนรูปโปรไฟล์เจ้าหน้าที่ | `staff-profile.js` | `p_staff_id, p_avatar_url` |
| 6 | `create_report` | สร้างโพสต์แจ้งหาย/แจ้งพบ (+ รูปลับ) | `report3.js:138` | `p_report_type, p_user_id, p_item_name, p_category_id, p_description, p_image_url, p_incident_location, p_incident_datetime, p_secret_image` |
| 7 | `delete_report` | ยกเลิกโพสต์ของตนเอง (Soft delete) | `detail.js` | `p_report_id, p_user_id` |
| 8 | `staff_create_item` | เจ้าหน้าที่สร้างรายการของใหม่ | `staff-inventory-add.js:631` | `p_item` (obj 16 คีย์), `p_media` (arr), `p_staff_id, p_storage_id` |
| 9 | `staff_receive_item` | รับฝากเข้าจุดเก็บ + ตำแหน่งจริง | `staff-inventory-add.js:573` | `p_item_id, p_storage_room, p_shelf_id, p_bin_id, p_storage_location, p_storage_id, p_media, p_staff_id` |
| 10 | `get_staff_defect_note` | อ่านตำหนิลับ (ตรวจสิทธิ์ใน DB) | `detail.js`, `staff-post-detail.js` | `p_item_id, p_user_id` |
| 11 | `create_claim` | ยื่นคำร้องขอรับคืน | `claim.js:176` | `p_item_id, p_user_id, p_claimant_name, p_claimant_student_id, p_description, p_email, p_faculty, p_ownership_evidence, p_phone` |
| 12 | `staff_review_claim` | อนุมัติ/ปฏิเสธ/ขอข้อมูลเพิ่ม | `staff-verify-detail.js` | `p_claim_id, p_status, p_reviewer_note, p_reviewer_name, p_staff_id` |
| 13 | `record_handover` | บันทึกการส่งมอบคืน | `staff-handover.js:528` | `p_claim_id, p_note, p_proof_urls, p_signature_image_url, p_staff_id` |
| 14 | `staff_dispose_item` | จำหน่ายสิ่งของตกค้าง | `staff-dispose-item.js:311` | `p_item_id, p_dispose_type, p_note, p_staff_id` |
| 15 | `admin_upsert_storage_point` | เพิ่ม/แก้จุดรับฝาก | `admin-storage-points.js:205` | `p_admin_id, p_storage_id, p_storage_name, p_room, p_description` |
| 16 | `admin_delete_storage_point` | ปิดจุดรับฝาก | `admin-storage-points.js` | `p_admin_id, p_storage_id` |

RPC ทั้ง 16 ตัวข้างต้นคือชุดที่โค้ดเรียกจริงทั้งหมด — ไม่มี RPC ค้างจากเอกสารข้อกำหนดเหลืออีกแล้ว

### ข้อผิดพลาดที่โค้ดตรวจสอบ (ต้องคงไว้เมื่อเขียน RPC ใน `schema.sql`)

| รหัส | ความหมาย | ฝั่งที่ตรวจ |
|------|----------|------------|
| `EMAIL_ALREADY_EXISTS` | อีเมลซ้ำในระบบ | `register.js:121`, `profile.js:204` |
| `INVALID_EMAIL_DOMAIN` | โดเมนไม่ตรงเงื่อนไข (ดูหัวข้อ 4) | `register.js:124`, `profile.js:208` |
| `NOT_OWNER` | ไม่ใช่เจ้าของโพสต์ | `detail.js:414` (`delete_report`) |
| `EDIT_NOT_ALLOWED` | โพสต์แจ้งพบลบได้เฉพาะสถานะ `รอตรวจสอบ` | `detail.js:416` (`delete_report`) |
| `REPORT_NOT_FOUND` | ไม่พบโพสต์/ถูกลบแล้ว | `detail.js:418` (`delete_report`) |
| `LOST_POST_CANNOT_BE_STORED` | รับเข้าคลังได้เฉพาะโพสต์แจ้งพบ | `staff-inventory-add.js:656` |
| `NOT_A_FOUND_POST` | (เดียวกัน) โพสต์แจ้งหายรับเข้าคลังไม่ได้ | `staff-inventory-add.js:660` |
| `ITEM_NOT_PENDING` | ของไม่ได้อยู่ในสถานะรอรับเข้าคลัง | `staff-inventory-add.js:659` |
| `ITEM_NOT_FOUND` | ไม่พบสิ่งของ | `staff-inventory-add.js:658` |
| `STAFF_ONLY` | บทบาทไม่ใช่ staff/admin | `staff-inventory-add.js:657` |

---

## 6. Storage Buckets

| Bucket | ใช้กับ | Path ที่โค้ดสร้าง | หลักฐาน |
|--------|--------|------------------|---------|
| `item-media` | รูปสิ่งของ (เจ้าหน้าที่) | `${item_id}/${index}-${filename}` | `staff-inventory-add.js:23,474` |
| `claim-evidence` | หลักฐานคำร้อง | (อัปโหลดใน `claim.js`) | `claim.js:180-240` |
| `handover-evidence` | หลักฐานส่งมอบ + ลายเซ็น | `${claimId}/proof-${index}-${filename}`, `${claimId}/signature.png` | `staff-handover.js:15-18` |
| `avatars` | รูปโปรไฟล์ | `${userId}/avatar-${timestamp}.${ext}` | `staff-profile.js:14` |

หมายเหตุ: รูปจากผู้ใช้ทั่วไป (ฟอร์มแจ้งพบ/แจ้งหาย) ยังไม่ขึ้น bucket — เก็บเป็น base64 ในคอลัมน์ (ขัด KP-07/TS-04, DD-12)

---

## 7. View / Function / Trigger / RLS — สถานะปัจจุบัน

| รายการ | สถานะในระบบจริง | หลักฐาน / หมายเหตุ |
|--------|-----------------|---------------------|
| **View** | ไม่มี | ไม่พบ `.from('v_...')` หรือชื่อ view ใด ๆ |
| **Trigger** | ไม่มี | ไม่พบหลักฐาน — `item_history_log` ควรเขียนโดย trigger/RPC แต่ยังไม่มี (KP-08) |
| **Function** | มีเฉพาะ 16 RPC หัวข้อ 5 | `profile.js:142` ยืนยันว่า `update_user_profile` เป็น `SECURITY DEFINER` |
| **RLS** | เปิดใช้งาน | `claim.js:175` "anon เขียนตารางตรงไม่ได้ เพราะเปิด RLS" · `profile.js:141` `user_account` มีแค่ policy อ่าน · `staff-dispose-item.js:310` "anon ไม่มีสิทธิ์เขียนตารางโดยตรง" |
| **สิทธิ์หน้าเว็บ** | ฝั่ง client | `requireStaff` (`staff-auth.js`) + `localStorage` — ยังไม่ผูกกับ RLS ระดับแถว (ต้องยืนยันใน `schema.sql`) |

**สิ่งที่ยังขาดใน `schema.sql`** (ตอนนี้มีเฉพาะ `CREATE TABLE` ครบ 14 ตาราง — ยังเป็นข้อเสนอ ไม่ใช่ข้อเท็จจริง):
1. Trigger/RPC เขียน `item_history_log` ทุกครั้งที่ `item.status` เปลี่ยน (KP-08, BR-09)
2. View หรือ RPC สถิติแดชบอร์ด (F-10: อัตราคืนสำเร็จ, จุดเสี่ยง, หมวดหมู่หายบ่อย)
3. การแจ้งเตือนอัตโนมัติเมื่อเกิน 90 วัน → เขียน `notification` (BR-08, F-05)
4. Index สำหรับ `item.status`, `item.current_storage_id`, `claim.item_id`, `report.user_id`
5. นโยบาย RLS รายตารางให้ตรงพฤติกรรมที่โค้ดคาดหวัง (หัวข้อ 7.4 ของ requirements)

---

## 8. ความขัดแย้งที่ต้องยืนยันกับฐานข้อมูลจริง

| # | หัวข้อ | requirements 7.2 / เอกสาร | โค้ดใช้จริง | ต้องยืนยันว่า |
|---|--------|--------------------------|------------|--------------|
| 1 | คอลัมน์สถานะคำร้อง | `status` | `activity.js:151` อ่าน `claim_status` | มีคอลัมน์ไหนจริง (โค้ดสองไฟล์ขัดกัน) |
| 2 | `claim_proof` | `title` | `name` (`staff-verify-detail.js:89`) | ชื่อคอลัมน์จริง |
| 3 | `storage_point` | `storage_room`, `storage_location` | `room`, `description` (`admin-storage-points.js:130`) | ชื่อคอลัมน์จริง + มี `is_active` ไหม |
| 4 | `item_media` | `image_url` | `url` (`staff-post-detail.js:193`) | ชื่อคอลัมน์จริง |
| 5 | สถานะสิ่งของ | `แจ้งพบ`, `แจ้งหาย` | `รอตรวจสอบ`, `อยู่ที่จุดรับฝาก` … (หัวข้อ 4) | ค่าใน enum จริง |
| 6 | `item.item_id` | ไม่ระบุชนิด | text รูปแบบ `ITM-2026-0001` | เป็น `text` ไม่ใช่ uuid |
| 7 | `item.category` ทั้ง `category`/`category_key` | มีแค่ `category_id` | ทั้งสามคอลัมน์ถูกส่ง/อ่าน | ซ้ำซ้อนหรือคนละหน้าที่ |
| 8 | `report.description` / `report.image_url` | มีใน `report` | หน้าเว็บอ่านจาก `item` เสมอ | `p_description`/`p_image_url` ลงตารางไหน |
| 9 | `item.disposed_at` | ไม่มี | อ่านจริง (`staff-overdue-list.js:127`) | มีคอลัมน์นี้ใน `item` |
| 10 | `user_account.password` | มีคอลัมน์ | ส่งเข้า `verify_login`/`register_user` | เก็บแบบ hash หรือไม่ |
| 11 | `item_secret` กับ `p_secret_image` | เก็บตำหนิลับ | `report3.js:147` ส่งรูปลับไปกับ `create_report` | รูปลับลง `item_secret` จริงหรือไม่ |
| 12 | `claim.user_id` | ไม่อยู่ในรายการ | `activity.js:159` ใช้จริง | คอลัมน์มีจริง (ใช้บังคับ BR-04 ด้วย) |

---

## 9. ตารางที่ยังไม่มีโค้ดเรียกใช้ (ต้องวางแผนพัฒนา)

| ตาราง | สถานะ | สิ่งที่ขาด | อ้างอิง |
|-------|-------|-----------|---------|
| `notification` | ไม่มีการอ่าน/เขียนเลย | หน้าจอแจ้งเตือน + การเขียนเมื่อจับคู่/เกิน 90 วัน | F-05, TS-06, BR-08 |
| `item_history_log` | ไม่มีการอ่าน/เขียนเลย | Trigger/RPC เขียนอัตโนมัติทุกครั้งที่สถานะเปลี่ยน | KP-08, BR-09 |
| `disposal` | เขียนผ่าน RPC เท่านั้น ไม่มีหน้าอ่านโดยตรง | รายงานประวัติการจำหน่าย (หน้าเว็บนับจาก `item.disposed_at` แทน) | F-09 |
