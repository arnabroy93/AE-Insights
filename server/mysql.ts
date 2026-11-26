import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import type { FilterParams, SchedulingAnalyticsData, SchedulingBatchItem } from './types.ts';

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
  connectionLimit?: number;
}

// Runtime database state
let activeEngine: 'sqlite' | 'mysql' =
  process.env.DB_TYPE === 'mysql' || (process.env.MYSQL_HOST && process.env.MYSQL_HOST !== 'localhost')
    ? 'mysql'
    : 'sqlite';
let mysqlPool: Pool | null = null;
let lastConnectionError: string | null = null;
let connectionFailed = false;
let lastConnectionFailureTime = 0;

let currentConfig: MysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'afae_aeinsight',
  ssl: process.env.MYSQL_SSL === 'true',
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT) || 10,
};

let mysqlDataVersion = 0;

export function getMysqlDataVersion(): number {
  return mysqlDataVersion;
}

export function bumpMysqlDataVersion(): void {
  mysqlDataVersion++;
}

export function getActiveEngine(): 'sqlite' | 'mysql' {
  return activeEngine;
}

export function setActiveEngine(engine: 'sqlite' | 'mysql') {
  activeEngine = engine;
  mysqlDataVersion++;
  if (engine === 'mysql') {
    connectionFailed = false;
    lastConnectionFailureTime = 0;
  }
}

export function getMysqlConfig(): Omit<MysqlConfig, 'password'> & { hasPassword: boolean } {
  return {
    host: currentConfig.host,
    port: currentConfig.port,
    user: currentConfig.user,
    database: currentConfig.database,
    ssl: currentConfig.ssl,
    connectionLimit: currentConfig.connectionLimit,
    hasPassword: Boolean(currentConfig.password && currentConfig.password.length > 0),
  };
}

export async function setMysqlConfig(newConfig: Partial<MysqlConfig>, switchEngine: boolean = true) {
  currentConfig = {
    ...currentConfig,
    ...newConfig,
    port: Number(newConfig.port) || currentConfig.port,
    connectionLimit: Number(newConfig.connectionLimit) || currentConfig.connectionLimit,
  };
  connectionFailed = false;
  lastConnectionFailureTime = 0;
  mysqlDataVersion++;

  // Close existing pool to force re-connection
  if (mysqlPool) {
    try {
      await mysqlPool.end();
    } catch (e) {
      // ignore
    }
    mysqlPool = null;
  }

  if (switchEngine) {
    activeEngine = 'mysql';
  }
}

export async function getMysqlPool(): Promise<Pool | null> {
  if (mysqlPool) return mysqlPool;
  if (activeEngine === 'sqlite') return null;
  if (connectionFailed && Date.now() - lastConnectionFailureTime < 10000) {
    return null;
  }

  try {
    const poolConfig: mysql.PoolOptions = {
      host: currentConfig.host,
      port: currentConfig.port,
      user: currentConfig.user,
      password: currentConfig.password,
      database: currentConfig.database,
      waitForConnections: true,
      connectionLimit: currentConfig.connectionLimit || 10,
      queueLimit: 0,
      connectTimeout: 15000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      dateStrings: ['DATE'],
      ssl: currentConfig.ssl ? { rejectUnauthorized: false } : undefined,
    };

    const pool = mysql.createPool(poolConfig);
    // Test handshake with 15s timeout for cross-region / remote MySQL
    const pingPromise = pool.query('SELECT 1 as ping');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('MySQL connection timeout (15000ms)')), 15000)
    );

    await Promise.race([pingPromise, timeoutPromise]);
    mysqlPool = pool;
    lastConnectionError = null;
    connectionFailed = false;
    lastConnectionFailureTime = 0;
    return mysqlPool;
  } catch (err: any) {
    lastConnectionError = err.message || String(err);
    connectionFailed = true;
    lastConnectionFailureTime = Date.now();
    return null;
  }
}

export async function testMysqlConnection(testConfig?: Partial<MysqlConfig>): Promise<{
  success: boolean;
  message: string;
  latencyMs: number;
  version?: string;
  database?: string;
  tables?: string[];
  hasAllTables?: boolean;
  error?: string;
}> {
  const cfg: MysqlConfig = {
    ...currentConfig,
    ...(testConfig || {}),
  };

  const startTime = Date.now();
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      port: Number(cfg.port) || 3306,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      connectTimeout: 6000,
      dateStrings: ['DATE'],
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
    });

    const [verResult]: any = await conn.query('SELECT VERSION() as version');
    const version = verResult?.[0]?.version || 'Unknown';

    // List tables
    const [tablesResult]: any = await conn.query('SHOW TABLES');
    const tables: string[] = tablesResult.map((r: any) => Object.values(r)[0]);
    const expected = ['uploads', 'raw_records', 'audit_logs', 'operational_settings', 'restore_points'];
    const hasAllTables = expected.every(t => tables.includes(t));

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      message: `Successfully connected to MySQL ${version} on ${cfg.host}:${cfg.port}`,
      latencyMs,
      version,
      database: cfg.database,
      tables,
      hasAllTables,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      message: `Connection failed: ${err.message || 'Unknown error'}`,
      latencyMs,
      error: err.code || err.message,
    };
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {
        // ignore
      }
    }
  }
}

const RAW_RECORD_DATE_COLUMNS = [
  'batch_start_date',
  'batch_initial_start_date',
  'batch_initial_end_date',
  'batch_end_date',
  'batch_actual_end_date',
  'exam_schedule_date',
  'joining_date',
] as const;

function sanitizeMysqlDateString(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (!str || str === '0000-00-00' || str.toLowerCase() === 'null' || str.toLowerCase() === 'n/a' || str === '-') {
    return null;
  }
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;
    let day = p1;
    let month = p2;
    if (p1 <= 12 && p2 > 12) {
      day = p2;
      month = p1;
    }
    if (y >= 1900 && y <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(y).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    if (y >= 1900 && y <= 2100) {
      return parsed.toISOString().split('T')[0];
    }
  }
  return null;
}

export async function initMysqlTables(pool?: Pool): Promise<{ success: boolean; createdTables: string[] }> {
  const targetPool = pool || (await getMysqlPool());
  if (!targetPool) {
    throw new Error('MySQL connection pool unavailable.');
  }

  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS uploads (
      id VARCHAR(255) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      sheet_name VARCHAR(255) NOT NULL,
      uploaded_by VARCHAR(255) NOT NULL,
      uploaded_at VARCHAR(100) NOT NULL,
      row_count INT NOT NULL DEFAULT 0,
      valid_row_count INT NOT NULL DEFAULT 0,
      invalid_row_count INT NOT NULL DEFAULT 0,
      duplicate_count INT NOT NULL DEFAULT 0,
      processing_status VARCHAR(50) NOT NULL DEFAULT 'completed',
      processing_duration_ms INT NOT NULL DEFAULT 0,
      source_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_uploads_uploaded_at (uploaded_at),
      INDEX idx_uploads_uploaded_by (uploaded_by),
      INDEX idx_uploads_status (processing_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS raw_records (
      id INT AUTO_INCREMENT NOT NULL,
      center_code VARCHAR(100) NULL,
      funder_name VARCHAR(255) NULL,
      program_name VARCHAR(255) NULL,
      assigned_trainers VARCHAR(255) NULL,
      assigned_ae VARCHAR(255) NULL,
      rm_sh_zh VARCHAR(255) NULL,
      batch_code VARCHAR(100) NULL,
      course_code VARCHAR(100) NULL,
      batch_start_date DATE NULL,
      batch_initial_start_date DATE NULL,
      batch_initial_end_date DATE NULL,
      batch_end_date DATE NULL,
      batch_actual_end_date DATE NULL,
      batch_status VARCHAR(100) NULL,
      batch_validation_status VARCHAR(100) NULL DEFAULT 'Not Yet Validated',
      student_code VARCHAR(100) NULL,
      enrollment_status VARCHAR(100) NULL,
      dropout_type VARCHAR(100) NULL,
      email_verification_status VARCHAR(50) NULL DEFAULT 'y',
      final_exam_marks DOUBLE NULL,
      placement_type VARCHAR(100) NULL,
      exam_schedule_date DATE NULL,
      ilt_completion DOUBLE NULL,
      ilt_as_on_joining_date DOUBLE NULL,
      fm_class_completion DOUBLE NULL,
      running_attendance DOUBLE NULL,
      beneficiary_class_attendance DOUBLE NULL,
      incomplete_attendance_exception TINYINT(1) NOT NULL DEFAULT 0,
      incomplete_module_exception TINYINT(1) NOT NULL DEFAULT 0,
      special_case VARCHAR(50) NULL,
      joining_date DATE NULL,
      validation_status VARCHAR(100) NULL DEFAULT 'Not Available',
      validation_done_by VARCHAR(255) NULL,
      upload_id VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_records_center_code (center_code),
      INDEX idx_records_batch_code (batch_code),
      INDEX idx_records_student_code (student_code),
      INDEX idx_records_student_batch (student_code, batch_code),
      INDEX idx_records_program_name (program_name(100)),
      INDEX idx_records_funder_name (funder_name(100)),
      INDEX idx_records_rm_sh_zh (rm_sh_zh(100)),
      INDEX idx_records_assigned_trainers (assigned_trainers(100)),
      INDEX idx_records_assigned_ae (assigned_ae(100)),
      INDEX idx_records_batch_status (batch_status),
      INDEX idx_records_enrollment_status (enrollment_status),
      INDEX idx_records_dropout_type (dropout_type),
      INDEX idx_records_validation_status (validation_status),
      INDEX idx_records_exceptions (incomplete_attendance_exception, incomplete_module_exception),
      INDEX idx_records_start_date (batch_start_date),
      INDEX idx_records_upload_id (upload_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(255) NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      user_role VARCHAR(100) NOT NULL,
      action VARCHAR(100) NOT NULL,
      timestamp VARCHAR(100) NOT NULL,
      upload_id VARCHAR(255) NULL,
      details TEXT NOT NULL,
      result VARCHAR(50) NOT NULL DEFAULT 'success',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_audit_timestamp (timestamp),
      INDEX idx_audit_user (user_email),
      INDEX idx_audit_action (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS operational_settings (
      id INT NOT NULL DEFAULT 1,
      attendance_threshold DOUBLE NOT NULL DEFAULT 0.75,
      completion_threshold DOUBLE NOT NULL DEFAULT 0.80,
      batch_delay_threshold_days INT NOT NULL DEFAULT 0,
      dropout_alert_threshold DOUBLE NOT NULL DEFAULT 0.15,
      enable_faculty_deployment_index TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `INSERT INTO operational_settings (id, attendance_threshold, completion_threshold, batch_delay_threshold_days, dropout_alert_threshold, enable_faculty_deployment_index)
     VALUES (1, 0.75, 0.80, 0, 0.15, 1)
     ON DUPLICATE KEY UPDATE id = id;`,

    `CREATE TABLE IF NOT EXISTS restore_points (
      id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      file_name VARCHAR(255) NOT NULL,
      created_at VARCHAR(100) NOT NULL,
      file_size BIGINT NOT NULL DEFAULT 0,
      file_size_formatted VARCHAR(50) NOT NULL,
      record_count INT NOT NULL DEFAULT 0,
      batch_count INT NOT NULL DEFAULT 0,
      upload_count INT NOT NULL DEFAULT 0,
      created_by VARCHAR(255) NOT NULL,
      is_baseline TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      INDEX idx_restore_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(100) NOT NULL,
      permissions TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS scheduled_vs_conducted (
      id INT AUTO_INCREMENT NOT NULL,
      slot_date VARCHAR(100) NULL,
      fm_email_id VARCHAR(255) NULL,
      batch_code VARCHAR(100) NULL,
      actual_center_code VARCHAR(100) NULL,
      program_name VARCHAR(255) NULL,
      gmeet_id VARCHAR(255) NULL,
      batch_status VARCHAR(100) NULL,
      actual_status VARCHAR(100) NULL,
      schedule_class_start_time VARCHAR(100) NULL,
      actual_class_started VARCHAR(100) NULL,
      schedule_class_end_time VARCHAR(100) NULL,
      actual_class_ended VARCHAR(100) NULL,
      class_link TEXT NULL,
      form_status VARCHAR(100) NULL,
      upload_id VARCHAR(255) NULL,
      uploaded_by VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_svc_slot_date (slot_date),
      INDEX idx_svc_fm_email (fm_email_id),
      INDEX idx_svc_batch_code (batch_code),
      INDEX idx_svc_actual_center (actual_center_code),
      INDEX idx_svc_program_name (program_name(100)),
      INDEX idx_svc_actual_status (actual_status),
      INDEX idx_svc_upload_id (upload_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS slot_replacement (
      id INT AUTO_INCREMENT NOT NULL,
      emp_code VARCHAR(100) NULL,
      trainer_name VARCHAR(255) NULL,
      batch_code VARCHAR(100) NULL,
      alias VARCHAR(255) NULL,
      actual_class_date VARCHAR(100) NULL,
      replacement_class_date VARCHAR(100) NULL,
      center_code VARCHAR(100) NULL,
      center_name VARCHAR(255) NULL,
      approved_rejected_by VARCHAR(255) NULL,
      approval_rejected_date VARCHAR(100) NULL,
      requested_date VARCHAR(100) NULL,
      request_status VARCHAR(100) NULL,
      reason TEXT NULL,
      upload_id VARCHAR(255) NULL,
      uploaded_by VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_sr_emp_code (emp_code),
      INDEX idx_sr_batch_code (batch_code),
      INDEX idx_sr_center_code (center_code),
      INDEX idx_sr_request_status (request_status),
      INDEX idx_sr_upload_id (upload_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS Exception_App_Rpt (
      id INT AUTO_INCREMENT NOT NULL,
      date VARCHAR(100) NULL,
      batch_code VARCHAR(100) NULL,
      student_code VARCHAR(100) NULL,
      student_name VARCHAR(255) NULL,
      center_code VARCHAR(100) NULL,
      center_name VARCHAR(255) NULL,
      reason TEXT NULL,
      remarks TEXT NULL,
      status VARCHAR(100) NULL,
      created_by VARCHAR(255) NULL,
      created_by_email VARCHAR(255) NULL,
      cm_name VARCHAR(255) NULL,
      cm_email VARCHAR(255) NULL,
      approval_remarks TEXT NULL,
      approved_by VARCHAR(255) NULL,
      approved_by_email VARCHAR(255) NULL,
      approved_date VARCHAR(100) NULL,
      exception_remove_status VARCHAR(100) NULL,
      exception_remove_date VARCHAR(100) NULL,
      PRIMARY KEY (id),
      INDEX idx_ex_student (student_code),
      INDEX idx_ex_batch (batch_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS challenges (
      Sl_no INT NULL,
      rm_name LONGTEXT NULL,
      challenge LONGTEXT NULL,
      impact LONGTEXT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  for (const stmt of schemaStatements) {
    await targetPool.query(stmt);
  }

  try {
    await targetPool.query(`ALTER TABLE raw_records MODIFY special_case VARCHAR(50) NULL;`);
  } catch (e) {
    // Ignore if table/column does not exist or already compatible
  }

  try {
    await targetPool.query(`ALTER TABLE raw_records ADD COLUMN joining_date DATE NULL AFTER special_case;`);
  } catch (e) {
    // Ignore if column already exists
  }

  try {
    await targetPool.query(`ALTER TABLE raw_records ADD COLUMN ilt_as_on_joining_date DOUBLE NULL AFTER ilt_completion;`);
  } catch (e) {
    // Ignore if column already exists
  }

  // Migrate any non-DATE date columns in raw_records to DATE NULL datatype
  try {
    const [colRows]: any = await targetPool.query(
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raw_records'`
    );
    const colTypes = new Map<string, string>(
      (colRows || []).map((c: any) => [String(c.COLUMN_NAME).toLowerCase(), String(c.DATA_TYPE).toLowerCase()])
    );

    for (const dateCol of RAW_RECORD_DATE_COLUMNS) {
      if (colTypes.get(dateCol.toLowerCase()) === 'date') continue;
      try {
        await targetPool.query(
          `UPDATE raw_records
           SET \`${dateCol}\` = CASE
             WHEN \`${dateCol}\` IS NULL OR TRIM(CAST(\`${dateCol}\` AS CHAR)) = '' OR TRIM(CAST(\`${dateCol}\` AS CHAR)) = '0000-00-00' THEN NULL
             WHEN TRIM(CAST(\`${dateCol}\` AS CHAR)) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN SUBSTRING(TRIM(CAST(\`${dateCol}\` AS CHAR)), 1, 10)
             WHEN STR_TO_DATE(SUBSTRING_INDEX(TRIM(CAST(\`${dateCol}\` AS CHAR)), ' ', 1), '%d/%m/%Y') IS NOT NULL THEN DATE_FORMAT(STR_TO_DATE(SUBSTRING_INDEX(TRIM(CAST(\`${dateCol}\` AS CHAR)), ' ', 1), '%d/%m/%Y'), '%Y-%m-%d')
             WHEN STR_TO_DATE(SUBSTRING_INDEX(TRIM(CAST(\`${dateCol}\` AS CHAR)), ' ', 1), '%d-%m-%Y') IS NOT NULL THEN DATE_FORMAT(STR_TO_DATE(SUBSTRING_INDEX(TRIM(CAST(\`${dateCol}\` AS CHAR)), ' ', 1), '%d-%m-%Y'), '%Y-%m-%d')
             ELSE NULL
           END
           WHERE \`${dateCol}\` IS NOT NULL;`
        );
      } catch (e) {
        // Ignore if column is already DATE
      }
      try {
        await targetPool.query(`ALTER TABLE raw_records MODIFY COLUMN \`${dateCol}\` DATE NULL;`);
      } catch (e) {
        console.warn(`[MySQL] Could not alter raw_records.${dateCol} to DATE NULL:`, (e as any)?.message || e);
      }
    }
  } catch (e) {
    // Ignore metadata inspection failure
  }

  return {
    success: true,
    createdTables: ['uploads', 'raw_records', 'audit_logs', 'operational_settings', 'restore_points', 'users', 'scheduled_vs_conducted', 'slot_replacement', 'Exception_App_Rpt']
  };
}

export async function queryMysql<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const pool = await getMysqlPool();
  if (!pool) {
    throw new Error(`MySQL pool is unavailable: ${lastConnectionError || 'Could not connect'}`);
  }
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function runMysql(sql: string, params: any[] = []): Promise<any> {
  const pool = await getMysqlPool();
  if (!pool) {
    throw new Error(`MySQL pool is unavailable: ${lastConnectionError || 'Could not connect'}`);
  }
  const [result] = await pool.query(sql, params);
  mysqlDataVersion++;
  return result;
}

export async function isMysqlConnected(): Promise<boolean> {
  const pool = await getMysqlPool();
  return Boolean(pool);
}

// Data Migration from SQLite to MySQL
export async function migrateSqliteToMysql(sqliteDb: any): Promise<{
  success: boolean;
  recordsMigrated: number;
  uploadsMigrated: number;
  auditLogsMigrated: number;
  durationMs: number;
  message: string;
}> {
  const startTime = Date.now();
  const pool = await getMysqlPool();
  if (!pool) {
    throw new Error(`Cannot migrate: MySQL connection is not available (${lastConnectionError})`);
  }

  // 1. Ensure tables exist
  await initMysqlTables(pool);

  // 2. Migrate uploads
  const uploadStmt = sqliteDb.prepare('SELECT * FROM uploads');
  const uploadRows: any[] = [];
  while (uploadStmt.step()) {
    uploadRows.push(uploadStmt.getAsObject());
  }
  uploadStmt.free();

  for (const u of uploadRows) {
    await pool.query(
      `INSERT INTO uploads (id, file_name, sheet_name, uploaded_by, uploaded_at, row_count, valid_row_count, invalid_row_count, duplicate_count, processing_status, processing_duration_ms, source_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), row_count = VALUES(row_count);`,
      [
        u.id, u.file_name, u.sheet_name, u.uploaded_by, u.uploaded_at,
        u.row_count, u.valid_row_count, u.invalid_row_count, u.duplicate_count,
        u.processing_status, u.processing_duration_ms, u.source_hash
      ]
    );
  }

  // 3. Migrate raw_records in streaming batches of 500
  const recordsStmt = sqliteDb.prepare('SELECT * FROM raw_records');
  let recordsMigrated = 0;
  const batchSize = 500;
  let batch: any[] = [];

  const insertColumns = [
    'center_code', 'funder_name', 'program_name', 'assigned_trainers', 'assigned_ae', 'rm_sh_zh',
    'batch_code', 'course_code', 'batch_start_date', 'batch_initial_start_date', 'batch_initial_end_date',
    'batch_end_date', 'batch_actual_end_date', 'batch_status', 'batch_validation_status',
    'student_code', 'enrollment_status', 'dropout_type', 'email_verification_status',
    'final_exam_marks', 'placement_type', 'exam_schedule_date', 'ilt_completion', 'ilt_as_on_joining_date',
    'fm_class_completion', 'running_attendance', 'beneficiary_class_attendance',
    'incomplete_attendance_exception', 'incomplete_module_exception', 'special_case', 'joining_date', 'validation_status',
    'validation_done_by', 'upload_id'
  ];

  const dateColSet = new Set<string>(RAW_RECORD_DATE_COLUMNS);

  // Function to flush a batch into MySQL
  const flushBatch = async (items: any[]) => {
    if (items.length === 0) return;
    const valuePlaceholders = items.map(() => `(${insertColumns.map(() => '?').join(', ')})`).join(', ');
    const flatValues: any[] = [];
    for (const r of items) {
      for (const col of insertColumns) {
        let val = r[col] !== undefined ? r[col] : null;
        if (col === 'special_case') {
          const str = String(val ?? '').trim();
          if (str === '' || str === '0') val = null;
          else if (str === '1') val = 1;
          else val = str;
        } else if (dateColSet.has(col)) {
          val = sanitizeMysqlDateString(val);
        }
        flatValues.push(val);
      }
    }
    await pool.query(
      `INSERT INTO raw_records (${insertColumns.join(', ')}) VALUES ${valuePlaceholders}`,
      flatValues
    );
    recordsMigrated += items.length;
  };

  while (recordsStmt.step()) {
    batch.push(recordsStmt.getAsObject());
    if (batch.length >= batchSize) {
      await flushBatch(batch);
      batch = [];
    }
  }
  if (batch.length > 0) {
    await flushBatch(batch);
    batch = [];
  }
  recordsStmt.free();

  // 4. Migrate audit_logs
  const auditStmt = sqliteDb.prepare('SELECT * FROM audit_logs');
  let auditLogsMigrated = 0;
  while (auditStmt.step()) {
    const a = auditStmt.getAsObject();
    await pool.query(
      `INSERT INTO audit_logs (id, user_email, user_role, action, timestamp, upload_id, details, result)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE action = VALUES(action);`,
      [a.id, a.user_email, a.user_role, a.action, a.timestamp, a.upload_id || null, a.details, a.result]
    );
    auditLogsMigrated++;
  }
  auditStmt.free();

  // 5. Migrate restore_points
  try {
    const restoreStmt = sqliteDb.prepare('SELECT * FROM restore_points');
    while (restoreStmt.step()) {
      const rp = restoreStmt.getAsObject();
      await pool.query(
        `INSERT INTO restore_points (id, name, description, file_name, created_at, file_size, file_size_formatted, record_count, batch_count, upload_count, created_by, is_baseline)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name);`,
        [
          rp.id, rp.name, rp.description, rp.file_name, rp.created_at,
          rp.file_size, rp.file_size_formatted, rp.record_count,
          rp.batch_count, rp.upload_count, rp.created_by, rp.is_baseline || 0
        ]
      );
    }
    restoreStmt.free();
  } catch (e) {
    // ignore if restore_points empty
  }

  mysqlDataVersion++;

  const durationMs = Date.now() - startTime;
  return {
    success: true,
    recordsMigrated,
    uploadsMigrated: uploadRows.length,
    auditLogsMigrated,
    durationMs,
    message: `Successfully migrated ${recordsMigrated.toLocaleString()} records and ${uploadRows.length} uploads to MySQL in ${(durationMs / 1000).toFixed(1)}s`
  };
}

interface MysqlSchedulingMeta {
  version: number;
  timestamp: number;
  hasScheduledRows: boolean;
  batchToRmMap: Map<string, string>;
  batchToAeMap: Map<string, string>;
  rawBatchCodesByNorm: Map<string, Set<string>>;
  rescheduledMap: Map<string, number>;
  center_options: string[];
  program_options: string[];
  fm_options: string[];
}

let cachedMysqlSchedulingMeta: MysqlSchedulingMeta | null = null;
const mysqlSchedulingAnalyticsCache = new Map<string, { version: number; timestamp: number; data: SchedulingAnalyticsData }>();
const mysqlScheduledRecordsCache = new Map<string, { version: number; timestamp: number; data: { rows: any[]; totalCount: number } }>();
const MYSQL_CACHE_TTL_MS = 60_000;

async function getMysqlSchedulingMeta(pool: Pool): Promise<MysqlSchedulingMeta> {
  const now = Date.now();
  if (
    cachedMysqlSchedulingMeta &&
    cachedMysqlSchedulingMeta.version === mysqlDataVersion &&
    now - cachedMysqlSchedulingMeta.timestamp < MYSQL_CACHE_TTL_MS
  ) {
    return cachedMysqlSchedulingMeta;
  }

  const [countRes]: any = await pool.query(`SELECT 1 as ok FROM scheduled_vs_conducted LIMIT 1`);
  const hasScheduledRows = Array.isArray(countRes) && countRes.length > 0;
  if (!hasScheduledRows) {
    cachedMysqlSchedulingMeta = {
      version: mysqlDataVersion,
      timestamp: now,
      hasScheduledRows: false,
      batchToRmMap: new Map(),
      batchToAeMap: new Map(),
      rawBatchCodesByNorm: new Map(),
      rescheduledMap: new Map(),
      center_options: [],
      program_options: [],
      fm_options: [],
    };
    return cachedMysqlSchedulingMeta;
  }

  const [
    [srRows],
    [rmRows],
    [optRows]
  ]: any = await Promise.all([
    pool.query(`
      SELECT
        batch_code as bc,
        trainer_name,
        COUNT(actual_class_date) as cnt
      FROM slot_replacement
      WHERE batch_code IS NOT NULL AND batch_code != ''
        AND actual_class_date IS NOT NULL AND actual_class_date != ''
      GROUP BY batch_code, trainer_name
    `).catch((err) => {
      console.error('slot_replacement query error:', err);
      return [[]];
    }),
    pool.query(`
      SELECT batch_code as bc, MAX(center_code) as cc, MAX(rm_sh_zh) as rm_sh_zh, MAX(assigned_ae) as assigned_ae
      FROM raw_records
      WHERE batch_code IS NOT NULL AND batch_code != ''
      GROUP BY batch_code
    `).catch(() => [[]]),
    pool.query(`
      SELECT DISTINCT batch_code, actual_center_code, program_name, fm_email_id
      FROM scheduled_vs_conducted
      WHERE batch_code IS NOT NULL AND batch_code != ''
    `).catch(() => [[]])
  ]);

  const rescheduledMap = new Map<string, number>();
  if (Array.isArray(srRows)) {
    for (const r of srRows) {
      if (r.bc) {
        const bcNorm = String(r.bc).toLowerCase().trim();
        const trNorm = String(r.trainer_name || '').toLowerCase().trim();
        const key = `${bcNorm}___${trNorm}`;
        rescheduledMap.set(key, (rescheduledMap.get(key) || 0) + (Number(r.cnt) || 0));
      }
    }
  }

  const batchToRmMap = new Map<string, string>();
  const batchToAeMap = new Map<string, string>();
  const centerToRmMap = new Map<string, string>();
  const centerToAeMap = new Map<string, string>();
  const rawBatchCodesByNorm = new Map<string, Set<string>>();

  const registerRawBatch = (rawBc: any) => {
    if (!rawBc) return '';
    const trimmed = String(rawBc).trim();
    const norm = trimmed.toLowerCase();
    if (!norm || norm === 'null') return '';
    let set = rawBatchCodesByNorm.get(norm);
    if (!set) {
      set = new Set<string>();
      rawBatchCodesByNorm.set(norm, set);
    }
    set.add(trimmed);
    if (String(rawBc) !== trimmed) set.add(String(rawBc));
    return norm;
  };

  if (Array.isArray(rmRows)) {
    for (const r of rmRows) {
      const norm = registerRawBatch(r.bc);
      if (!norm) continue;
      const rmTrim = r.rm_sh_zh ? String(r.rm_sh_zh).trim() : '';
      const aeTrim = r.assigned_ae ? String(r.assigned_ae).trim() : '';
      const ccNorm = r.cc ? String(r.cc).trim().toLowerCase() : '';
      if (rmTrim) {
        batchToRmMap.set(norm, rmTrim);
        if (ccNorm && !centerToRmMap.has(ccNorm)) {
          centerToRmMap.set(ccNorm, rmTrim);
        }
      }
      if (aeTrim) {
        batchToAeMap.set(norm, aeTrim);
        if (ccNorm && !centerToAeMap.has(ccNorm)) {
          centerToAeMap.set(ccNorm, aeTrim);
        }
      }
    }
  }

  const centerSet = new Set<string>();
  const progSet = new Set<string>();
  const fmSet = new Set<string>();

  if (Array.isArray(optRows)) {
    for (const r of optRows) {
      const normBc = registerRawBatch(r.batch_code);
      const ccTrim = r.actual_center_code ? String(r.actual_center_code).trim() : '';
      const ccNorm = ccTrim.toLowerCase();
      if (ccTrim) {
        centerSet.add(ccTrim);
      }
      if (normBc && ccNorm) {
        if (!batchToRmMap.has(normBc) && centerToRmMap.has(ccNorm)) {
          batchToRmMap.set(normBc, centerToRmMap.get(ccNorm)!);
        }
        if (!batchToAeMap.has(normBc) && centerToAeMap.has(ccNorm)) {
          batchToAeMap.set(normBc, centerToAeMap.get(ccNorm)!);
        }
      }
      if (r.program_name && String(r.program_name).trim()) {
        progSet.add(String(r.program_name).trim());
      }
      if (r.fm_email_id && String(r.fm_email_id).trim()) {
        fmSet.add(String(r.fm_email_id).trim());
      }
    }
  }

  cachedMysqlSchedulingMeta = {
    version: mysqlDataVersion,
    timestamp: now,
    hasScheduledRows: true,
    batchToRmMap,
    batchToAeMap,
    rawBatchCodesByNorm,
    rescheduledMap,
    center_options: Array.from(centerSet).sort((a, b) => a.localeCompare(b)),
    program_options: Array.from(progSet).sort((a, b) => a.localeCompare(b)),
    fm_options: Array.from(fmSet).sort((a, b) => a.localeCompare(b)),
  };

  return cachedMysqlSchedulingMeta;
}

function resolveMatchingBatchCodesFromMeta(
  meta: {
    batchToRmMap: Map<string, string>;
    batchToAeMap: Map<string, string>;
    rawBatchCodesByNorm: Map<string, Set<string>>;
  },
  effectiveRms: string[],
  effectiveAes: string[]
): string[] | null {
  if (effectiveRms.length === 0 && effectiveAes.length === 0) {
    return null;
  }

  const lowerRms = effectiveRms.map(r => r.trim().toLowerCase());
  const includeKrishnaAndUpvan = lowerRms.some(r => r === 'krishna prasad' || r.includes('krishna prasad'));
  const lowerAes = new Set(effectiveAes.map(a => a.trim().toLowerCase()));

  const matchedRawCodes = new Set<string>();
  const allNormCodes = new Set<string>([
    ...meta.batchToRmMap.keys(),
    ...meta.batchToAeMap.keys(),
    ...meta.rawBatchCodesByNorm.keys(),
  ]);

  for (const normBc of allNormCodes) {
    if (effectiveRms.length > 0) {
      const rmVal = (meta.batchToRmMap.get(normBc) || '').toLowerCase();
      if (!rmVal) continue;
      const matchesRm =
        lowerRms.includes(rmVal) ||
        (includeKrishnaAndUpvan && (rmVal === 'krishna prasad' || rmVal.includes('upvan')));
      if (!matchesRm) continue;
    }

    if (effectiveAes.length > 0) {
      const aeVal = (meta.batchToAeMap.get(normBc) || '').toLowerCase();
      if (!aeVal || !lowerAes.has(aeVal)) continue;
    }

    const rawSet = meta.rawBatchCodesByNorm.get(normBc);
    if (rawSet && rawSet.size > 0) {
      for (const raw of rawSet) matchedRawCodes.add(raw);
    } else {
      matchedRawCodes.add(normBc);
    }
  }

  return Array.from(matchedRawCodes);
}

export async function insertScheduledVsConductedToMysql(
  rows: any[],
  uploadId?: string,
  uploadedBy = 'arnab.roy@anudip.org'
): Promise<{ recordsInserted: number }> {
  const pool = await getMysqlPool();
  if (!pool) {
    throw new Error('MySQL connection pool unavailable.');
  }

  try {
    await initMysqlTables(pool);
  } catch (schemaErr) {
    console.warn('initMysqlTables non-fatal notice in insertScheduledVsConductedToMysql:', schemaErr);
  }

  if (!rows || rows.length === 0) {
    return { recordsInserted: 0 };
  }

  const columns = [
    'slot_date',
    'fm_email_id',
    'batch_code',
    'actual_center_code',
    'program_name',
    'gmeet_id',
    'batch_status',
    'actual_status',
    'schedule_class_start_time',
    'actual_class_started',
    'schedule_class_end_time',
    'actual_class_ended',
    'class_link',
    'form_status',
    'upload_id',
    'uploaded_by'
  ];

  let recordsInserted = 0;
  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const flatValues: any[] = [];

    for (const r of chunk) {
      flatValues.push(
        r.slot_date ? String(r.slot_date).trim() : null,
        r.fm_email_id ? String(r.fm_email_id).trim() : null,
        r.batch_code ? String(r.batch_code).trim() : null,
        r.actual_center_code ? String(r.actual_center_code).trim() : null,
        r.program_name ? String(r.program_name).trim() : null,
        r.gmeet_id ? String(r.gmeet_id).trim() : null,
        r.batch_status ? String(r.batch_status).trim() : null,
        r.actual_status ? String(r.actual_status).trim() : null,
        r.schedule_class_start_time ? String(r.schedule_class_start_time).trim() : null,
        r.actual_class_started ? String(r.actual_class_started).trim() : null,
        r.schedule_class_end_time ? String(r.schedule_class_end_time).trim() : null,
        r.actual_class_ended ? String(r.actual_class_ended).trim() : null,
        r.class_link ? String(r.class_link).trim() : null,
        r.form_status ? String(r.form_status).trim() : null,
        uploadId || r.upload_id || null,
        uploadedBy || r.uploaded_by || 'arnab.roy@anudip.org'
      );
    }

    await pool.query(
      `INSERT INTO scheduled_vs_conducted (${columns.join(', ')}) VALUES ${placeholders}`,
      flatValues
    );
    recordsInserted += chunk.length;
  }

  mysqlDataVersion++;
  return { recordsInserted };
}

export async function getScheduledVsConductedFromMysql(
  limit = 50,
  offset = 0,
  search = '',
  filters: FilterParams = {}
): Promise<{ rows: any[]; totalCount: number }> {
  const pool = await getMysqlPool();
  if (!pool) {
    throw new Error('MySQL connection pool unavailable.');
  }

  const cacheKey = JSON.stringify({ limit, offset, search: search.trim(), filters });
  const now = Date.now();
  const cached = mysqlScheduledRecordsCache.get(cacheKey);
  if (cached && cached.version === mysqlDataVersion && now - cached.timestamp < MYSQL_CACHE_TTL_MS) {
    return cached.data;
  }

  const meta = await getMysqlSchedulingMeta(pool);
  if (!meta.hasScheduledRows) {
    return { rows: [], totalCount: 0 };
  }

  let whereClause = '1=1';
  const params: any[] = [];

  const pt = (filters.programType || '').trim().toLowerCase();
  if (pt === 'diya only') {
    whereClause += ` AND (LOWER(TRIM(COALESCE(program_name, ''))) NOT LIKE '%deep%tech%' AND LOWER(TRIM(COALESCE(program_name, ''))) NOT LIKE '%deeptech%' AND LOWER(TRIM(COALESCE(batch_code, ''))) NOT LIKE '%deep%')`;
  } else if (pt === 'deeptech only' || pt === 'deep tech only') {
    whereClause += ` AND (LOWER(TRIM(COALESCE(program_name, ''))) LIKE '%deep%tech%' OR LOWER(TRIM(COALESCE(program_name, ''))) LIKE '%deeptech%' OR LOWER(TRIM(COALESCE(batch_code, ''))) LIKE '%deep%')`;
  }

  const effectiveCenters = (filters.centerCodes && filters.centerCodes.length > 0)
    ? filters.centerCodes.filter(c => c && c !== 'ALL')
    : (filters.centerCode && filters.centerCode !== 'ALL')
      ? filters.centerCode.split(',').map(c => c.trim()).filter(c => c && c !== 'ALL')
      : [];

  if (effectiveCenters.length === 1) {
    whereClause += ` AND actual_center_code = ?`;
    params.push(effectiveCenters[0].trim());
  } else if (effectiveCenters.length > 1) {
    const placeholders = effectiveCenters.map(() => '?').join(', ');
    whereClause += ` AND actual_center_code IN (${placeholders})`;
    params.push(...effectiveCenters.map(c => c.trim()));
  }

  const effectiveProgramNames = (filters.programNames && filters.programNames.length > 0)
    ? filters.programNames.filter(p => p && p !== 'ALL')
    : (filters.programName && filters.programName !== 'ALL')
      ? filters.programName.split(',').map(p => p.trim()).filter(p => p && p !== 'ALL')
      : [];

  if (effectiveProgramNames.length === 1) {
    whereClause += ` AND program_name = ?`;
    params.push(effectiveProgramNames[0].trim());
  } else if (effectiveProgramNames.length > 1) {
    const placeholders = effectiveProgramNames.map(() => '?').join(', ');
    whereClause += ` AND program_name IN (${placeholders})`;
    params.push(...effectiveProgramNames.map(p => p.trim()));
  }

  const effectiveRms = (filters.rmShZhs && filters.rmShZhs.length > 0)
    ? filters.rmShZhs.filter(r => r && r !== 'ALL')
    : (filters.rmShZh && filters.rmShZh !== 'ALL')
      ? filters.rmShZh.split(',').map(r => r.trim()).filter(r => r && r !== 'ALL')
      : [];

  const effectiveAes = (filters.assignedAes && filters.assignedAes.length > 0)
    ? filters.assignedAes.filter(a => a && a !== 'ALL')
    : (filters.assignedAe && filters.assignedAe !== 'ALL')
      ? filters.assignedAe.split(',').map(a => a.trim()).filter(a => a && a !== 'ALL')
      : [];

  const matchedBatches = resolveMatchingBatchCodesFromMeta(meta, effectiveRms, effectiveAes);
  if (matchedBatches !== null) {
    if (matchedBatches.length === 0) {
      const emptyRes = { rows: [], totalCount: 0 };
      mysqlScheduledRecordsCache.set(cacheKey, { version: mysqlDataVersion, timestamp: now, data: emptyRes });
      return emptyRes;
    }
    const placeholders = matchedBatches.map(() => '?').join(', ');
    whereClause += ` AND batch_code IN (${placeholders})`;
    params.push(...matchedBatches);
  }

  if (filters.batchCode && filters.batchCode !== 'ALL') {
    whereClause += ` AND batch_code = ?`;
    params.push(filters.batchCode.trim());
  }
  if (filters.batchStatus && filters.batchStatus !== 'ALL') {
    whereClause += ` AND LOWER(TRIM(batch_status)) = LOWER(TRIM(?))`;
    params.push(filters.batchStatus);
  }

  const normalizedMysqlSlotDate = `(CASE
    WHEN slot_date IS NULL OR TRIM(slot_date) = '' THEN NULL
    WHEN SUBSTRING(TRIM(slot_date), 5, 1) IN ('-', '/') AND SUBSTRING(TRIM(slot_date), 8, 1) IN ('-', '/')
      THEN REPLACE(SUBSTRING(TRIM(slot_date), 1, 10), '/', '-')
    WHEN SUBSTRING(TRIM(slot_date), 3, 1) IN ('-', '/') AND SUBSTRING(TRIM(slot_date), 6, 1) IN ('-', '/')
      THEN CONCAT(SUBSTRING(TRIM(slot_date), 7, 4), '-', SUBSTRING(TRIM(slot_date), 4, 2), '-', SUBSTRING(TRIM(slot_date), 1, 2))
    ELSE SUBSTRING(TRIM(slot_date), 1, 10)
  END)`;

  if (filters.startDate && filters.startDate.trim() !== '') {
    whereClause += ` AND ${normalizedMysqlSlotDate} >= ?`;
    params.push(filters.startDate.trim());
  }
  if (filters.endDate && filters.endDate.trim() !== '') {
    whereClause += ` AND ${normalizedMysqlSlotDate} <= ?`;
    params.push(filters.endDate.trim());
  }

  if (search && search.trim() !== '') {
    const term = `%${search.trim().toLowerCase()}%`;
    whereClause += ` AND (
      LOWER(COALESCE(batch_code, '')) LIKE ? OR
      LOWER(COALESCE(fm_email_id, '')) LIKE ? OR
      LOWER(COALESCE(actual_center_code, '')) LIKE ? OR
      LOWER(COALESCE(program_name, '')) LIKE ? OR
      LOWER(COALESCE(actual_status, '')) LIKE ? OR
      LOWER(COALESCE(form_status, '')) LIKE ? OR
      LOWER(COALESCE(slot_date, '')) LIKE ?
    )`;
    params.push(term, term, term, term, term, term, term);
  }

  const [[countResult], [rowsResult]]: any = await Promise.all([
    pool.query(`SELECT COUNT(*) as total FROM scheduled_vs_conducted WHERE ${whereClause}`, params),
    pool.query(
      `SELECT * FROM scheduled_vs_conducted WHERE ${whereClause} ORDER BY slot_date DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    )
  ]);

  const totalCount = Number(countResult?.[0]?.total || 0);
  const result = { rows: rowsResult as any[], totalCount };
  mysqlScheduledRecordsCache.set(cacheKey, { version: mysqlDataVersion, timestamp: now, data: result });
  return result;
}

export async function insertSlotReplacementToMysql(
  rows: any[],
  uploadId?: string,
  uploadedBy = 'arnab.roy@anudip.org'
): Promise<{ recordsInserted: number }> {
  const pool = await getMysqlPool();
  if (!pool) {
    throw new Error('MySQL connection pool unavailable.');
  }

  try {
    await initMysqlTables(pool);
  } catch (schemaErr) {
    console.warn('initMysqlTables notice in insertSlotReplacementToMysql:', schemaErr);
  }

  if (!rows || rows.length === 0) {
    return { recordsInserted: 0 };
  }

  const columns = [
    'emp_code',
    'trainer_name',
    'batch_code',
    'alias',
    'actual_class_date',
    'replacement_class_date',
    'center_code',
    'center_name',
    'approved_rejected_by',
    'approval_rejected_date',
    'requested_date',
    'request_status',
    'reason',
    'upload_id',
    'uploaded_by'
  ];

  let recordsInserted = 0;
  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const flatValues: any[] = [];

    for (const r of chunk) {
      flatValues.push(
        r.emp_code ? String(r.emp_code).trim() : null,
        r.trainer_name ? String(r.trainer_name).trim() : null,
        r.batch_code ? String(r.batch_code).trim() : null,
        r.alias ? String(r.alias).trim() : null,
        r.actual_class_date ? String(r.actual_class_date).trim() : null,
        r.replacement_class_date ? String(r.replacement_class_date).trim() : null,
        r.center_code ? String(r.center_code).trim() : null,
        r.center_name ? String(r.center_name).trim() : null,
        r.approved_rejected_by ? String(r.approved_rejected_by).trim() : null,
        r.approval_rejected_date ? String(r.approval_rejected_date).trim() : null,
        r.requested_date ? String(r.requested_date).trim() : null,
        r.request_status ? String(r.request_status).trim() : null,
        r.reason ? String(r.reason).trim() : null,
        uploadId || r.upload_id || null,
        uploadedBy || r.uploaded_by || 'arnab.roy@anudip.org'
      );
    }

    await pool.query(
      `INSERT INTO slot_replacement (${columns.join(', ')}) VALUES ${placeholders}`,
      flatValues
    );
    recordsInserted += chunk.length;
  }

  mysqlDataVersion++;
  return { recordsInserted };
}

export async function getSlotReplacementsFromMysql(
  limit = 50,
  offset = 0,
  search = ''
): Promise<{ rows: any[]; totalCount: number }> {
  const pool = await getMysqlPool();
  if (!pool) {
    throw new Error('MySQL connection pool unavailable.');
  }

  let whereClause = '1=1';
  const params: any[] = [];

  if (search && search.trim() !== '') {
    const term = `%${search.trim().toLowerCase()}%`;
    whereClause += ` AND (
      LOWER(COALESCE(emp_code, '')) LIKE ? OR
      LOWER(COALESCE(trainer_name, '')) LIKE ? OR
      LOWER(COALESCE(batch_code, '')) LIKE ? OR
      LOWER(COALESCE(center_code, '')) LIKE ? OR
      LOWER(COALESCE(center_name, '')) LIKE ? OR
      LOWER(COALESCE(request_status, '')) LIKE ? OR
      LOWER(COALESCE(reason, '')) LIKE ?
    )`;
    params.push(term, term, term, term, term, term, term);
  }

  const [[countResult], [rowsResult]]: any = await Promise.all([
    pool.query(`SELECT COUNT(*) as total FROM slot_replacement WHERE ${whereClause}`, params),
    pool.query(
      `SELECT * FROM slot_replacement WHERE ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    )
  ]);

  const totalCount = Number(countResult?.[0]?.total || 0);
  return { rows: rowsResult as any[], totalCount };
}

export async function getSchedulingAnalyticsFromMysql(filters: FilterParams = {}): Promise<SchedulingAnalyticsData> {
  const pool = await getMysqlPool();
  if (!pool) {
    throw new Error('MySQL connection pool unavailable.');
  }

  const cacheKey = JSON.stringify(filters);
  const now = Date.now();
  const cached = mysqlSchedulingAnalyticsCache.get(cacheKey);
  if (cached && cached.version === mysqlDataVersion && now - cached.timestamp < MYSQL_CACHE_TTL_MS) {
    return cached.data;
  }

  const meta = await getMysqlSchedulingMeta(pool);
  if (!meta.hasScheduledRows) {
    return {
      summary: {
        total_batches: 0,
        total_scheduled_sessions: 0,
        total_sessions_not_conducted: 0,
        total_sessions_rescheduled: 0,
        total_sessions_conducted: 0,
        overall_conducted_pct: 100,
        batches_with_missed_sessions: 0,
        zero_missed_batches: 0,
      },
      batches: [],
      center_options: [],
      program_options: [],
      fm_options: [],
      by_rm: [],
      by_center: [],
      by_program: [],
    };
  }

  let whereClause = "batch_code IS NOT NULL AND TRIM(batch_code) != '' AND LOWER(TRIM(batch_code)) != 'null'";
  const params: any[] = [];

  const pt = (filters.programType || '').trim().toLowerCase();
  if (pt === 'diya only') {
    whereClause += ` AND (LOWER(TRIM(COALESCE(program_name, ''))) NOT LIKE '%deep%tech%' AND LOWER(TRIM(COALESCE(program_name, ''))) NOT LIKE '%deeptech%' AND LOWER(TRIM(COALESCE(batch_code, ''))) NOT LIKE '%deep%')`;
  } else if (pt === 'deeptech only' || pt === 'deep tech only') {
    whereClause += ` AND (LOWER(TRIM(COALESCE(program_name, ''))) LIKE '%deep%tech%' OR LOWER(TRIM(COALESCE(program_name, ''))) LIKE '%deeptech%' OR LOWER(TRIM(COALESCE(batch_code, ''))) LIKE '%deep%')`;
  }

  const effectiveCenters = (filters.centerCodes && filters.centerCodes.length > 0)
    ? filters.centerCodes.filter(c => c && c !== 'ALL')
    : (filters.centerCode && filters.centerCode !== 'ALL')
      ? filters.centerCode.split(',').map(c => c.trim()).filter(c => c && c !== 'ALL')
      : [];

  if (effectiveCenters.length === 1) {
    whereClause += ` AND actual_center_code = ?`;
    params.push(effectiveCenters[0].trim());
  } else if (effectiveCenters.length > 1) {
    const placeholders = effectiveCenters.map(() => '?').join(', ');
    whereClause += ` AND actual_center_code IN (${placeholders})`;
    params.push(...effectiveCenters.map(c => c.trim()));
  }

  const effectiveProgramNames = (filters.programNames && filters.programNames.length > 0)
    ? filters.programNames.filter(p => p && p !== 'ALL')
    : (filters.programName && filters.programName !== 'ALL')
      ? filters.programName.split(',').map(p => p.trim()).filter(p => p && p !== 'ALL')
      : [];

  if (effectiveProgramNames.length === 1) {
    whereClause += ` AND program_name = ?`;
    params.push(effectiveProgramNames[0].trim());
  } else if (effectiveProgramNames.length > 1) {
    const placeholders = effectiveProgramNames.map(() => '?').join(', ');
    whereClause += ` AND program_name IN (${placeholders})`;
    params.push(...effectiveProgramNames.map(p => p.trim()));
  }

  const effectiveAes = (filters.assignedAes && filters.assignedAes.length > 0)
    ? filters.assignedAes.filter(a => a && a !== 'ALL')
    : (filters.assignedAe && filters.assignedAe !== 'ALL')
      ? filters.assignedAe.split(',').map(a => a.trim()).filter(a => a && a !== 'ALL')
      : [];

  const effectiveRms = (filters.rmShZhs && filters.rmShZhs.length > 0)
    ? filters.rmShZhs.filter(r => r && r !== 'ALL')
    : (filters.rmShZh && filters.rmShZh !== 'ALL')
      ? filters.rmShZh.split(',').map(r => r.trim()).filter(r => r && r !== 'ALL')
      : [];

  const matchedBatches = resolveMatchingBatchCodesFromMeta(meta, effectiveRms, effectiveAes);
  if (matchedBatches !== null) {
    if (matchedBatches.length === 0) {
      const emptyData: SchedulingAnalyticsData = {
        summary: {
          total_batches: 0,
          total_scheduled_sessions: 0,
          total_sessions_not_conducted: 0,
          total_sessions_rescheduled: 0,
          total_sessions_conducted: 0,
          overall_conducted_pct: 100,
          batches_with_missed_sessions: 0,
          zero_missed_batches: 0,
        },
        batches: [],
        center_options: meta.center_options,
        program_options: meta.program_options,
        fm_options: meta.fm_options,
        by_rm: [],
        by_center: [],
        by_program: [],
        initial_records: { rows: [], totalCount: 0 },
      };
      mysqlSchedulingAnalyticsCache.set(cacheKey, { version: mysqlDataVersion, timestamp: now, data: emptyData });
      return emptyData;
    }
    const placeholders = matchedBatches.map(() => '?').join(', ');
    whereClause += ` AND batch_code IN (${placeholders})`;
    params.push(...matchedBatches);
  }

  if (filters.batchCode && filters.batchCode !== 'ALL') {
    whereClause += ` AND batch_code = ?`;
    params.push(filters.batchCode.trim());
  }
  if (filters.batchStatus && filters.batchStatus !== 'ALL') {
    whereClause += ` AND LOWER(TRIM(batch_status)) = LOWER(TRIM(?))`;
    params.push(filters.batchStatus);
  }
  const trainerFilter = filters.assignedTrainer || filters.trainer;
  if (trainerFilter && trainerFilter !== 'ALL') {
    whereClause += ` AND LOWER(TRIM(fm_email_id)) LIKE ?`;
    params.push(`%${trainerFilter.trim().toLowerCase()}%`);
  }

  const normalizedMysqlSlotDate = `(CASE
    WHEN slot_date IS NULL OR TRIM(slot_date) = '' THEN NULL
    WHEN SUBSTRING(TRIM(slot_date), 5, 1) IN ('-', '/') AND SUBSTRING(TRIM(slot_date), 8, 1) IN ('-', '/')
      THEN REPLACE(SUBSTRING(TRIM(slot_date), 1, 10), '/', '-')
    WHEN SUBSTRING(TRIM(slot_date), 3, 1) IN ('-', '/') AND SUBSTRING(TRIM(slot_date), 6, 1) IN ('-', '/')
      THEN CONCAT(SUBSTRING(TRIM(slot_date), 7, 4), '-', SUBSTRING(TRIM(slot_date), 4, 2), '-', SUBSTRING(TRIM(slot_date), 1, 2))
    ELSE SUBSTRING(TRIM(slot_date), 1, 10)
  END)`;

  if (filters.startDate && filters.startDate.trim() !== '') {
    whereClause += ` AND ${normalizedMysqlSlotDate} >= ?`;
    params.push(filters.startDate.trim());
  }
  if (filters.endDate && filters.endDate.trim() !== '') {
    whereClause += ` AND ${normalizedMysqlSlotDate} <= ?`;
    params.push(filters.endDate.trim());
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    whereClause += ` AND (
      LOWER(COALESCE(batch_code, '')) LIKE ? OR
      LOWER(COALESCE(fm_email_id, '')) LIKE ? OR
      LOWER(COALESCE(actual_center_code, '')) LIKE ? OR
      LOWER(COALESCE(program_name, '')) LIKE ?
    )`;
    params.push(term, term, term, term);
  }

  const query = `
    SELECT
      actual_center_code as center_code,
      batch_code,
      program_name,
      fm_email_id,
      COALESCE(MAX(batch_status), 'Running') as batch_status,
      COUNT(*) as total_scheduled,
      COUNT(CASE 
        WHEN (
          LOWER(TRIM(COALESCE(actual_status, ''))) IN ('sessions not started in cmis', 'session not ended on cmis', 'sessions not started on cmis', 'session not started in cmis', 'session not ended in cmis')
          OR LOWER(TRIM(COALESCE(actual_status, ''))) LIKE '%not started%cmis%'
          OR LOWER(TRIM(COALESCE(actual_status, ''))) LIKE '%not ended%cmis%'
        )
        AND (
          LOWER(TRIM(COALESCE(form_status, ''))) IN ('no form filled', 'no form', 'not filled')
          OR LOWER(TRIM(COALESCE(form_status, ''))) LIKE '%no form%'
        )
        THEN 1 
      END) as sessions_not_conducted,
      MIN(slot_date) as earliest_slot_date,
      MAX(slot_date) as latest_slot_date
    FROM scheduled_vs_conducted
    WHERE ${whereClause}
    GROUP BY actual_center_code, batch_code, program_name, fm_email_id
    ORDER BY actual_center_code ASC, batch_code ASC, fm_email_id ASC
  `;

  const [[rows], [initialRows]]: any = await Promise.all([
    pool.query(query, params),
    pool.query(
      `SELECT * FROM scheduled_vs_conducted WHERE ${whereClause} ORDER BY slot_date DESC, id DESC LIMIT 50 OFFSET 0`,
      params
    )
  ]);

  const batches: SchedulingBatchItem[] = [];
  let totalScheduledAll = 0;
  let totalNotConductedAll = 0;

  for (const row of rows) {
    const totalScheduled = Number(row.total_scheduled) || 0;
    const notConducted = Number(row.sessions_not_conducted) || 0;
    const conducted = Math.max(0, totalScheduled - notConducted);
    const conductedPct = totalScheduled > 0 ? Number(((conducted / totalScheduled) * 100).toFixed(1)) : 100;
    const batchCodeKey = String(row.batch_code || '').toLowerCase().trim();
    const fmEmailKey = String(row.fm_email_id || '').toLowerCase().trim();
    const rescheduled = meta.rescheduledMap.get(`${batchCodeKey}___${fmEmailKey}`) || 0;

    totalScheduledAll += totalScheduled;
    totalNotConductedAll += notConducted;

    batches.push({
      center_code: row.center_code || 'N/A',
      batch_code: row.batch_code || 'N/A',
      program_name: row.program_name || 'N/A',
      fm_email_id: row.fm_email_id || 'N/A',
      total_scheduled: totalScheduled,
      sessions_not_conducted: notConducted,
      sessions_rescheduled: rescheduled,
      sessions_conducted: conducted,
      conducted_pct: conductedPct,
      batch_status: row.batch_status ? (row.batch_status.charAt(0).toUpperCase() + row.batch_status.slice(1).toLowerCase()) : 'Running',
      earliest_slot_date: row.earliest_slot_date,
      latest_slot_date: row.latest_slot_date,
    });
  }

  const totalConductedAll = Math.max(0, totalScheduledAll - totalNotConductedAll);
  const overallConductedPct = totalScheduledAll > 0 ? Number(((totalConductedAll / totalScheduledAll) * 100).toFixed(1)) : 100;
  const batchesWithMissed = batches.filter(b => b.sessions_not_conducted > 0).length;
  const zeroMissed = batches.length - batchesWithMissed;
  const totalRescheduledAll = batches.reduce((acc, b) => acc + (b.sessions_rescheduled || 0), 0);

  const distinctBatchSet = new Set(batches.map(b => b.batch_code));

  const rmAgg: Record<string, { scheduled: number; conducted: number; missed: number; rescheduled: number; batches: Set<string> }> = {};
  const centerAgg: Record<string, { scheduled: number; conducted: number; missed: number; rescheduled: number; batches: Set<string> }> = {};
  const programAgg: Record<string, { scheduled: number; conducted: number; missed: number; rescheduled: number; batches: Set<string> }> = {};

  for (const b of batches) {
    const rmName = meta.batchToRmMap.get(b.batch_code.toLowerCase().trim()) || 'Unassigned';
    if (!rmAgg[rmName]) rmAgg[rmName] = { scheduled: 0, conducted: 0, missed: 0, rescheduled: 0, batches: new Set() };
    rmAgg[rmName].scheduled += b.total_scheduled;
    rmAgg[rmName].conducted += b.sessions_conducted;
    rmAgg[rmName].missed += b.sessions_not_conducted;
    rmAgg[rmName].rescheduled += (b.sessions_rescheduled || 0);
    rmAgg[rmName].batches.add(b.batch_code);

    const cName = b.center_code || 'N/A';
    if (!centerAgg[cName]) centerAgg[cName] = { scheduled: 0, conducted: 0, missed: 0, rescheduled: 0, batches: new Set() };
    centerAgg[cName].scheduled += b.total_scheduled;
    centerAgg[cName].conducted += b.sessions_conducted;
    centerAgg[cName].missed += b.sessions_not_conducted;
    centerAgg[cName].rescheduled += (b.sessions_rescheduled || 0);
    centerAgg[cName].batches.add(b.batch_code);

    const pName = b.program_name || 'N/A';
    if (!programAgg[pName]) programAgg[pName] = { scheduled: 0, conducted: 0, missed: 0, rescheduled: 0, batches: new Set() };
    programAgg[pName].scheduled += b.total_scheduled;
    programAgg[pName].conducted += b.sessions_conducted;
    programAgg[pName].missed += b.sessions_not_conducted;
    programAgg[pName].rescheduled += (b.sessions_rescheduled || 0);
    programAgg[pName].batches.add(b.batch_code);
  }

  const by_rm = Object.entries(rmAgg)
    .filter(([name]) => name && name.trim().toLowerCase() !== 'unassigned')
    .map(([name, val]) => {
      const condPct = val.scheduled > 0 ? Number(((val.conducted / val.scheduled) * 100).toFixed(1)) : 100;
      const reschedPct = val.scheduled > 0 ? Number(((val.rescheduled / val.scheduled) * 100).toFixed(1)) : 0;
      return {
        name,
        total_scheduled: val.scheduled,
        sessions_conducted: val.conducted,
        sessions_not_conducted: val.missed,
        sessions_rescheduled: val.rescheduled,
        conducted_pct: condPct,
        missed_pct: Number((100 - condPct).toFixed(1)),
        rescheduled_pct: reschedPct,
        batches: val.batches.size,
      };
    })
    .sort((a, b) => b.sessions_not_conducted - a.sessions_not_conducted || b.total_scheduled - a.total_scheduled);

  const by_center = Object.entries(centerAgg).map(([name, val]) => {
    const condPct = val.scheduled > 0 ? Number(((val.conducted / val.scheduled) * 100).toFixed(1)) : 100;
    const reschedPct = val.scheduled > 0 ? Number(((val.rescheduled / val.scheduled) * 100).toFixed(1)) : 0;
    return {
      name,
      center_code: name,
      total_scheduled: val.scheduled,
      sessions_conducted: val.conducted,
      sessions_not_conducted: val.missed,
      sessions_rescheduled: val.rescheduled,
      conducted_pct: condPct,
      missed_pct: Number((100 - condPct).toFixed(1)),
      rescheduled_pct: reschedPct,
      batches: val.batches.size,
    };
  }).sort((a, b) => b.sessions_not_conducted - a.sessions_not_conducted || b.total_scheduled - a.total_scheduled);

  const by_program = Object.entries(programAgg).map(([name, val]) => {
    const condPct = val.scheduled > 0 ? Number(((val.conducted / val.scheduled) * 100).toFixed(1)) : 100;
    const reschedPct = val.scheduled > 0 ? Number(((val.rescheduled / val.scheduled) * 100).toFixed(1)) : 0;
    return {
      name,
      program_name: name,
      total_scheduled: val.scheduled,
      sessions_conducted: val.conducted,
      sessions_not_conducted: val.missed,
      sessions_rescheduled: val.rescheduled,
      conducted_pct: condPct,
      missed_pct: Number((100 - condPct).toFixed(1)),
      rescheduled_pct: reschedPct,
      batches: val.batches.size,
    };
  }).sort((a, b) => b.sessions_not_conducted - a.sessions_not_conducted || b.total_scheduled - a.total_scheduled);

  function consolidateUpvanDharForDiya(byRm: any[], _programType?: string): any[] {
    if (!byRm || !Array.isArray(byRm) || byRm.length === 0) return byRm;

    const isUpvan = (item: any) => {
      const val = String(item.name || item.rm_sh_zh || '').trim().toLowerCase();
      return val === 'upvan dhar' || val.includes('upvan');
    };

    const isKrishnaPrasad = (item: any) => {
      const val = String(item.name || item.rm_sh_zh || '').trim().toLowerCase();
      return val === 'krishna prasad' || val.includes('krishna prasad');
    };

    const upvanItems = byRm.filter(isUpvan);
    const kpItems = byRm.filter(isKrishnaPrasad);

    if (upvanItems.length === 0 && kpItems.length <= 1) {
      return byRm;
    }

    const matches = byRm.filter((item) => isUpvan(item) || isKrishnaPrasad(item));
    if (matches.length === 0) return byRm;

    const others = byRm.filter((item) => !isUpvan(item) && !isKrishnaPrasad(item));

    const kp: any = {
      name: 'Krishna Prasad',
      rm_sh_zh: 'Krishna Prasad',
    };

    for (const item of matches) {
      for (const key of Object.keys(item)) {
        if (key === 'name' || key === 'rm_sh_zh') continue;
        const val = item[key];
        if (typeof val === 'number' || (val != null && !isNaN(Number(val)) && typeof kp[key] === 'number')) {
          const current = Number(kp[key]) || 0;
          const added = Number(val) || 0;
          const sum = current + added;
          kp[key] = Number.isInteger(current) && Number.isInteger(added) ? sum : Number(sum.toFixed(1));
        } else if (kp[key] === undefined) {
          kp[key] = val;
        }
      }
    }

    if (kp.initial_dropout_rate != null || kp.regular_dropout_rate != null) {
      const totalRate = Number(((Number(kp.initial_dropout_rate) || 0) + (Number(kp.regular_dropout_rate) || 0)).toFixed(1));
      kp.total_dropout_rate = totalRate;
      kp.dropout_rate = totalRate;
    }

    if (kp.sessions_conducted !== undefined && kp.total_scheduled !== undefined) {
      kp.conducted_pct = kp.total_scheduled > 0 ? Number(((kp.sessions_conducted / kp.total_scheduled) * 100).toFixed(1)) : 100;
      kp.missed_pct = kp.total_scheduled > 0 ? Number((100 - kp.conducted_pct).toFixed(1)) : 0;
      if (kp.sessions_rescheduled !== undefined) {
        kp.rescheduled_pct = kp.total_scheduled > 0 ? Number(((kp.sessions_rescheduled / kp.total_scheduled) * 100).toFixed(1)) : 0;
      }
    }

    const firstMatchIndex = byRm.findIndex((item) => isUpvan(item) || isKrishnaPrasad(item));
    const result = [...others];
    if (firstMatchIndex !== -1 && firstMatchIndex <= result.length) {
      result.splice(firstMatchIndex, 0, kp);
    } else {
      result.push(kp);
    }

    return result;
  }

  const finalResult: SchedulingAnalyticsData = {
    summary: {
      total_batches: distinctBatchSet.size,
      total_scheduled_sessions: totalScheduledAll,
      total_sessions_not_conducted: totalNotConductedAll,
      total_sessions_rescheduled: totalRescheduledAll,
      total_sessions_conducted: totalConductedAll,
      overall_conducted_pct: overallConductedPct,
      batches_with_missed_sessions: batchesWithMissed,
      zero_missed_batches: zeroMissed,
    },
    batches,
    center_options: meta.center_options,
    program_options: meta.program_options,
    fm_options: meta.fm_options,
    by_rm: consolidateUpvanDharForDiya(by_rm, filters.programType),
    by_center,
    by_program,
    initial_records: {
      rows: (initialRows as any[]) || [],
      totalCount: totalScheduledAll,
    },
  };

  mysqlSchedulingAnalyticsCache.set(cacheKey, { version: mysqlDataVersion, timestamp: now, data: finalResult });
  return finalResult;
}

export async function getBatchSessionDetailsFromMysql(batchCode: string, fmEmailId?: string): Promise<any[]> {
  const pool = await getMysqlPool();
  if (!pool) return [];
  try {
    let sql = `SELECT * FROM scheduled_vs_conducted WHERE batch_code = ?`;
    const params: any[] = [batchCode.trim()];
    if (fmEmailId && fmEmailId !== 'ALL' && fmEmailId !== 'N/A' && fmEmailId.trim() !== '') {
      sql += ` AND fm_email_id = ?`;
      params.push(fmEmailId.trim());
    }
    sql += ` ORDER BY slot_date ASC, id ASC`;
    const [rows]: any = await pool.query(sql, params);
    return rows || [];
  } catch (err) {
    console.warn('MySQL getBatchSessionDetailsFromMysql error:', err);
    return [];
  }
}

export async function insertChallengesToMysql(rows: any[], uploadId?: string, uploadedBy = 'arnab.roy@anudip.org'): Promise<{ totalRecords: number; validCount: number; uploadId: string }> {
  const pool = await getMysqlPool();
  if (!pool) throw new Error('MySQL connection pool unavailable.');
  if (!rows || rows.length === 0) {
    return { totalRecords: 0, validCount: 0, uploadId: uploadId || `upl_ch_${Date.now()}` };
  }

  const actualUploadId = uploadId || `upl_ch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let insertedCount = 0;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const insertSql = `
      INSERT INTO challenges (
        Sl_no, rm_name, challenge, impact
      ) VALUES ?
    `;

    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values = chunk.map((r, idx) => {
        const rawSl = r.sl_no ?? r.Sl_no ?? r['Sl No.'] ?? r['Sl No'];
        const parsedSl = rawSl !== undefined && rawSl !== null && String(rawSl).trim() !== ''
          ? parseInt(String(rawSl).replace(/[^0-9-]/g, ''), 10)
          : NaN;
        const slNoInt = !isNaN(parsedSl) ? parsedSl : (i + idx + 1);

        const rmVal = r.rm_name ?? r['RM Name'] ?? r['RM'] ?? null;
        const chVal = r.challenges ?? r.challenge ?? r['Challenges'] ?? r['Challenge'] ?? null;
        const impVal = r.impact ?? r['Impact'] ?? null;

        return [
          slNoInt,
          rmVal !== undefined && rmVal !== null ? String(rmVal).trim() : null,
          chVal !== undefined && chVal !== null ? String(chVal).trim() : null,
          impVal !== undefined && impVal !== null ? String(impVal).trim() : null,
        ];
      });
      const [res]: any = await connection.query(insertSql, [values]);
      insertedCount += res.affectedRows || 0;
    }

    await connection.commit();
    bumpMysqlDataVersion();
    return { totalRecords: rows.length, validCount: insertedCount, uploadId: actualUploadId };
  } catch (err: any) {
    await connection.rollback();
    console.error('insertChallengesToMysql error:', err);
    throw err;
  } finally {
    connection.release();
  }
}

export async function getChallengesFromMysql(limit = 50, offset = 0, search = ''): Promise<{ rows: any[]; totalCount: number }> {
  const pool = await getMysqlPool();
  if (!pool) return { rows: [], totalCount: 0 };

  try {
    let whereClause = '';
    const params: any[] = [];
    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      whereClause = ` WHERE rm_name LIKE ? OR challenge LIKE ? OR impact LIKE ? OR CAST(Sl_no AS CHAR) LIKE ?`;
      params.push(term, term, term, term);
    }

    const [cntRows]: any = await pool.query(`SELECT COUNT(*) as total FROM challenges${whereClause}`, params);
    const totalCount = Number(cntRows[0]?.total) || 0;

    let sql = `
      SELECT
        Sl_no AS sl_no,
        rm_name,
        challenge AS challenges,
        challenge,
        impact
      FROM challenges${whereClause}
      ORDER BY Sl_no ASC
    `;
    const queryParams = [...params];
    if (limit > 0) {
      sql += ` LIMIT ? OFFSET ?`;
      queryParams.push(Number(limit), Number(offset));
    }

    const [rows]: any = await pool.query(sql, queryParams);
    return { rows: rows || [], totalCount };
  } catch (err) {
    console.error('getChallengesFromMysql error:', err);
    return { rows: [], totalCount: 0 };
  }
}

export interface LiveUserPresenceRecord {
  session_id: string;
  email: string;
  user_name: string;
  avatar_url?: string | null;
  user_role: string;
  current_view: string;
  current_view_label: string;
  portal_mode: string;
  browser_info: string;
  device_os: string;
  host_origin: string;
  ip_address?: string | null;
  started_at: number;
  last_seen_at: number;
  is_online: number;
}

const inMemoryPresenceMap = new Map<string, LiveUserPresenceRecord>();
let presenceTableInitialized = false;

async function ensurePresenceTable(pool: Pool): Promise<void> {
  if (presenceTableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_active_users (
        session_id VARCHAR(128) NOT NULL,
        email VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        avatar_url TEXT NULL,
        user_role VARCHAR(100) NOT NULL DEFAULT 'Admin',
        current_view VARCHAR(100) NOT NULL DEFAULT 'overview',
        current_view_label VARCHAR(150) NOT NULL DEFAULT 'Dashboard',
        portal_mode VARCHAR(100) NOT NULL DEFAULT 'Main Dashboard',
        browser_info VARCHAR(255) NULL,
        device_os VARCHAR(150) NULL,
        host_origin VARCHAR(255) NULL,
        ip_address VARCHAR(100) NULL,
        started_at BIGINT NOT NULL,
        last_seen_at BIGINT NOT NULL,
        is_online TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (session_id),
        INDEX idx_live_users_last_seen (last_seen_at),
        INDEX idx_live_users_email (email),
        INDEX idx_live_users_online (is_online)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    presenceTableInitialized = true;
  } catch (err) {
    console.warn('Could not create live_active_users table in MySQL:', err);
  }
}

export async function upsertLiveUserPresence(record: LiveUserPresenceRecord): Promise<void> {
  // Always update in-memory map immediately
  const existing = inMemoryPresenceMap.get(record.session_id);
  const merged: LiveUserPresenceRecord = {
    ...record,
    started_at: existing?.started_at ? Math.min(existing.started_at, record.started_at) : record.started_at,
  };
  inMemoryPresenceMap.set(record.session_id, merged);

  const pool = await getMysqlPool();
  if (!pool) return;

  try {
    await ensurePresenceTable(pool);
    await pool.query(
      `INSERT INTO live_active_users (
        session_id, email, user_name, avatar_url, user_role,
        current_view, current_view_label, portal_mode, browser_info,
        device_os, host_origin, ip_address, started_at, last_seen_at, is_online
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        user_name = VALUES(user_name),
        avatar_url = VALUES(avatar_url),
        user_role = VALUES(user_role),
        current_view = VALUES(current_view),
        current_view_label = VALUES(current_view_label),
        portal_mode = VALUES(portal_mode),
        browser_info = VALUES(browser_info),
        device_os = VALUES(device_os),
        host_origin = VALUES(host_origin),
        ip_address = VALUES(ip_address),
        last_seen_at = VALUES(last_seen_at),
        is_online = 1`,
      [
        merged.session_id,
        merged.email,
        merged.user_name,
        merged.avatar_url || null,
        merged.user_role,
        merged.current_view,
        merged.current_view_label,
        merged.portal_mode,
        merged.browser_info,
        merged.device_os,
        merged.host_origin,
        merged.ip_address || null,
        merged.started_at,
        merged.last_seen_at,
      ]
    );

    // Prune records older than 7 days occasionally
    const cutoff7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await pool.query(`DELETE FROM live_active_users WHERE last_seen_at < ?`, [cutoff7d]).catch(() => {});
  } catch (err) {
    console.warn('upsertLiveUserPresence MySQL warning:', err);
  }
}

export async function markLiveUserOffline(sessionId: string): Promise<void> {
  const existing = inMemoryPresenceMap.get(sessionId);
  if (existing) {
    existing.is_online = 0;
    existing.last_seen_at = Date.now();
    inMemoryPresenceMap.set(sessionId, existing);
  }

  const pool = await getMysqlPool();
  if (!pool) return;

  try {
    await ensurePresenceTable(pool);
    await pool.query(
      `UPDATE live_active_users SET is_online = 0, last_seen_at = ? WHERE session_id = ?`,
      [Date.now(), sessionId]
    );
  } catch (err) {
    console.warn('markLiveUserOffline MySQL warning:', err);
  }
}

export async function getLiveActiveUsers(activeWindowMs = 75000): Promise<{
  activeUsers: (LiveUserPresenceRecord & { status: 'online' | 'idle' | 'offline'; active_seconds: number; seconds_since_ping: number })[];
  recentUsers: (LiveUserPresenceRecord & { status: 'online' | 'idle' | 'offline'; active_seconds: number; seconds_since_ping: number })[];
  serverTimestamp: number;
}> {
  const now = Date.now();
  const combinedMap = new Map<string, LiveUserPresenceRecord>();

  // Load from in-memory first
  for (const [sid, rec] of inMemoryPresenceMap.entries()) {
    combinedMap.set(sid, rec);
  }

  // Merge with shared MySQL table so sessions across both ais-pre and ais-dev are visible
  const pool = await getMysqlPool();
  if (pool) {
    try {
      await ensurePresenceTable(pool);
      const cutoff24h = now - 24 * 60 * 60 * 1000;
      const [rows]: any = await pool.query(
        `SELECT * FROM live_active_users WHERE last_seen_at >= ? ORDER BY last_seen_at DESC LIMIT 200`,
        [cutoff24h]
      );
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const sid = String(r.session_id);
          const local = combinedMap.get(sid);
          const dbLastSeen = Number(r.last_seen_at) || 0;
          if (!local || dbLastSeen >= local.last_seen_at) {
            combinedMap.set(sid, {
              session_id: sid,
              email: String(r.email || ''),
              user_name: String(r.user_name || ''),
              avatar_url: r.avatar_url ? String(r.avatar_url) : null,
              user_role: String(r.user_role || 'Viewer'),
              current_view: String(r.current_view || 'overview'),
              current_view_label: String(r.current_view_label || 'Dashboard'),
              portal_mode: String(r.portal_mode || 'Main Dashboard'),
              browser_info: String(r.browser_info || 'Chrome Browser'),
              device_os: String(r.device_os || 'Desktop'),
              host_origin: String(r.host_origin || ''),
              ip_address: r.ip_address ? String(r.ip_address) : null,
              started_at: Number(r.started_at) || dbLastSeen,
              last_seen_at: dbLastSeen,
              is_online: Number(r.is_online) ?? 1,
            });
          }
        }
      }
    } catch (err) {
      console.warn('getLiveActiveUsers MySQL read warning:', err);
    }
  }

  const allRecords = Array.from(combinedMap.values())
    .map((r) => {
      const elapsedSincePing = Math.max(0, now - r.last_seen_at);
      const isCurrentlyOnline = r.is_online === 1 && elapsedSincePing <= activeWindowMs;
      const isIdle = r.is_online === 1 && elapsedSincePing > activeWindowMs && elapsedSincePing <= activeWindowMs * 3;
      const status: 'online' | 'idle' | 'offline' = isCurrentlyOnline
        ? 'online'
        : isIdle
        ? 'idle'
        : 'offline';
      const activeSeconds = Math.max(1, Math.round((r.last_seen_at - r.started_at) / 1000));
      const secondsSincePing = Math.round(elapsedSincePing / 1000);
      return {
        ...r,
        status,
        active_seconds: activeSeconds,
        seconds_since_ping: secondsSincePing,
      };
    })
    .sort((a, b) => b.last_seen_at - a.last_seen_at);

  const activeUsers = allRecords.filter((r) => r.status === 'online' || r.status === 'idle');
  const recentUsers = allRecords.filter((r) => r.status === 'offline').slice(0, 30);

  return {
    activeUsers,
    recentUsers,
    serverTimestamp: now,
  };
}



