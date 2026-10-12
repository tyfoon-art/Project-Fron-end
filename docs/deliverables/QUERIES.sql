-- ============================================================
-- QUERIES.sql  (MySQL 8 / InnoDB)
-- Lost & Found system - ตัวอย่างคำสั่ง SQL ของการทำงาน Q-A ถึง Q-M
-- รันคู่กับ schema.sql (DDL 14 ตาราง) ใน docs/deliverables/
-- ------------------------------------------------------------
-- หมายเหตุ
--  1) คิวรีนี้คือคำสั่งที่อยู่เบื้องหลัง operation ตาม requirements ข้อ 7
--     (Q-A ถึง Q-M) โดยใช้ชื่อตาราง/คอลัมน์ตรงกับ schema.sql
--  2) ในระบบจริง (Supabase/PostgreSQL) การเขียนข้อมูลจะกระทำผ่าน RPC
--     เท่านั้น (ดู DATA_DICTIONARY.md หัวข้อ 5) ส่วน SELECT นี้คือรูปแบบเดียว
--     กับที่หน้าเว็บเรียกผ่าน ORM
--  3) ค่าสถานะ item.status ที่ใช้กรองอ้างจากโค้ดจริงใน src/js (ภาษาไทย)
--       (ค่าเริ่มต้น 'รอตรวจสอบ' ตรงกับ DEFAULT ใน schema.sql)
--  4) ชนิด id ตาม schema.sql ที่ปรับให้ตรงโค้ด:
--       item.item_id / claim.claim_id = ข้อความรหัสอ่านง่าย (VARCHAR(20))
--         เช่น 'ITM-2026-0001', 'CLM-24-0891' (ไม่ใช่ AUTO_INCREMENT)
--       user_id / category_id / storage_id = uuid (CHAR(36))
--     ตัวอย่างด้านล่างใช้ค่าสมมติให้อ่านง่าย
-- ============================================================


-- ============================================================
-- Q-A : สมัครสมาชิก เข้าสู่ระบบ และแก้ไขโปรไฟล์   (user_account)
--       ผู้เรียกใช้: ทุกกลุ่ม
-- ============================================================

-- สมัครสมาชิก (เบอร์โทร 10 หลัก ขึ้นต้นด้วย 0 ตาม validators.js:14 — ห้ามมีขีด)
INSERT INTO user_account (email, password_hash, full_name, phone_number, role)
VALUES ('student@up.ac.th', '<hash>', 'ธนกร ใจดี', '0812345678', 'user');

-- เข้าสู่ระบบ (ค้นหาด้วยอีเมล เพื่อตรวจรหัสผ่าน)
SELECT user_id, email, password_hash, full_name, role, avatar_url, is_active
FROM user_account
WHERE email = 'student@up.ac.th'
  AND deleted_at IS NULL;

-- แก้ไขโปรไฟล์
UPDATE user_account
SET full_name    = 'ธนกร ใจดี (แก้ไข)',
    phone_number = '0823456789',
    avatar_url   = 'https://BUCKET/avatars/u5.png',
    updated_at   = NOW()
WHERE user_id = '11111111-1111-1111-1111-111111111111';


-- ============================================================
-- Q-B : บันทึกประกาศแจ้งของหาย / แจ้งพบของ และถอนโพสต์
--       ตาราง: report, item, item_media   | ผู้เรียกใช้: ผู้ใช้ทั่วไป
-- ============================================================

-- บันทึกประกาศ: สร้าง item เป็นของชิ้นนั้นก่อน (item_id เป็นรหัสอ่านง่ายกำหนดเอง)
INSERT INTO item (item_id, reference_id, item_name, description, category_id, category,
                  found_location, found_date_time, status)
VALUES ('ITM-2026-0001', 'REF-2026-0001', 'เป้สะพายสีดำ', 'เป้ใบเล็กมีกระเป๋าหน้า',
        '22222222-2222-2222-2222-222222222222', 'กระเป๋า',
        'อาคารเรียนรวม ชั้น 1', '2026-10-08 14:30:00', 'รอตรวจสอบ');

-- นำ item_id มาใช้กับ report (เหตุการณ์ที่ผู้ใช้แจ้ง)
SET @new_item_id = 'ITM-2026-0001';

INSERT INTO report (item_id, user_id, report_type, incident_location, incident_datetime)
VALUES (@new_item_id, '11111111-1111-1111-1111-111111111111', 'lost',
        'อาคารเรียนรวม ชั้น 1', '2026-10-08 14:30:00');

-- รูป/ไฟล์ประกอบประกาศ (0..N ไฟล์)
INSERT INTO item_media (item_id, name, url, type)
VALUES (@new_item_id, 'รูปเป้ 1', 'https://BUCKET/item-media/itm1_1.jpg', 'image');

-- ถอนโพสต์ (soft delete เพื่อเก็บประวัติ)
UPDATE item
SET deleted_at = NOW()
WHERE item_id = @new_item_id;


-- ============================================================
-- Q-C : แสดงกระดานรายการ ค้นหา และคัดกรอง
--       ตาราง: item, category, storage_point   | ผู้เรียกใช้: ทุกกลุ่ม
-- ============================================================

-- กระดานรายการ (ตรงกับ browse.js:81-90 - กรองสถานะที่คืน/ทำลายทิ้งออก)
SELECT i.item_id, i.item_name, i.description, i.image_url, i.status, i.created_at,
       c.category_name,
       s.storage_name, s.room,
       r.report_type, r.incident_location, r.incident_datetime,
       u.full_name AS poster_name
FROM item i
LEFT JOIN category     c ON c.category_id       = i.category_id
LEFT JOIN storage_point s ON s.storage_id       = i.current_storage_id
LEFT JOIN report       r ON r.item_id           = i.item_id
LEFT JOIN user_account u ON u.user_id           = r.user_id
WHERE i.deleted_at IS NULL
  AND i.status NOT IN ('คืนสำเร็จ', 'หมดอายุ/ทำลายทิ้ง');

-- ค้นหาด้วยคำสำคัญ (ค้นจากชื่อและคำอธิบาย)
SELECT i.item_id, i.item_name, i.image_url, i.status
FROM item i
WHERE i.deleted_at IS NULL
  AND (i.item_name   LIKE CONCAT('%', 'เป้', '%')
    OR i.description LIKE CONCAT('%', 'เป้', '%'))
ORDER BY i.created_at DESC;

-- คัดกรองตามหมวดหมู่
SELECT i.item_id, i.item_name, c.category_name
FROM item i
LEFT JOIN category c ON c.category_id = i.category_id
WHERE i.deleted_at IS NULL
  AND c.category_id = '22222222-2222-2222-2222-222222222222';


-- ============================================================
-- Q-D : แสดงรายละเอียดสิ่งของ
--       ตาราง: item, report, category, storage_point, user_account
--       ผู้เรียกใช้: ทุกกลุ่ม
-- ============================================================

-- รายละเอียดชิ้นเดียว พร้อมข้อมูลที่เกี่ยวข้อง
SELECT i.*,
       c.category_name,
       s.storage_name, s.room,
       r.report_type, r.incident_location, r.incident_datetime,
       u.full_name AS recorder_name
FROM item i
LEFT JOIN category     c ON c.category_id       = i.category_id
LEFT JOIN storage_point s ON s.storage_id       = i.current_storage_id
LEFT JOIN report       r ON r.item_id           = i.item_id
LEFT JOIN user_account u ON u.user_id           = i.recorded_by
WHERE i.item_id = 'ITM-2026-0001'
  AND i.deleted_at IS NULL;

-- รูป/ไฟล์ทั้งหมดของชิ้นนี้
SELECT media_id, name, url, type
FROM item_media
WHERE item_id = 'ITM-2026-0001';

-- ข้อมูลลับ (ตำหนิสังเกต) - เฉพาะเจ้าหน้าที่/บุคคลที่ได้รับสิทธิ์เท่านั้น
SELECT defect_note
FROM item_secret
WHERE item_id = 'ITM-2026-0001';

-- สิ่งของที่จับคู่แล้ว (self FK matched_item_id)
SELECT matched_item_id
FROM item
WHERE item_id = 'ITM-2026-0001'
  AND matched_item_id IS NOT NULL;


-- ============================================================
-- Q-E : แสดงรายการที่ฉันแจ้ง และคำร้องขอคืนของฉัน
--       ตาราง: report, claim, item   | ผู้เรียกใช้: ผู้ใช้ทั่วไป
-- ============================================================

-- รายการประกาศที่ฉันแจ้ง
SELECT r.report_id, i.item_name, r.report_type, r.created_at
FROM report r
JOIN item i ON i.item_id = r.item_id
WHERE r.user_id = '11111111-1111-1111-1111-111111111111'
ORDER BY r.created_at DESC;

-- คำร้องขอคืนของฉัน (ตรงกับ activity.js - ใช้คอลัมน์ claim_status)
SELECT c.claim_id, i.item_name, c.claim_status, c.created_at
FROM claim c
JOIN item i ON i.item_id = c.item_id
WHERE c.user_id = '11111111-1111-1111-1111-111111111111'
ORDER BY c.created_at DESC;


-- ============================================================
-- Q-F : ยื่นคำร้องขอรับคืน พร้อมหลักฐาน
--       ตาราง: claim, claim_proof, item   | ผู้เรียกใช้: ผู้ใช้ทั่วไป
-- ============================================================

-- ยื่นคำร้อง (claim_id เป็นรหัสอ่านง่ายกำหนดเอง)
INSERT INTO claim (claim_id, item_id, user_id, claimant_name, claimant_student_id, faculty,
                   phone, email, description, ownership_evidence, status, claim_status)
VALUES ('CLM-24-0891', 'ITM-2026-0001', '11111111-1111-1111-1111-111111111111',
        'ธนกร ใจดี', '6612345', 'วิทยาศาสตร์', '0812345678',
        'student@up.ac.th', 'เป้ของผมสะพายประจำวัน', 'มีรูปเป้และบัตรประจำตัว',
        'pending', 'pending');

SET @new_claim_id = 'CLM-24-0891';

-- แนบหลักฐาน (0..N ไฟล์)
INSERT INTO claim_proof (claim_id, name, url)
VALUES (@new_claim_id, 'หลักฐาน 1 - รูปเป้', 'https://BUCKET/claim-evidence/clm01_1.jpg'),
       (@new_claim_id, 'หลักฐาน 2 - บัตร',   'https://BUCKET/claim-evidence/clm01_2.jpg');

-- ตรวจสอบข้อมูลสิ่งของที่ขอคืน (ให้ผู้ยื่นเขียนคำอธิบายประกอบ)
SELECT item_name, description, image_url
FROM item
WHERE item_id = 'ITM-2026-0001';


-- ============================================================
-- Q-G : บันทึกรับฝากเข้าคลัง และจัดการรายการคงคลัง
--       ตาราง: item, item_media, storage_point   | ผู้เรียกใช้: เจ้าหน้าที่
-- ============================================================

-- รับฝากเข้าคลัง: ตั้งตำแหน่งเก็บ + ผู้บันทึก + เปลี่ยนสถานะ
UPDATE item
SET status             = 'อยู่ที่จุดรับฝาก',
    current_storage_id = '33333333-3333-3333-3333-333333333333',
    recorded_by        = '44444444-4444-4444-4444-444444444444',
    updated_at         = NOW()
WHERE item_id = 'ITM-2026-0001';

-- [ตัวอย่างประกอบ] รายการคงคลังทั้งหมด พร้อมจุดเก็บ และเรียงตามเวลาโพสต์
-- หมายเหตุ: staff-inventory-add.js ไม่มี query เรียง created_at DESC ของจริง
--          (มีแค่ดึง item รายชิ้นตาม id และเรียง storage_name/category_name) — ตัวอย่างนี้เป็นภาพรวมเท่านั้น
SELECT i.item_id, i.reference_id, i.item_name, i.status,
       s.storage_name, s.room, i.created_at
FROM item i
LEFT JOIN storage_point s ON s.storage_id = i.current_storage_id
WHERE i.deleted_at IS NULL
ORDER BY i.created_at DESC;

-- หมวดหมู่ที่ใช้ได้ (สำหรับฟอร์มบันทึกของ)
SELECT category_id, category_name, category_key
FROM category
WHERE is_active = 1
ORDER BY category_name;


-- ============================================================
-- Q-H : ตรวจสอบและพิจารณาคำร้อง
--       ตาราง: claim, claim_activity_log, item   | ผู้เรียกใช้: เจ้าหน้าที่
-- ============================================================

-- รายการคำร้องที่รอการพิจารณา (คิวของเจ้าหน้าที่อ่านคอลัมน์ status — staff-verify-claims.js:83,88)
SELECT c.claim_id, i.item_name, c.claimant_name, c.status, c.created_at
FROM claim c
JOIN item i ON i.item_id = c.item_id
WHERE c.status IN ('pending', 'more_info')
ORDER BY c.created_at ASC;

-- หลักฐานทั้งหมดของคำร้องหนึ่ง ๆ
SELECT proof_id, name, url
FROM claim_proof
WHERE claim_id = 'CLM-24-0891';

-- บันทึกความเคลื่อนไหวของคำร้อง (ตอนตรวจสอบ / เปลี่ยนสถานะ)
INSERT INTO claim_activity_log (claim_id, title)
VALUES ('CLM-24-0891', 'เจ้าหน้าที่เริ่มตรวจสอบคำร้อง');

-- พิจารณาอนุมัติ
UPDATE claim
SET status        = 'approved',
    claim_status  = 'approved',
    reviewer_name = 'นส.เจ้าหน้าที่',
    reviewer_note = 'หลักฐานครบถ้วน',
    approved_at   = NOW()
WHERE claim_id = 'CLM-24-0891';


-- ============================================================
-- Q-I : บันทึกการส่งมอบคืนแก่เจ้าของ
--       ตาราง: claim, handover, item   | ผู้เรียกใช้: เจ้าหน้าที่
-- ============================================================

-- บันทึกการส่งมอบ (record_handover)
INSERT INTO handover (item_id, claim_id, staff_id, recipient_name, handover_date,
                      staff_name, proof_urls, note)
VALUES ('ITM-2026-0001', 'CLM-24-0891', '44444444-4444-4444-4444-444444444444',
        'ธนกร ใจดี', NOW(), 'นส.เจ้าหน้าที่',
        '["https://BUCKET/handover-evidence/ho01_a.jpg","https://BUCKET/handover-evidence/ho01_b.jpg"]',
        'ตรวจเอกสารและตัวตนผู้รับเรียบร้อย');

-- ปิดคำร้องและสถานะสิ่งของ
UPDATE claim
SET status       = 'completed',
    claim_status = 'completed'
WHERE claim_id = 'CLM-24-0891';

UPDATE item
SET status     = 'คืนสำเร็จ',
    updated_at = NOW()
WHERE item_id = 'ITM-2026-0001';


-- ============================================================
-- Q-J : จำหน่ายสิ่งของตกค้างเกินกำหนด
--       ตาราง: item, disposal   | ผู้เรียกใช้: เจ้าหน้าที่ / Admin
-- ============================================================

-- รายการที่เกินกำหนด (ยังอยู่จุดรับฝาก ไม่ถูกคืน) - สำเร็จเร็จรายการที่ค้างตามระยะเวลา
SELECT item_id, item_name, created_at, DATEDIFF(NOW(), created_at) AS days_in_storage
FROM item
WHERE status = 'อยู่ที่จุดรับฝาก'
  AND deleted_at IS NULL;

-- บันทึกการจำหน่าย (staff_dispose_item)
INSERT INTO disposal (item_id, staff_id, dispose_type, disposed_at, note)
VALUES ('ITM-2026-0010', '44444444-4444-4444-4444-444444444444', 'donate', NOW(),
        'ของค้างเก็บเกิน 90 วัน');

-- เปลี่ยนสถานะสิ่งของเป็นจำหน่ายแล้ว
UPDATE item
SET status     = 'หมดอายุ/ทำลายทิ้ง',
    disposed_at = NOW(),
    updated_at = NOW()
WHERE item_id = 'ITM-2026-0010';


-- ============================================================
-- Q-K : สรุปสถิติและรายงาน
--       ตาราง: item, handover, item_media   | ผู้เรียกใช้: Admin
-- ============================================================

-- จำนวนสิ่งของแบ่งตามสถานะ (การ์ดหน้า Dashboard)
SELECT status, COUNT(*) AS cnt
FROM item
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY cnt DESC;

-- จำนวนการส่งมอบรายเดือน
SELECT DATE_FORMAT(handover_date, '%Y-%m') AS month, COUNT(*) AS handover_count
FROM handover
GROUP BY month
ORDER BY month DESC;

-- จำนวนรูป/ไฟล์ต่อชิ้นของ
SELECT i.item_id, i.item_name, COUNT(m.media_id) AS media_count
FROM item i
LEFT JOIN item_media m ON m.item_id = i.item_id
WHERE i.deleted_at IS NULL
GROUP BY i.item_id, i.item_name
HAVING COUNT(m.media_id) > 0
ORDER BY media_count DESC;


-- ============================================================
-- Q-L : แจ้งเตือนอัตโนมัติ
--       ตาราง: notification   | ผู้เรียกใช้: ระบบอัตโนมัติ
-- ============================================================

-- สร้างการแจ้งเตือน (จุดสั่งงาน: จับคู่ได้ / อนุมัติคำร้อง / ฯลฯ)
INSERT INTO notification (user_id, item_id, claim_id, notification_type, message)
VALUES ('11111111-1111-1111-1111-111111111111', 'ITM-2026-0001', NULL, 'item_matched',
        'ระบบพบสิ่งของที่ตรงกับประกาศของคุณ: เป้สะพายสีดำ'),
       ('11111111-1111-1111-1111-111111111111', NULL, 'CLM-24-0891', 'claim_approved',
        'คำร้องขอคืนของคุณได้รับการอนุมัติ');

-- รายการแจ้งเตือนที่ยังไม่ได้อ่าน (ป้ายแจ้งเตือน)
SELECT notification_id, notification_type, message, created_at
FROM notification
WHERE user_id = '11111111-1111-1111-1111-111111111111'
  AND is_read = 0
ORDER BY created_at DESC;

-- ทำเครื่องหมายว่าอ่านแล้ว
UPDATE notification
SET is_read = 1
WHERE notification_id = 100;


-- ============================================================
-- Q-M : จับคู่ของหายกับของที่พบอัตโนมัติ
--       ตาราง: item, report   | ผู้เรียกใช้: ระบบอัตโนมัติ
--       สถานะ: ยังไม่ได้พัฒนา (มีเพียงคอลัมน์ matched_item_id ที่ยังไม่ถูกเขียนค่า)
-- ============================================================

-- หาคู่ที่เข้าข่าย (ชื่อ/หมวดหมู่ตรงกัน, ยังไม่ถูกจับคู่, ยังไม่คืน/จำหน่าย)
SELECT f.item_id      AS found_item_id,
       l.item_id      AS lost_item_id,
       COUNT(*)       AS match_score
FROM item f
JOIN item l ON f.item_id <> l.item_id
           AND f.category_id = l.category_id
           AND f.item_name   = l.item_name
           AND f.matched_item_id IS NULL
           AND l.matched_item_id IS NULL
WHERE f.status NOT IN ('คืนสำเร็จ', 'หมดอายุ/ทำลายทิ้ง')
  AND l.status NOT IN ('คืนสำเร็จ', 'หมดอายุ/ทำลายทิ้ง')
GROUP BY f.item_id, l.item_id;

-- เมื่อยืนยันคู่ที่ตรงกันแล้ว (ตัวอย่าง) เขียนไปที่ item ของของที่พบ
UPDATE item
SET matched_item_id = l.item_id
WHERE item_id = f.item_id;

-- ============================================================
-- สรุปคำร้องแบ่งตามสถานะ
-- หมายเหตุ: ไม่มีหน้า/RPC ใด GROUP BY สถานะคำร้องจริง — แดชบอร์ดเจ้าหน้าที่นับจากตาราง handover
--          ใช้คอลัมน์ status (คอลัมน์ที่หน้าเจ้าหน้าที่และสถิติผู้ใช้อ่าน); claim_status เป็นคอลัมน์คู่ขนาน
-- ============================================================
SELECT status, COUNT(*) AS cnt
FROM claim
GROUP BY status
ORDER BY cnt DESC;
