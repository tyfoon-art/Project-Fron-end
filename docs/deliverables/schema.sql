-- ============================================================-- schema.sql  (MySQL 8 / InnoDB)
-- Lost & Found system - generated from the schema diagram
-- NOTE: data types / lengths / ON DELETE rules are assumptions
--       (the diagram shows only column names, PKs and FKs).
-- NOTE (อัปเดต 2026-10-12): ชนิด id ปรับตามโค้ดที่รันจริง —
--       item.item_id / claim.claim_id เป็นข้อความรหัสอ่านง่าย (VARCHAR(20))
--       user_account.user_id / category.category_id / storage_point.storage_id
--       เป็น uuid (CHAR(36)) ดู DATA_DICTIONARY หัวข้อ 8
-- ============================================================


SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS item_history_log;
DROP TABLE IF EXISTS disposal;
DROP TABLE IF EXISTS handover;
DROP TABLE IF EXISTS claim_activity_log;
DROP TABLE IF EXISTS claim_proof;
DROP TABLE IF EXISTS claim;
DROP TABLE IF EXISTS report;
DROP TABLE IF EXISTS item_secret;
DROP TABLE IF EXISTS item_media;
DROP TABLE IF EXISTS item;
DROP TABLE IF EXISTS storage_point;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS user_account;


SET FOREIGN_KEY_CHECKS = 1;


-- ------------------------------------------------------------
-- user_account
-- ------------------------------------------------------------
CREATE TABLE user_account (
    user_id        CHAR(36)      NOT NULL,
    email          VARCHAR(255)  NOT NULL,
    password_hash  VARCHAR(255)  NOT NULL,
    full_name      VARCHAR(150)  NOT NULL,
    phone_number   VARCHAR(20)   NULL,
    role           VARCHAR(30)   NOT NULL DEFAULT 'user',
    avatar_url     VARCHAR(500)  NULL,
    is_active      TINYINT(1)    NOT NULL DEFAULT 1,
    deleted_at     DATETIME      NULL,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- category
-- ------------------------------------------------------------
CREATE TABLE category (
    category_id    CHAR(36)      NOT NULL,
    category_name  VARCHAR(100)  NOT NULL,
    category_key   VARCHAR(50)   NOT NULL,
    is_active      TINYINT(1)    NOT NULL DEFAULT 1,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category_id),
    UNIQUE KEY uq_category_key (category_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- storage_point
-- ------------------------------------------------------------
CREATE TABLE storage_point (
    storage_id     CHAR(36)      NOT NULL,
    storage_name   VARCHAR(100)  NOT NULL,
    room           VARCHAR(100)  NULL,
    description    TEXT          NULL,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (storage_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- item
-- ------------------------------------------------------------
CREATE TABLE item (
    item_id             VARCHAR(20)   NOT NULL,
    reference_id        VARCHAR(50)   NULL,
    item_name           VARCHAR(200)  NOT NULL,
    description         TEXT          NULL,
    category_id         CHAR(36)      NULL,
    category            VARCHAR(100)  NULL,
    category_key        VARCHAR(50)   NULL,
    sub_category        VARCHAR(100)  NULL,
    location_zone       VARCHAR(100)  NULL,
    location_detail     VARCHAR(255)  NULL,
    location_landmark   VARCHAR(255)  NULL,
    found_location      VARCHAR(255)  NULL,
    found_date_time     DATETIME      NULL,
    current_storage_id  CHAR(36)      NULL,
    storage_location    VARCHAR(255)  NULL,
    storage_room        VARCHAR(100)  NULL,
    shelf_id            VARCHAR(50)   NULL,
    bin_id              VARCHAR(50)   NULL,
    status              VARCHAR(30)   NOT NULL DEFAULT 'รอตรวจสอบ',
    recorded_by         CHAR(36)      NULL,
    disposed_at         DATETIME      NULL,
    image_url           VARCHAR(500)  NULL,
    matched_item_id     VARCHAR(20)   NULL,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME      NULL,
    PRIMARY KEY (item_id),
    UNIQUE KEY uq_item_reference (reference_id),
    KEY idx_item_category (category_id),
    KEY idx_item_storage (current_storage_id),
    KEY idx_item_recorded_by (recorded_by),
    KEY idx_item_matched (matched_item_id),
    KEY idx_item_status (status),
    CONSTRAINT fk_item_category
        FOREIGN KEY (category_id) REFERENCES category (category_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_item_storage
        FOREIGN KEY (current_storage_id) REFERENCES storage_point (storage_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_item_recorded_by
        FOREIGN KEY (recorded_by) REFERENCES user_account (user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_item_matched
        FOREIGN KEY (matched_item_id) REFERENCES item (item_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- item_media
-- ------------------------------------------------------------
CREATE TABLE item_media (
    media_id    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    item_id     VARCHAR(20)   NOT NULL,
    name        VARCHAR(255)  NULL,
    url         VARCHAR(500)  NOT NULL,
    type        VARCHAR(50)   NULL,
    size        INT UNSIGNED  NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (media_id),
    KEY idx_media_item (item_id),
    CONSTRAINT fk_media_item
        FOREIGN KEY (item_id) REFERENCES item (item_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- item_secret  (1:1 with item)
-- ------------------------------------------------------------
CREATE TABLE item_secret (
    item_id      VARCHAR(20)   NOT NULL,
    defect_note  TEXT          NULL,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (item_id),
    CONSTRAINT fk_secret_item
        FOREIGN KEY (item_id) REFERENCES item (item_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- report
-- ------------------------------------------------------------
CREATE TABLE report (
    report_id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    item_id            VARCHAR(20)   NULL,
    user_id            CHAR(36)      NULL,
    report_type        VARCHAR(30)   NOT NULL,
    incident_location  VARCHAR(255)  NULL,
    incident_datetime  DATETIME      NULL,
    created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (report_id),
    KEY idx_report_item (item_id),
    KEY idx_report_user (user_id),
    CONSTRAINT fk_report_item
        FOREIGN KEY (item_id) REFERENCES item (item_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_report_user
        FOREIGN KEY (user_id) REFERENCES user_account (user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- claim
-- ------------------------------------------------------------
CREATE TABLE claim (
    claim_id             VARCHAR(20)   NOT NULL,
    item_id              VARCHAR(20)   NOT NULL,
    user_id              CHAR(36)      NULL,
    claimant_name        VARCHAR(150)  NOT NULL,
    claimant_student_id  VARCHAR(20)   NULL,
    faculty              VARCHAR(150)  NULL,
    phone                VARCHAR(20)   NULL,
    email                VARCHAR(255)  NULL,
    description          TEXT          NULL,
    ownership_evidence   TEXT          NULL,
    note                 TEXT          NULL,
    status               VARCHAR(30)   NOT NULL DEFAULT 'pending',
    claim_status         VARCHAR(30)   NOT NULL DEFAULT 'pending',
    reviewer_name        VARCHAR(150)  NULL,
    reviewer_note        TEXT          NULL,
    approved_at          DATETIME      NULL,
    created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (claim_id),
    KEY idx_claim_item (item_id),
    KEY idx_claim_user (user_id),
    KEY idx_claim_status (claim_status),
    CONSTRAINT fk_claim_item
        FOREIGN KEY (item_id) REFERENCES item (item_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_claim_user
        FOREIGN KEY (user_id) REFERENCES user_account (user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- claim_proof
-- ------------------------------------------------------------
CREATE TABLE claim_proof (
    proof_id    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    claim_id    VARCHAR(20)   NOT NULL,
    name        VARCHAR(255)  NULL,
    url         VARCHAR(500)  NOT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (proof_id),
    KEY idx_proof_claim (claim_id),
    CONSTRAINT fk_proof_claim
        FOREIGN KEY (claim_id) REFERENCES claim (claim_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- claim_activity_log
-- ------------------------------------------------------------
CREATE TABLE claim_activity_log (
    log_id      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    claim_id    VARCHAR(20)   NOT NULL,
    title       VARCHAR(255)  NOT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (log_id),
    KEY idx_cal_claim (claim_id),
    CONSTRAINT fk_cal_claim
        FOREIGN KEY (claim_id) REFERENCES claim (claim_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- handover
-- ------------------------------------------------------------
CREATE TABLE handover (
    handover_id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    item_id             VARCHAR(20)   NOT NULL,
    claim_id            VARCHAR(20)   NULL,
    staff_id            CHAR(36)      NULL,
    recipient_name      VARCHAR(150)  NOT NULL,
    handover_date       DATETIME      NOT NULL,
    staff_name          VARCHAR(150)  NULL,
    proof_image_url     VARCHAR(500)  NULL,
    proof_urls          TEXT          NULL,
    signature_image_url VARCHAR(500)  NULL,
    proof_file_count    INT UNSIGNED  NOT NULL DEFAULT 0,
    note                TEXT          NULL,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (handover_id),
    KEY idx_handover_item (item_id),
    KEY idx_handover_claim (claim_id),
    KEY idx_handover_staff (staff_id),
    CONSTRAINT fk_handover_item
        FOREIGN KEY (item_id) REFERENCES item (item_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_handover_claim
        FOREIGN KEY (claim_id) REFERENCES claim (claim_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_handover_staff
        FOREIGN KEY (staff_id) REFERENCES user_account (user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- disposal
-- ------------------------------------------------------------
CREATE TABLE disposal (
    disposal_id   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    item_id       VARCHAR(20)   NOT NULL,
    staff_id      CHAR(36)      NULL,
    dispose_type  VARCHAR(50)   NOT NULL,
    disposed_at   DATETIME      NOT NULL,
    note          TEXT          NULL,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (disposal_id),
    KEY idx_disposal_item (item_id),
    KEY idx_disposal_staff (staff_id),
    CONSTRAINT fk_disposal_item
        FOREIGN KEY (item_id) REFERENCES item (item_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_disposal_staff
        FOREIGN KEY (staff_id) REFERENCES user_account (user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- item_history_log
-- ------------------------------------------------------------
CREATE TABLE item_history_log (
    log_id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    item_id           VARCHAR(20)   NOT NULL,
    user_id           CHAR(36)      NULL,
    storage_point_id  CHAR(36)      NULL,
    claim_id          VARCHAR(20)   NULL,
    action_type       VARCHAR(50)   NOT NULL,
    description       TEXT          NULL,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (log_id),
    KEY idx_ihl_item (item_id),
    KEY idx_ihl_user (user_id),
    KEY idx_ihl_storage (storage_point_id),
    KEY idx_ihl_claim (claim_id),
    CONSTRAINT fk_ihl_item
        FOREIGN KEY (item_id) REFERENCES item (item_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ihl_user
        FOREIGN KEY (user_id) REFERENCES user_account (user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ihl_storage
        FOREIGN KEY (storage_point_id) REFERENCES storage_point (storage_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ihl_claim
        FOREIGN KEY (claim_id) REFERENCES claim (claim_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- notification
-- ------------------------------------------------------------
CREATE TABLE notification (
    notification_id    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id            CHAR(36)      NOT NULL,
    item_id            VARCHAR(20)   NULL,
    claim_id           VARCHAR(20)   NULL,
    notification_type  VARCHAR(50)   NOT NULL,
    message            TEXT          NOT NULL,
    is_read            TINYINT(1)    NOT NULL DEFAULT 0,
    created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id),
    KEY idx_notif_user (user_id, is_read),
    KEY idx_notif_item (item_id),
    KEY idx_notif_claim (claim_id),
    CONSTRAINT fk_notif_user
        FOREIGN KEY (user_id) REFERENCES user_account (user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_notif_item
        FOREIGN KEY (item_id) REFERENCES item (item_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_notif_claim
        FOREIGN KEY (claim_id) REFERENCES claim (claim_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- ภาคผนวก: PostgreSQL / Supabase (ของจริง)
-- ============================================================
-- DDL ด้านบนเป็น MySQL 8 (ร่าง/ข้อสันนิษฐาน)
-- ส่วนนี้เป็นนิยามจริงบน PostgreSQL ที่ตรวจยืนยันกับฐานข้อมูลจริง (Supabase)
--   - Function: สกัดจาก pg_get_functiondef
--   - Trigger : สร้างจากรายการที่ตรวจพบใน pg_trigger (CREATE TRIGGER เป็นการประกอบกลับ)
-- ============================================================

-- ---------- Functions ----------

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.item_sync_category()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_cat public.category%rowtype;
begin
  if new.category_id is not null
     and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id) then
    select * into v_cat from public.category c where c.category_id = new.category_id;
    if found then
      if tg_op = 'UPDATE' or nullif(btrim(new.category), '') is null then
        new.category := v_cat.category_name;
      end if;
      if tg_op = 'UPDATE' or nullif(btrim(new.category_key), '') is null then
        new.category_key := v_cat.category_key;
      end if;
    end if;
  elsif new.category_id is null then
    select c.category_id into new.category_id
      from public.category c
     where (nullif(btrim(new.category_key), '') is not null and c.category_key = new.category_key)
        or (nullif(btrim(new.category), '') is not null and c.category_name = new.category)
     order by (c.category_key = new.category_key) desc nulls last
     limit 1;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_sync_item_claim_status(p_item_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.item it
     set status = case
                    when exists (
                      select 1 from public.claim cl
                       where cl.item_id = it.item_id
                         and cl.status in ('pending', 'approved', 'more_info')
                    ) then 'กำลังดำเนินการเคลม'
                    else 'อยู่ที่จุดรับฝาก'
                  end
   where it.item_id = p_item_id
     and it.status in ('อยู่ที่จุดรับฝาก', 'กำลังดำเนินการเคลม');
end;
$function$;

-- ---------- Triggers (5 trigger บน 4 ตาราง) ----------

DROP TRIGGER IF EXISTS trg_user_account_updated_at ON public.user_account;
CREATE TRIGGER trg_user_account_updated_at
    BEFORE UPDATE ON public.user_account
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_item_updated_at ON public.item;
CREATE TRIGGER trg_item_updated_at
    BEFORE UPDATE ON public.item
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_item_sync_category ON public.item;
CREATE TRIGGER trg_item_sync_category
    BEFORE INSERT OR UPDATE ON public.item
    FOR EACH ROW EXECUTE FUNCTION public.item_sync_category();

DROP TRIGGER IF EXISTS trg_report_updated_at ON public.report;
CREATE TRIGGER trg_report_updated_at
    BEFORE UPDATE ON public.report
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_claim_updated_at ON public.claim;
CREATE TRIGGER trg_claim_updated_at
    BEFORE UPDATE ON public.claim
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
