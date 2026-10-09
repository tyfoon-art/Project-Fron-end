-- ============================================================-- schema.sql  (MySQL 8 / InnoDB)
-- Lost & Found system - generated from the schema diagram
-- NOTE: data types / lengths / ON DELETE rules are assumptions
--       (the diagram shows only column names, PKs and FKs).
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
    user_id        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
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
    category_id    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
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
    storage_id     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
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
    item_id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    reference_id        VARCHAR(50)   NULL,
    item_name           VARCHAR(200)  NOT NULL,
    description         TEXT          NULL,
    category_id         INT UNSIGNED  NULL,
    category            VARCHAR(100)  NULL,
    category_key        VARCHAR(50)   NULL,
    sub_category        VARCHAR(100)  NULL,
    location_zone       VARCHAR(100)  NULL,
    location_detail     VARCHAR(255)  NULL,
    location_landmark   VARCHAR(255)  NULL,
    found_location      VARCHAR(255)  NULL,
    found_date_time     DATETIME      NULL,
    current_storage_id  INT UNSIGNED  NULL,
    storage_location    VARCHAR(255)  NULL,
    storage_room        VARCHAR(100)  NULL,
    shelf_id            VARCHAR(50)   NULL,
    bin_id              VARCHAR(50)   NULL,
    status              VARCHAR(30)   NOT NULL DEFAULT 'found',
    recorded_by         INT UNSIGNED  NULL,
    disposed_at         DATETIME      NULL,
    image_url           VARCHAR(500)  NULL,
    matched_item_id     INT UNSIGNED  NULL,
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
    item_id     INT UNSIGNED  NOT NULL,
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
    item_id      INT UNSIGNED  NOT NULL,
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
    item_id            INT UNSIGNED  NULL,
    user_id            INT UNSIGNED  NULL,
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
    claim_id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    item_id              INT UNSIGNED  NOT NULL,
    user_id              INT UNSIGNED  NULL,
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
    claim_id    INT UNSIGNED  NOT NULL,
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
    claim_id    INT UNSIGNED  NOT NULL,
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
    item_id             INT UNSIGNED  NOT NULL,
    claim_id            INT UNSIGNED  NULL,
    staff_id            INT UNSIGNED  NULL,
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
    item_id       INT UNSIGNED  NOT NULL,
    staff_id      INT UNSIGNED  NULL,
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
    item_id           INT UNSIGNED  NOT NULL,
    user_id           INT UNSIGNED  NULL,
    storage_point_id  INT UNSIGNED  NULL,
    claim_id          INT UNSIGNED  NULL,
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
    user_id            INT UNSIGNED  NOT NULL,
    item_id            INT UNSIGNED  NULL,
    claim_id           INT UNSIGNED  NULL,
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