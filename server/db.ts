import initSqlJs, { type Database } from 'sql.js';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as XLSX from 'xlsx';
import type {
  SourceRow,
  UploadRecord,
  FilterParams,
  OperationalSettings,
  AuditLogEntry,
  UserRole,
  RestorePoint,
  SchedulingAnalyticsData,
  SchedulingBatchItem
} from './types.ts';
import {
  getActiveEngine,
  setActiveEngine,
  queryMysql,
  runMysql,
  isMysqlConnected,
  getMysqlPool,
  getMysqlDataVersion,
  bumpMysqlDataVersion,
  insertScheduledVsConductedToMysql,
  getScheduledVsConductedFromMysql,
  getSchedulingAnalyticsFromMysql,
  getBatchSessionDetailsFromMysql,
  insertSlotReplacementToMysql,
  getSlotReplacementsFromMysql,
  insertChallengesToMysql,
  getChallengesFromMysql,
} from './mysql.ts';

let dbInstance: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;
const DB_FILE_PATH = path.join(os.tmpdir(), 'ae_insight_database.sqlite');
let sqliteDataVersion = 0;
let saveDbTimer: ReturnType<typeof setTimeout> | null = null;

export function getSqliteDataVersion(): number {
  return sqliteDataVersion;
}

export function bumpSqliteDataVersion(): void {
  sqliteDataVersion++;
}

export function saveDbToDisk(immediate = false) {
  sqliteDataVersion++;
  if (!dbInstance) return;

  const flushToDisk = () => {
    saveDbTimer = null;
    if (!dbInstance) return;
    try {
      const data = dbInstance.export();
      fs.writeFileSync(DB_FILE_PATH, Buffer.from(data));
    } catch (err) {
      console.error('Failed to save database to disk:', err);
    }
  };

  if (immediate) {
    if (saveDbTimer) {
      clearTimeout(saveDbTimer);
      saveDbTimer = null;
    }
    flushToDisk();
    return;
  }

  if (saveDbTimer) {
    clearTimeout(saveDbTimer);
  }
  saveDbTimer = setTimeout(flushToDisk, 1500);
}

// Unified Database Query Runner for MySQL and SQLite
export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (getActiveEngine() === 'mysql') {
    try {
      return await queryMysql<T>(sql, params);
    } catch (err: any) {
      console.error('MySQL query failed, falling back to SQLite:', err.message);
      if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
        setActiveEngine('sqlite');
      } else {
        throw err;
      }
    }
  }

  const db = await getDb();
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params.map(p => p === undefined ? null : p));
  }
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

// Unified Database Command Runner (INSERT / UPDATE / DELETE)
export async function dbRun(sql: string, params: any[] = []): Promise<any> {
  if (getActiveEngine() === 'mysql') {
    try {
      await runMysql(sql, params);
    } catch (err: any) {
      console.error('MySQL run failed:', err.message);
      if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
        setActiveEngine('sqlite');
      } else {
        throw err;
      }
    }
  }

  const db = await getDb();
  db.run(sql, params.map(p => p === undefined ? null : p));
  saveDbToDisk();
}

export const defaultSettings: OperationalSettings = {
  attendanceThreshold: 0.75, // 75%
  completionThreshold: 0.80, // 80%
  batchDelayThresholdDays: 0,
  dropoutAlertThreshold: 0.15, // 15%
  enableFacultyDeploymentIndex: true,
};

let currentSettings: OperationalSettings = { ...defaultSettings };

let lastMysqlSyncCheckTime = 0;
let activeSyncPromise: Promise<number> | null = null;

export async function syncMysqlToSqlite(db?: Database): Promise<number> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    const targetDb = db || dbInstance || (await getDb());
    try {
      const pool = await getMysqlPool();
      if (!pool) return 0;

      const [cntRows]: any = await pool.query('SELECT count(*) as cnt FROM raw_records');
      const mysqlCount = Number(cntRows?.[0]?.cnt || 0);
      const [uploads]: any = await pool.query('SELECT * FROM uploads ORDER BY uploaded_at DESC');

      if (mysqlCount === 0 && (!uploads || uploads.length === 0)) {
        return 0;
      }

      const [rows]: any = mysqlCount > 0 ? await pool.query('SELECT * FROM raw_records') : [[]];

      targetDb.run('BEGIN TRANSACTION;');
      targetDb.run('DELETE FROM raw_records;');
      targetDb.run('DELETE FROM uploads;');

      const insertUpload = targetDb.prepare(`
        INSERT INTO uploads (
          id, file_name, sheet_name, uploaded_by, uploaded_at, row_count,
          valid_row_count, invalid_row_count, duplicate_count, processing_status,
          processing_duration_ms, source_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const u of uploads || []) {
        insertUpload.run([
          u.id ?? null, u.file_name ?? null, u.sheet_name ?? null, u.uploaded_by ?? null, u.uploaded_at ?? null,
          u.row_count ?? 0, u.valid_row_count ?? 0, u.invalid_row_count ?? 0, u.duplicate_count ?? 0,
          u.processing_status ?? 'completed', u.processing_duration_ms ?? 0, u.source_hash ?? ''
        ].map(v => v === undefined ? null : v));
      }
      insertUpload.free();

      if (rows && rows.length > 0) {
        const insertStmt = targetDb.prepare(`
          INSERT INTO raw_records (
            id, center_code, funder_name, program_name, assigned_trainers, assigned_ae, rm_sh_zh,
            batch_code, course_code, batch_start_date, batch_initial_start_date, batch_initial_end_date,
            batch_end_date, batch_actual_end_date, batch_status, batch_validation_status,
            student_code, enrollment_status, dropout_type, email_verification_status,
            final_exam_marks, placement_type, exam_schedule_date, ilt_completion, ilt_as_on_joining_date,
            fm_class_completion, running_attendance, beneficiary_class_attendance,
            incomplete_attendance_exception, incomplete_module_exception, special_case, joining_date, validation_status,
            validation_done_by, upload_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const r of rows) {
          insertStmt.run([
            r.id ?? null, r.center_code ?? null, r.funder_name ?? null, r.program_name ?? null, r.assigned_trainers ?? null, r.assigned_ae ?? null, r.rm_sh_zh ?? null,
            r.batch_code ?? null, r.course_code ?? null, r.batch_start_date ?? null, r.batch_initial_start_date ?? null, r.batch_initial_end_date ?? null,
            r.batch_end_date ?? null, r.batch_actual_end_date ?? null, r.batch_status ?? null, r.batch_validation_status ?? null, r.student_code ?? null,
            r.enrollment_status ?? null, r.dropout_type ?? null, r.email_verification_status ?? null, r.final_exam_marks ?? null, r.placement_type ?? null,
            r.exam_schedule_date ?? null, r.ilt_completion ?? null, r.ilt_as_on_joining_date ?? null, r.fm_class_completion ?? null, r.running_attendance ?? null,
            r.beneficiary_class_attendance ?? null, r.incomplete_attendance_exception ?? 0, r.incomplete_module_exception ?? 0,
            r.special_case ?? null, r.joining_date ?? null, r.validation_status ?? null, r.validation_done_by ?? null, r.upload_id ?? null
          ].map(v => v === undefined ? null : v));
        }
        insertStmt.free();
      }

      targetDb.run('COMMIT;');

      // Synchronize lightweight distinct batch/center/program tuples from scheduled_vs_conducted for filter hierarchy
      try {
        const [svcRows]: any = await pool.query(`
          SELECT DISTINCT batch_code, actual_center_code, program_name
          FROM scheduled_vs_conducted
          WHERE batch_code IS NOT NULL AND TRIM(batch_code) != ''
        `);
        if (svcRows && svcRows.length > 0) {
          targetDb.run('BEGIN TRANSACTION;');
          targetDb.run('DELETE FROM scheduled_vs_conducted;');
          const insertSvcStmt = targetDb.prepare(`
            INSERT INTO scheduled_vs_conducted (
              batch_code, actual_center_code, program_name
            ) VALUES (?, ?, ?)
          `);
          for (const s of svcRows) {
            insertSvcStmt.run([
              s.batch_code ?? null,
              s.actual_center_code ?? null,
              s.program_name ?? null
            ]);
          }
          insertSvcStmt.free();
          targetDb.run('COMMIT;');
        }
      } catch (e: any) {
        try { targetDb.run('ROLLBACK;'); } catch {}
        console.warn('scheduled_vs_conducted sync warning:', e.message);
      }

      // Synchronize lightweight distinct batch/center tuples from slot_replacement for filter hierarchy
      try {
        const [srRows]: any = await pool.query(`
          SELECT DISTINCT batch_code, center_code
          FROM slot_replacement
          WHERE batch_code IS NOT NULL AND TRIM(batch_code) != ''
        `);
        if (srRows && srRows.length > 0) {
          targetDb.run('BEGIN TRANSACTION;');
          targetDb.run('DELETE FROM slot_replacement;');
          const insertSrStmt = targetDb.prepare(`
            INSERT INTO slot_replacement (
              batch_code, center_code
            ) VALUES (?, ?)
          `);
          for (const sr of srRows) {
            insertSrStmt.run([
              sr.batch_code ?? null,
              sr.center_code ?? null
            ]);
          }
          insertSrStmt.free();
          targetDb.run('COMMIT;');
        }
      } catch (e: any) {
        try { targetDb.run('ROLLBACK;'); } catch {}
        console.warn('slot_replacement sync warning:', e.message);
      }

      // Synchronize challenges if MySQL count differs from SQLite count
      try {
        const [chCntRes]: any = await pool.query('SELECT count(*) as count FROM challenges');
        const mysqlChCount = Number(chCntRes?.[0]?.count || 0);
        let sqliteChCount = 0;
        try {
          const res = targetDb.exec('SELECT count(*) FROM challenges');
          sqliteChCount = Number(res[0]?.values[0]?.[0] || 0);
        } catch {}

        if (mysqlChCount > 0 && mysqlChCount !== sqliteChCount) {
          const [chRows]: any = await pool.query('SELECT * FROM challenges');
          targetDb.run('BEGIN TRANSACTION;');
          targetDb.run('DELETE FROM challenges;');
          const insertChStmt = targetDb.prepare(`
            INSERT INTO challenges (
              sl_no, rm_name, challenges, impact, upload_id, uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const ch of chRows) {
            insertChStmt.run([
              ch.sl_no ?? null, ch.rm_name ?? null, ch.challenges ?? null,
              ch.impact ?? null, ch.upload_id ?? null, ch.uploaded_by ?? null
            ]);
          }
          insertChStmt.free();
          targetDb.run('COMMIT;');
        }
      } catch (e: any) {
        try { targetDb.run('ROLLBACK;'); } catch {}
        console.warn('challenges sync warning:', e.message);
      }

      // Synchronize Exception_App_Rpt using in-memory student_code set to avoid slow unindexed LOWER(TRIM()) MySQL joins
      try {
        const rawStudentCodeSet = new Set<string>();
        for (const r of rows || []) {
          const sc = String(r.student_code || '').trim().toLowerCase();
          if (sc) rawStudentCodeSet.add(sc);
        }

        const [allExRows]: any = await pool.query('SELECT * FROM Exception_App_Rpt');
        const exRows = (allExRows || []).filter((e: any) => {
          const sc = String(e.student_code || '').trim().toLowerCase();
          return sc && rawStudentCodeSet.has(sc);
        });

        targetDb.run('BEGIN TRANSACTION;');
        targetDb.run('DELETE FROM Exception_App_Rpt;');
        const insertExStmt = targetDb.prepare(`
          INSERT INTO Exception_App_Rpt (
            id, date, batch_code, student_code, student_name, center_code, center_name,
            reason, remarks, status, created_by, created_by_email, cm_name, cm_email,
            approval_remarks, approved_by, approved_by_email, approved_date,
            exception_remove_status, exception_remove_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of exRows) {
          insertExStmt.run([
            r.id ?? null, r.date ?? null, r.batch_code ?? null, r.student_code ?? null, r.student_name ?? null,
            r.center_code ?? null, r.center_name ?? null, r.reason ?? null, r.remarks ?? null,
            r.status ?? null, r.created_by ?? null, r.created_by_email ?? null, r.cm_name ?? null,
            r.cm_email ?? null, r.approval_remarks ?? null, r.approved_by ?? null,
            r.approved_by_email ?? null, r.approved_date ?? null, r.exception_remove_status ?? null,
            r.exception_remove_date ?? null
          ].map(v => v === undefined ? null : v));
        }
        insertExStmt.free();
        targetDb.run('COMMIT;');
      } catch (e: any) {
        try { targetDb.run('ROLLBACK;'); } catch {}
        console.warn('Exception_App_Rpt sync warning:', e.message);
      }

      resyncExceptionStatuses(targetDb);
      cachedFilterOptions = null;
      sqliteSchedulingAnalyticsCache.clear();
      sqliteScheduledRecordsCache.clear();
      cachedSqliteSchedulingMeta = null;
      bumpSqliteDataVersion();
      bumpMysqlDataVersion();
      saveDbToDisk();
      lastMysqlSyncCheckTime = Date.now();
      console.log(`[Database Sync] Synchronized ${mysqlCount} raw_records and ${(uploads || []).length} uploads from MySQL to local analytics store.`);

      return mysqlCount;
    } catch (err: any) {
      console.error('Failed to sync MySQL to SQLite:', err);
      try { targetDb.run('ROLLBACK;'); } catch (e) {}
      return 0;
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

export async function ensureMysqlSyncedWithSqlite(db?: Database, force = false): Promise<void> {
  if (!(getActiveEngine() === 'mysql' || process.env.MYSQL_HOST)) return;
  if (!force && Date.now() - lastMysqlSyncCheckTime < 15000) return;

  const targetDb = db || dbInstance;
  if (!targetDb) return;

  lastMysqlSyncCheckTime = Date.now();

  try {
    const pool = await getMysqlPool();
    if (!pool) return;

    const [mysqlUpRes]: any = await pool.query('SELECT id, file_name, uploaded_at, row_count FROM uploads ORDER BY uploaded_at DESC LIMIT 1');
    const [mysqlCntRes]: any = await pool.query('SELECT count(*) as cnt FROM raw_records');
    const mysqlLatest = mysqlUpRes?.[0] || null;
    const mysqlRawCount = Number(mysqlCntRes?.[0]?.cnt || 0);

    let sqliteLatestId: string | null = null;
    let sqliteLatestFile: string | null = null;
    let sqliteLatestAt: string | null = null;
    let sqliteRawCount = 0;

    try {
      const upStmt = targetDb.prepare('SELECT id, file_name, uploaded_at FROM uploads ORDER BY uploaded_at DESC LIMIT 1');
      if (upStmt.step()) {
        const obj = upStmt.getAsObject() as any;
        sqliteLatestId = obj.id ? String(obj.id) : null;
        sqliteLatestFile = obj.file_name ? String(obj.file_name) : null;
        sqliteLatestAt = obj.uploaded_at ? String(obj.uploaded_at) : null;
      }
      upStmt.free();

      const cntRes = targetDb.exec('SELECT count(*) FROM raw_records');
      sqliteRawCount = Number(cntRes[0]?.values[0]?.[0] || 0);
    } catch {}

    const uploadMismatch =
      mysqlLatest &&
      (mysqlLatest.id !== sqliteLatestId ||
        mysqlLatest.file_name !== sqliteLatestFile ||
        mysqlLatest.uploaded_at !== sqliteLatestAt);

    const countMismatch = mysqlRawCount > 0 && mysqlRawCount !== sqliteRawCount;

    if (force || uploadMismatch || countMismatch) {
      console.log(
        `[Database Sync] Detected divergence between MySQL (upload=${mysqlLatest?.file_name || 'none'} @ ${mysqlLatest?.uploaded_at || 'none'}, rows=${mysqlRawCount}) and local SQLite (upload=${sqliteLatestFile || 'none'} @ ${sqliteLatestAt || 'none'}, rows=${sqliteRawCount}). Syncing now...`
      );
      await syncMysqlToSqlite(targetDb);
    }
  } catch (e: any) {
    console.warn('MySQL freshness check skipped:', e?.message || e);
  }
}

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    if (getActiveEngine() === 'mysql' || process.env.MYSQL_HOST) {
      // Trigger non-blocking background freshness check so API requests never stall
      ensureMysqlSyncedWithSqlite(dbInstance, false).catch(() => {});
    }
    return dbInstance;
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = (async () => {
    try {
      const legacyWorkspaceDbPath = path.join(process.cwd(), 'database.sqlite');
      if (fs.existsSync(legacyWorkspaceDbPath)) {
        fs.unlinkSync(legacyWorkspaceDbPath);
      }
    } catch {}
    const SQL = await initSqlJs();
    let db: Database;
    if (fs.existsSync(DB_FILE_PATH)) {
      try {
        const fileBuffer = fs.readFileSync(DB_FILE_PATH);
        db = new SQL.Database(fileBuffer);
      } catch (e) {
        console.error('Failed to load database from disk, creating new:', e);
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
    }

    // Create MySQL / Relational compatible tables
    db.run(`
    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      valid_row_count INTEGER NOT NULL,
      invalid_row_count INTEGER NOT NULL,
      duplicate_count INTEGER NOT NULL,
      processing_status TEXT NOT NULL,
      processing_duration_ms INTEGER NOT NULL,
      source_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS raw_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      center_code TEXT,
      funder_name TEXT,
      program_name TEXT,
      assigned_trainers TEXT,
      assigned_ae TEXT,
      rm_sh_zh TEXT,
      batch_code TEXT,
      course_code TEXT,
      batch_start_date TEXT,
      batch_initial_start_date TEXT,
      batch_initial_end_date TEXT,
      batch_end_date TEXT,
      batch_actual_end_date TEXT,
      batch_status TEXT,
      batch_validation_status TEXT,
      student_code TEXT,
      enrollment_status TEXT,
      dropout_type TEXT,
      email_verification_status TEXT,
      final_exam_marks REAL,
      placement_type TEXT,
      exam_schedule_date TEXT,
      ilt_completion REAL,
      ilt_as_on_joining_date REAL,
      fm_class_completion REAL,
      running_attendance REAL,
      beneficiary_class_attendance REAL,
      incomplete_attendance_exception INTEGER,
      incomplete_module_exception INTEGER,
      special_case TEXT,
      joining_date TEXT,
      validation_status TEXT,
      validation_done_by TEXT,
      upload_id TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      upload_id TEXT,
      details TEXT NOT NULL,
      result TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Exception_App_Rpt (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      batch_code TEXT,
      student_code TEXT,
      student_name TEXT,
      center_code TEXT,
      center_name TEXT,
      reason TEXT,
      remarks TEXT,
      status TEXT,
      created_by TEXT,
      created_by_email TEXT,
      cm_name TEXT,
      cm_email TEXT,
      approval_remarks TEXT,
      approved_by TEXT,
      approved_by_email TEXT,
      approved_date TEXT,
      exception_remove_status TEXT,
      exception_remove_date TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ex_student ON Exception_App_Rpt(student_code);
    CREATE INDEX IF NOT EXISTS idx_ex_batch ON Exception_App_Rpt(batch_code);

    CREATE INDEX IF NOT EXISTS idx_raw_student ON raw_records(student_code);
    CREATE INDEX IF NOT EXISTS idx_raw_batch ON raw_records(batch_code);
    CREATE INDEX IF NOT EXISTS idx_raw_center ON raw_records(center_code);
    CREATE INDEX IF NOT EXISTS idx_raw_trainer ON raw_records(assigned_trainers);
    CREATE INDEX IF NOT EXISTS idx_raw_ae ON raw_records(assigned_ae);
    CREATE INDEX IF NOT EXISTS idx_raw_status ON raw_records(batch_status);
    CREATE INDEX IF NOT EXISTS idx_raw_enrollment ON raw_records(enrollment_status);

    CREATE TABLE IF NOT EXISTS scheduled_vs_conducted (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_date TEXT,
      fm_email_id TEXT,
      batch_code TEXT,
      actual_center_code TEXT,
      program_name TEXT,
      gmeet_id TEXT,
      batch_status TEXT,
      actual_status TEXT,
      schedule_class_start_time TEXT,
      actual_class_started TEXT,
      schedule_class_end_time TEXT,
      actual_class_ended TEXT,
      class_link TEXT,
      form_status TEXT,
      upload_id TEXT,
      uploaded_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_svc_slot_date ON scheduled_vs_conducted(slot_date);
    CREATE INDEX IF NOT EXISTS idx_svc_fm_email ON scheduled_vs_conducted(fm_email_id);
    CREATE INDEX IF NOT EXISTS idx_svc_batch_code ON scheduled_vs_conducted(batch_code);
    CREATE INDEX IF NOT EXISTS idx_svc_actual_center ON scheduled_vs_conducted(actual_center_code);
    CREATE INDEX IF NOT EXISTS idx_svc_upload_id ON scheduled_vs_conducted(upload_id);

    CREATE TABLE IF NOT EXISTS slot_replacement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_code TEXT,
      trainer_name TEXT,
      batch_code TEXT,
      alias TEXT,
      actual_class_date TEXT,
      replacement_class_date TEXT,
      center_code TEXT,
      center_name TEXT,
      approved_rejected_by TEXT,
      approval_rejected_date TEXT,
      requested_date TEXT,
      request_status TEXT,
      reason TEXT,
      upload_id TEXT,
      uploaded_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sr_emp_code ON slot_replacement(emp_code);
    CREATE INDEX IF NOT EXISTS idx_sr_batch_code ON slot_replacement(batch_code);
    CREATE INDEX IF NOT EXISTS idx_sr_center_code ON slot_replacement(center_code);
    CREATE INDEX IF NOT EXISTS idx_sr_request_status ON slot_replacement(request_status);
    CREATE INDEX IF NOT EXISTS idx_sr_upload_id ON slot_replacement(upload_id);

    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sl_no TEXT,
      rm_name TEXT,
      challenges TEXT,
      impact TEXT,
      upload_id TEXT,
      uploaded_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_challenges_sl_no ON challenges(sl_no);
    CREATE INDEX IF NOT EXISTS idx_challenges_upload_id ON challenges(upload_id);
  `);

  // Ensure special_case, joining_date, and ilt_as_on_joining_date columns exist if database.sqlite was previously created on disk
  try {
    db.run(`ALTER TABLE raw_records ADD COLUMN special_case TEXT;`);
  } catch (e) {
    // Column already exists or table was freshly created
  }
  try {
    db.run(`ALTER TABLE raw_records ADD COLUMN joining_date TEXT;`);
  } catch (e) {
    // Column already exists or table was freshly created
  }
  try {
    db.run(`ALTER TABLE raw_records ADD COLUMN ilt_as_on_joining_date REAL;`);
  } catch (e) {
    // Column already exists or table was freshly created
  }

  const changedCount = resyncExceptionStatuses(db);
  if (changedCount > 0) {
    dbInstance = db;
    saveDbToDisk();
  } else {
    dbInstance = db;
  }

  let existingCount = 0;
  try {
    const cntRes = db.exec('SELECT count(*) FROM raw_records');
    existingCount = Number(cntRes[0]?.values[0]?.[0] || 0);
  } catch {}

  if (getActiveEngine() === 'mysql' || process.env.MYSQL_HOST) {
    if (existingCount === 0) {
      try {
        await ensureMysqlSyncedWithSqlite(db, true);
      } catch (e: any) {
        console.warn('Initial auto sync from MySQL skipped:', e?.message || e);
      }
    } else {
      // Database already has records on disk; verify MySQL freshness asynchronously in background
      ensureMysqlSyncedWithSqlite(db, false).catch((e) => {
        console.warn('Background MySQL freshness check warning:', e?.message || e);
      });
    }
  }

  return db;
  })();

  return dbInitPromise;
}

export function resyncExceptionStatuses(db: Database): number {
  try {
    const stmt = db.prepare(`
      SELECT id, enrollment_status, batch_status, program_name, placement_type,
             ilt_completion, ilt_as_on_joining_date, fm_class_completion, beneficiary_class_attendance, running_attendance,
             dropout_type, final_exam_marks, special_case, joining_date, batch_actual_end_date,
             validation_status, incomplete_attendance_exception
      FROM raw_records
    `);
    const updates: { id: number; isException: number }[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      const evalRes = evaluateStudentExceptionLogic(row);
      const currentVal = Number(row.incomplete_attendance_exception) || 0;
      if (currentVal !== evalRes.isException && row.id !== undefined && row.id !== null) {
        updates.push({ id: Number(row.id), isException: evalRes.isException });
      }
    }
    stmt.free();

    if (updates.length > 0) {
      db.run('BEGIN TRANSACTION;');
      const updateStmt = db.prepare(`UPDATE raw_records SET incomplete_attendance_exception = ? WHERE id = ?`);
      for (const u of updates) {
        updateStmt.run([u.isException, u.id]);
      }
      updateStmt.free();
      db.run('COMMIT;');

      // Also keep MySQL raw_records in sync if connected
      if (getActiveEngine() === 'mysql' || process.env.MYSQL_HOST) {
        getMysqlPool().then(async (pool) => {
          if (!pool) return;
          try {
            const setOnes = updates.filter(u => u.isException === 1).map(u => u.id);
            const setZeros = updates.filter(u => u.isException === 0).map(u => u.id);
            for (let i = 0; i < setOnes.length; i += 500) {
              await pool.query('UPDATE raw_records SET incomplete_attendance_exception = 1 WHERE id IN (?)', [setOnes.slice(i, i + 500)]);
            }
            for (let i = 0; i < setZeros.length; i += 500) {
              await pool.query('UPDATE raw_records SET incomplete_attendance_exception = 0 WHERE id IN (?)', [setZeros.slice(i, i + 500)]);
            }
          } catch (err: any) {
            console.warn('MySQL exception status sync warning:', err?.message || err);
          }
        }).catch(() => {});
      }
      return updates.length;
    }
    return 0;
  } catch (e: any) {
    console.warn('resyncExceptionStatuses warning:', e?.message || e);
    return 0;
  }
}

export async function clearAllData(user_email = 'arnab.roy@anudip.org') {
  if (getActiveEngine() === 'mysql' || process.env.MYSQL_HOST) {
    try {
      const pool = await getMysqlPool();
      if (pool) {
        await pool.query('DELETE FROM raw_records');
        await pool.query('DELETE FROM uploads');
        await pool.query('DELETE FROM audit_logs');
        await pool.query('DELETE FROM scheduled_vs_conducted');
        await pool.query('DELETE FROM slot_replacement');
        await pool.query('DELETE FROM Exception_App_Rpt');
      }
    } catch (e: any) {
      console.error('Failed to clear MySQL tables:', e.message);
    }
  }
  const db = await getDb();
  db.run(`DELETE FROM raw_records;`);
  db.run(`DELETE FROM uploads;`);
  db.run(`DELETE FROM audit_logs;`);
  db.run(`DELETE FROM scheduled_vs_conducted;`);
  db.run(`DELETE FROM slot_replacement;`);
  db.run(`DELETE FROM Exception_App_Rpt;`);
  try {
    db.run(`DELETE FROM sqlite_sequence;`);
  } catch (e) {
    // sqlite_sequence might not exist if no autoincrement yet
  }

  // Invalidate all in-memory caches
  sqliteSchedulingAnalyticsCache.clear();
  sqliteScheduledRecordsCache.clear();
  cachedSqliteSchedulingMeta = null;
  cachedFilterOptions = null;
  bumpSqliteDataVersion();
  bumpMysqlDataVersion();

  logAudit(user_email, 'Admin', 'CLEAR_ALL_DATA', 'All operational records, audit_logs, raw_records, scheduled_vs_conducted, slot_replacement, uploads, and exceptions were cleared from the database.', 'success');
  saveDbToDisk();
}

export async function seedSampleData(user_email = 'arnab.roy@anudip.org') {
  const db = await getDb();
  await seedInitialData(db);
  saveDbToDisk();
  logAudit(user_email, 'Admin', 'Sample Data Seeded', 'Populated portal with sample Anudip operational dataset', 'success');
}

export function getSettings(): OperationalSettings {
  return currentSettings;
}

export function updateSettings(newSettings: Partial<OperationalSettings>): OperationalSettings {
  currentSettings = { ...currentSettings, ...newSettings };
  logAudit('arnab.roy@anudip.org', 'Admin', 'Settings Updated', `Updated thresholds: ${JSON.stringify(newSettings)}`, 'success');
  return currentSettings;
}

export function logAudit(user_email: string, user_role: string, action: string, details: string, result: 'success' | 'warning' | 'error' = 'success', upload_id?: string) {
  if (!dbInstance) return;
  const id = 'AUD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const timestamp = new Date().toISOString();
  dbInstance.run(
    `INSERT INTO audit_logs (id, user_email, user_role, action, timestamp, upload_id, details, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, user_email, user_role, action, timestamp, upload_id || null, details, result]
  );
}

export function getAuditLogs(limit = 100): AuditLogEntry[] {
  if (!dbInstance) return [];
  const stmt = dbInstance.prepare(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?`);
  stmt.bind([limit]);
  const rows: AuditLogEntry[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as AuditLogEntry);
  }
  stmt.free();
  return rows;
}

export function getUploadHistory(): UploadRecord[] {
  if (!dbInstance) return [];
  const stmt = dbInstance.prepare(`SELECT * FROM uploads ORDER BY uploaded_at DESC`);
  const rows: UploadRecord[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as UploadRecord);
  }
  stmt.free();
  return rows;
}

export async function getUploadHistoryAsync(): Promise<UploadRecord[]> {
  const db = await getDb();
  if (getActiveEngine() === 'mysql' || process.env.MYSQL_HOST) {
    try {
      const pool = await getMysqlPool();
      if (pool) {
        const [mysqlUploads]: any = await pool.query('SELECT * FROM uploads ORDER BY uploaded_at DESC');
        if (Array.isArray(mysqlUploads) && mysqlUploads.length > 0) {
          // Ensure local SQLite uploads table is also kept in sync
          const localUploads = getUploadHistory();
          const latestMysql = mysqlUploads[0];
          const latestLocal = localUploads[0];
          if (
            !latestLocal ||
            latestLocal.id !== latestMysql.id ||
            latestLocal.file_name !== latestMysql.file_name ||
            latestLocal.uploaded_at !== latestMysql.uploaded_at
          ) {
            try {
              db.run('BEGIN TRANSACTION;');
              db.run('DELETE FROM uploads;');
              const insertUpload = db.prepare(`
                INSERT INTO uploads (
                  id, file_name, sheet_name, uploaded_by, uploaded_at, row_count,
                  valid_row_count, invalid_row_count, duplicate_count, processing_status,
                  processing_duration_ms, source_hash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);
              for (const u of mysqlUploads) {
                insertUpload.run([
                  u.id ?? null, u.file_name ?? null, u.sheet_name ?? null, u.uploaded_by ?? null, u.uploaded_at ?? null,
                  u.row_count ?? 0, u.valid_row_count ?? 0, u.invalid_row_count ?? 0, u.duplicate_count ?? 0,
                  u.processing_status ?? 'completed', u.processing_duration_ms ?? 0, u.source_hash ?? ''
                ]);
              }
              insertUpload.free();
              db.run('COMMIT;');
              saveDbToDisk();
            } catch {
              try { db.run('ROLLBACK;'); } catch {}
            }
          }
          return mysqlUploads as UploadRecord[];
        }
      }
    } catch (e: any) {
      console.warn('getUploadHistoryAsync MySQL query fallback to SQLite:', e?.message || e);
    }
  }
  return getUploadHistory();
}

// Build SQL filter clause
export function buildFilterWhere(filters: FilterParams, options?: { restrictDeepTech?: boolean }): { where: string; params: any[] } {
  const clauses: string[] = ['1=1'];
  const params: any[] = [];

  const shouldRestrictDeepTech = Boolean(
    options?.restrictDeepTech ||
    filters.restrictDeepTech ||
    filters.module === 'dropout' ||
    filters.module === 'exception' ||
    filters.module === 'batch_closure' ||
    filters.module === 'closure' ||
    filters.module === 'trained' ||
    filters.module === 'running_batch' ||
    filters.module === 'closed_batch'
  );

  const isDeepTech = `(
    LOWER(TRIM(COALESCE(program_name, ''))) LIKE '%deep%tech%'
    OR LOWER(TRIM(COALESCE(program_name, ''))) LIKE '%deeptech%'
    OR LOWER(TRIM(COALESCE(program_name, ''))) = 'deep tech'
    OR LOWER(TRIM(COALESCE(program_name, ''))) = 'deeptech'
    OR LOWER(TRIM(COALESCE(batch_code, ''))) LIKE '%deep%tech%'
    OR LOWER(TRIM(COALESCE(batch_code, ''))) LIKE '%deeptech%'
  )`;

  // Base Deep Tech condition across all records
  const deepTechGeneralCondition = `(
    ${isDeepTech}
    AND LOWER(TRIM(COALESCE(program_name, ''))) NOT LIKE '%diya%'
    AND LOWER(TRIM(COALESCE(batch_code, ''))) NOT LIKE '%diya%'
  )`;

  // Deep Tech condition restricted to only 3 Regional Managers and 3 Funders
  // (strictly applied for dropout, exception, batch closure per business requirement)
  const deepTechRestrictedCondition = `(
    ${deepTechGeneralCondition}
    AND LOWER(TRIM(COALESCE(rm_sh_zh, ''))) IN ('krishna sadhan adhikari', 'pradip kumar biswas', 'vivek kumar')
    AND (
      LOWER(TRIM(COALESCE(funder_name, ''))) LIKE '%dbs%'
      OR LOWER(TRIM(COALESCE(funder_name, ''))) LIKE '%wells fargo%'
      OR LOWER(TRIM(COALESCE(funder_name, ''))) LIKE '%s&y%'
    )
  )`;

  const deepTechCondition = shouldRestrictDeepTech ? deepTechRestrictedCondition : deepTechGeneralCondition;

  // Diya programs: matches all non-DeepTech records in raw_records (full Diya operational dataset)
  const diyaCondition = `(NOT ${isDeepTech})`;

  // Diya and Deep Tech logic: full combined dataset for general views, restricted dataset for dropout/exception/batch closure
  const diyaAndDeepTechCondition = shouldRestrictDeepTech
    ? `(${diyaCondition} OR ${deepTechRestrictedCondition})`
    : `(${deepTechGeneralCondition} OR ${diyaCondition})`;

  const effectiveCenters = (filters.centerCodes && filters.centerCodes.length > 0)
    ? filters.centerCodes.filter(c => c && c !== 'ALL')
    : (filters.centerCode && filters.centerCode !== 'ALL')
      ? filters.centerCode.split(',').map(c => c.trim()).filter(c => c && c !== 'ALL')
      : [];

  if (effectiveCenters.length === 1) {
    clauses.push('LOWER(TRIM(center_code)) = LOWER(TRIM(?))');
    params.push(effectiveCenters[0]);
  } else if (effectiveCenters.length > 1) {
    const placeholders = effectiveCenters.map(() => 'LOWER(TRIM(?))').join(', ');
    clauses.push(`LOWER(TRIM(center_code)) IN (${placeholders})`);
    params.push(...effectiveCenters);
  }
  if (filters.funderName && filters.funderName !== 'ALL') {
    clauses.push('LOWER(TRIM(funder_name)) = LOWER(TRIM(?))');
    params.push(filters.funderName);
  }
  const effectiveProgramNames = (filters.programNames && filters.programNames.length > 0)
    ? filters.programNames.filter(p => p && p !== 'ALL')
    : (filters.programName && filters.programName !== 'ALL')
      ? filters.programName.split(',').map(p => p.trim()).filter(p => p && p !== 'ALL')
      : [];

  if (effectiveProgramNames.length === 1) {
    clauses.push('LOWER(TRIM(program_name)) = LOWER(TRIM(?))');
    params.push(effectiveProgramNames[0]);
  } else if (effectiveProgramNames.length > 1) {
    const placeholders = effectiveProgramNames.map(() => 'LOWER(TRIM(?))').join(', ');
    clauses.push(`LOWER(TRIM(program_name)) IN (${placeholders})`);
    params.push(...effectiveProgramNames);
  }
  if (filters.programType && filters.programType !== 'ALL') {
    const pt = filters.programType.trim().toLowerCase();
    if (pt === 'deeptech only' || pt === 'deep tech only') {
      clauses.push(deepTechCondition);
    } else if (pt === 'diya only') {
      // Diya Only: strictly excludes all Deeptech records
      clauses.push(diyaCondition);
    } else if (pt === 'diya and deeptech' || pt === 'diya & deeptech' || pt === 'diya and deep tech') {
      // Diya and Deep Tech
      clauses.push(diyaAndDeepTechCondition);
    }
  } else if (shouldRestrictDeepTech) {
    // If inside dropout, exception, or batch closure and programType is ALL or omitted:
    // any Deep Tech record must strictly follow the 3 RMs and 3 Funders restriction
    clauses.push(`(NOT ${isDeepTech} OR ${deepTechRestrictedCondition})`);
  }
  if (filters.courseCode && filters.courseCode !== 'ALL') {
    clauses.push('course_code = ?');
    params.push(filters.courseCode);
  }
  if (filters.batchCode && filters.batchCode !== 'ALL') {
    clauses.push('batch_code = ?');
    params.push(filters.batchCode);
  }
  if (filters.assignedTrainer && filters.assignedTrainer !== 'ALL') {
    clauses.push('assigned_trainers = ?');
    params.push(filters.assignedTrainer);
  }
  const effectiveAes = (filters.assignedAes && filters.assignedAes.length > 0)
    ? filters.assignedAes.filter(a => a && a !== 'ALL')
    : (filters.assignedAe && filters.assignedAe !== 'ALL')
      ? filters.assignedAe.split(',').map(a => a.trim()).filter(a => a && a !== 'ALL')
      : [];

  if (effectiveAes.length === 1) {
    clauses.push('LOWER(TRIM(assigned_ae)) = LOWER(TRIM(?))');
    params.push(effectiveAes[0]);
  } else if (effectiveAes.length > 1) {
    const placeholders = effectiveAes.map(() => 'LOWER(TRIM(?))').join(', ');
    clauses.push(`LOWER(TRIM(assigned_ae)) IN (${placeholders})`);
    params.push(...effectiveAes);
  }
  const effectiveRms = (filters.rmShZhs && filters.rmShZhs.length > 0)
    ? filters.rmShZhs.filter(r => r && r !== 'ALL')
    : (filters.rmShZh && filters.rmShZh !== 'ALL')
      ? filters.rmShZh.split(',').map(r => r.trim()).filter(r => r && r !== 'ALL')
      : [];

  if (effectiveRms.length > 0) {
    const rmSubClauses: string[] = [];
    for (const rm of effectiveRms) {
      const rmLower = rm.trim().toLowerCase();
      if (rmLower === 'krishna prasad' || rmLower.includes('krishna prasad')) {
        rmSubClauses.push("(LOWER(TRIM(rm_sh_zh)) = 'krishna prasad' OR LOWER(TRIM(rm_sh_zh)) LIKE '%upvan%')");
      } else {
        rmSubClauses.push('LOWER(TRIM(rm_sh_zh)) = LOWER(TRIM(?))');
        params.push(rm.trim());
      }
    }
    clauses.push(`(${rmSubClauses.join(' OR ')})`);
  }
  if (filters.batchStatus && filters.batchStatus !== 'ALL') {
    const bsLower = filters.batchStatus.trim().toLowerCase();
    if (bsLower === 'complete' || bsLower === 'completed') {
      clauses.push("LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed')");
    } else {
      clauses.push("LOWER(TRIM(COALESCE(batch_status, ''))) = LOWER(TRIM(?))");
      params.push(filters.batchStatus);
    }
  }
  if (filters.enrollmentStatus && filters.enrollmentStatus !== 'ALL') {
    clauses.push('LOWER(enrollment_status) = LOWER(?)');
    params.push(filters.enrollmentStatus);
  }
  if (filters.dropoutType && filters.dropoutType !== 'ALL') {
    clauses.push('dropout_type = ?');
    params.push(filters.dropoutType);
  }
  if (filters.batchValidationStatus && filters.batchValidationStatus !== 'ALL') {
    clauses.push('batch_validation_status = ?');
    params.push(filters.batchValidationStatus);
  }
  if (filters.studentValidationStatus && filters.studentValidationStatus !== 'ALL') {
    clauses.push('validation_status = ?');
    params.push(filters.studentValidationStatus);
  }
  if (filters.placementType && filters.placementType !== 'ALL') {
    clauses.push('placement_type = ?');
    params.push(filters.placementType);
  }
  if (filters.studentStatus && filters.studentStatus !== 'ALL') {
    const ss = filters.studentStatus.trim().toLowerCase();
    if (ss === 'running' || ss === 'enrolled') {
      // Enrolled Status = "Enrolled" and Placement Type = " " (blank) -> "Running"
      clauses.push(`(
        LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled'
        AND (TRIM(COALESCE(placement_type, '')) = '' OR TRIM(COALESCE(placement_type, '')) = '—')
      )`);
    } else if (ss === 'placed') {
      // Enrolled Status = "Enrolled" and Placement Type <> " " -> Placed categories
      clauses.push(`(
        LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled'
        AND TRIM(COALESCE(placement_type, '')) != ''
        AND TRIM(COALESCE(placement_type, '')) != '—'
      )`);
    } else if (ss === 'dropped out' || ss === 'dropped_out' || ss === 'droppedout') {
      // Enrollment Status = "dropped out" -> "dropped out"
      clauses.push(`(
        LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'dropped out'
        OR LOWER(TRIM(COALESCE(enrollment_status, ''))) LIKE '%dropped%'
      )`);
    } else {
      // Specific Placement Type category (Placed By Anudip CRD, Placed By Anudip Center/Local, Self Placed, Placed By College/Campus)
      clauses.push(`(
        LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled'
        AND LOWER(TRIM(COALESCE(placement_type, ''))) = LOWER(TRIM(?))
      )`);
      params.push(filters.studentStatus.trim());
    }
  }
  if (filters.hasException === true) {
    clauses.push("incomplete_attendance_exception = 1 AND LOWER(TRIM(COALESCE(validation_status, ''))) NOT LIKE '%special approval%' AND LOWER(TRIM(COALESCE(validation_status, ''))) NOT LIKE '%special approved%'");
  }
  if (filters.specialCase && filters.specialCase !== 'ALL') {
    const sc = String(filters.specialCase).trim().toLowerCase();
    if (sc === '1' || sc === 'special' || sc === 'special_case') {
      clauses.push("(TRIM(COALESCE(special_case, '')) = '1' OR special_case = 1)");
    } else if (sc === '0' || sc === 'blank' || sc === 'standard') {
      clauses.push("(special_case IS NULL OR TRIM(COALESCE(special_case, '')) = '' OR TRIM(COALESCE(special_case, '')) = '0' OR special_case = 0)");
    }
  }
  const normalizedRecordDateExpr = `(CASE
    WHEN COALESCE(NULLIF(TRIM(batch_start_date), ''), NULLIF(TRIM(batch_actual_end_date), ''), NULLIF(TRIM(batch_end_date), '')) IS NULL THEN NULL
    WHEN SUBSTR(COALESCE(NULLIF(TRIM(batch_start_date), ''), NULLIF(TRIM(batch_actual_end_date), ''), NULLIF(TRIM(batch_end_date), '')), 5, 1) IN ('-', '/')
      AND SUBSTR(COALESCE(NULLIF(TRIM(batch_start_date), ''), NULLIF(TRIM(batch_actual_end_date), ''), NULLIF(TRIM(batch_end_date), '')), 8, 1) IN ('-', '/')
      THEN REPLACE(SUBSTR(COALESCE(NULLIF(TRIM(batch_start_date), ''), NULLIF(TRIM(batch_actual_end_date), ''), NULLIF(TRIM(batch_end_date), '')), 1, 10), '/', '-')
    WHEN SUBSTR(COALESCE(NULLIF(TRIM(batch_start_date), ''), NULLIF(TRIM(batch_actual_end_date), ''), NULLIF(TRIM(batch_end_date), '')), 3, 1) IN ('-', '/')
      AND SUBSTR(COALESCE(NULLIF(TRIM(batch_start_date), ''), NULLIF(TRIM(batch_actual_end_date), ''), NULLIF(TRIM(batch_end_date), '')), 6, 1) IN ('-', '/')
      THEN SUBSTR(COALESCE(NULLIF(TRIM(batch_start_date), ''), NULLIF(TRIM(batch_actual_end_date), ''), NULLIF(TRIM(batch_end_date), '')), 7, 4) || '-' ||
           SUBSTR(COALESCE(NULLIF(TRIM(batch_start_date), ''), NULLIF(TRIM(batch_actual_end_date), ''), NULLIF(TRIM(batch_end_date), '')), 4, 2) || '-' ||
           SUBSTR(COALESCE(NULLIF(TRIM(batch_start_date), ''), NULLIF(TRIM(batch_actual_end_date), ''), NULLIF(TRIM(batch_end_date), '')), 1, 2)
    ELSE SUBSTR(COALESCE(NULLIF(TRIM(batch_start_date), ''), NULLIF(TRIM(batch_actual_end_date), ''), NULLIF(TRIM(batch_end_date), '')), 1, 10)
  END)`;

  if (filters.startDate && filters.startDate.trim() !== '') {
    clauses.push(`${normalizedRecordDateExpr} >= ?`);
    params.push(filters.startDate.trim());
  }
  if (filters.endDate && filters.endDate.trim() !== '') {
    clauses.push(`${normalizedRecordDateExpr} <= ?`);
    params.push(filters.endDate.trim());
  }

  return { where: clauses.join(' AND '), params };
}

let cachedFilterOptions: { sqliteVer: number; mysqlVer: number; data: any } | null = null;

// Global Filter Options helper
export async function getFilterOptions() {
  const db = await getDb();
  const curSqliteVer = sqliteDataVersion;
  const curMysqlVer = getMysqlDataVersion();
  if (
    cachedFilterOptions &&
    cachedFilterOptions.sqliteVer === curSqliteVer &&
    cachedFilterOptions.mysqlVer === curMysqlVer
  ) {
    return cachedFilterOptions.data;
  }

  const query = (col: string) => {
    const stmt = db.prepare(`SELECT DISTINCT ${col} as val FROM raw_records WHERE ${col} IS NOT NULL AND ${col} != '' ORDER BY ${col} ASC`);
    const list: string[] = [];
    while (stmt.step()) {
      list.push(stmt.getAsObject().val as string);
    }
    stmt.free();
    return list;
  };

  const placementList = query('placement_type');
  
  // Compute dynamic Student Statuses per formula:
  // IF(Enrollment Status = 'enrolled' AND Placement Type <> ' ', 'Enrolled', IF(Enrollment Status = 'dropped out', 'dropped out', Placement Type))
  const dynamicStudentStatuses: string[] = [];
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT
        CASE
          WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' 
               AND (TRIM(COALESCE(placement_type, '')) = '' OR TRIM(COALESCE(placement_type, '')) = '—')
            THEN 'Running'
          WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'dropped out' 
               OR LOWER(TRIM(COALESCE(enrollment_status, ''))) LIKE '%dropped%' 
            THEN 'dropped out'
          ELSE TRIM(COALESCE(placement_type, ''))
        END as val
      FROM raw_records
      WHERE (enrollment_status IS NOT NULL AND enrollment_status != '')
         OR (placement_type IS NOT NULL AND placement_type != '')
      ORDER BY val ASC
    `);
    while (stmt.step()) {
      const v = (stmt.getAsObject().val as string)?.trim();
      if (v && !dynamicStudentStatuses.includes(v)) {
        dynamicStudentStatuses.push(v);
      }
    }
    stmt.free();
  } catch (err) {
    console.error('Error fetching dynamic student statuses:', err);
  }

  const baseStudentStatuses = ['Running', 'Placed', 'dropped out'];
  const defaultPlacements = [
    'Placed By Anudip CRD',
    'Placed By Anudip Center/Local',
    'Self Placed',
    'Placed By College/Campus'
  ];
  for (const s of baseStudentStatuses) {
    if (!dynamicStudentStatuses.includes(s)) {
      dynamicStudentStatuses.push(s);
    }
  }
  for (const p of placementList) {
    if (p && !dynamicStudentStatuses.includes(p)) {
      dynamicStudentStatuses.push(p);
    }
  }
  for (const dp of defaultPlacements) {
    if (!dynamicStudentStatuses.includes(dp)) {
      dynamicStudentStatuses.push(dp);
    }
  }

  const rawRms = query('rm_sh_zh');
  const filteredRmsSet = new Set<string>();
  for (const r of rawRms) {
    if (!r) continue;
    const lower = r.trim().toLowerCase();
    if (lower.includes('upvan')) {
      filteredRmsSet.add('Krishna Prasad');
      continue;
    }
    filteredRmsSet.add(r.trim());
  }

  // Build RM-Center-Program hierarchy for dynamic filter cascading
  const hierarchySet = new Set<string>();
  const hierarchy: { rm: string; center: string; program: string }[] = [];
  const addTuple = (rmRaw: any, centerRaw: any, progRaw: any) => {
    let rm = String(rmRaw || '').trim();
    const center = String(centerRaw || '').trim();
    const program = String(progRaw || '').trim();
    if (!center || !program) return;
    if (rm.toLowerCase().includes('upvan')) {
      rm = 'Krishna Prasad';
    }
    const key = `${rm}|||${center}|||${program}`;
    if (!hierarchySet.has(key)) {
      hierarchySet.add(key);
      hierarchy.push({ rm, center, program });
    }
  };

  const batchToRmForHierarchy = new Map<string, string>();
  const centerToRmForHierarchy = new Map<string, string>();
  const extraCentersSet = new Set<string>(query('center_code'));
  const extraProgramsSet = new Set<string>(query('program_name'));
  const extraBatchesSet = new Set<string>(query('batch_code'));

  try {
    const hStmt = db.prepare(`
      SELECT batch_code, rm_sh_zh, center_code, program_name
      FROM raw_records
      WHERE center_code IS NOT NULL AND center_code != ''
        AND program_name IS NOT NULL AND program_name != ''
      GROUP BY batch_code, rm_sh_zh, center_code, program_name
    `);
    while (hStmt.step()) {
      const r = hStmt.getAsObject() as any;
      if (r.batch_code && r.rm_sh_zh) {
        batchToRmForHierarchy.set(String(r.batch_code).toLowerCase().trim(), String(r.rm_sh_zh).trim());
      }
      if (r.center_code && r.rm_sh_zh) {
        centerToRmForHierarchy.set(String(r.center_code).toLowerCase().trim(), String(r.rm_sh_zh).trim());
      }
      addTuple(r.rm_sh_zh, r.center_code, r.program_name);
    }
    hStmt.free();
  } catch {}

  try {
    const sStmt = db.prepare(`
      SELECT DISTINCT batch_code, actual_center_code as center_code, program_name
      FROM scheduled_vs_conducted
      WHERE batch_code IS NOT NULL AND TRIM(batch_code) != '' AND LOWER(TRIM(batch_code)) != 'null'
    `);
    while (sStmt.step()) {
      const r = sStmt.getAsObject() as any;
      const bcTrim = String(r.batch_code || '').trim();
      const ccTrim = String(r.center_code || '').trim();
      const pnTrim = String(r.program_name || '').trim();
      if (bcTrim) extraBatchesSet.add(bcTrim);
      if (ccTrim) extraCentersSet.add(ccTrim);
      if (pnTrim) extraProgramsSet.add(pnTrim);

      if (ccTrim && pnTrim) {
        const bcNorm = bcTrim.toLowerCase();
        const ccNorm = ccTrim.toLowerCase();
        const rmName = batchToRmForHierarchy.get(bcNorm) || centerToRmForHierarchy.get(ccNorm) || '';
        addTuple(rmName, ccTrim, pnTrim);
      }
    }
    sStmt.free();
  } catch {}

  try {
    const srStmt = db.prepare(`
      SELECT DISTINCT batch_code, center_code
      FROM slot_replacement
      WHERE batch_code IS NOT NULL AND TRIM(batch_code) != '' AND LOWER(TRIM(batch_code)) != 'null'
    `);
    while (srStmt.step()) {
      const r = srStmt.getAsObject() as any;
      const bcTrim = String(r.batch_code || '').trim();
      const ccTrim = String(r.center_code || '').trim();
      if (bcTrim) extraBatchesSet.add(bcTrim);
      if (ccTrim) extraCentersSet.add(ccTrim);
    }
    srStmt.free();
  } catch {}

  const result = {
    centers: Array.from(extraCentersSet).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    funders: query('funder_name'),
    programs: Array.from(extraProgramsSet).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    courses: query('course_code'),
    batches: Array.from(extraBatchesSet).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    trainers: query('assigned_trainers'),
    aes: query('assigned_ae'),
    rmShZhs: Array.from(filteredRmsSet).sort((a, b) => a.localeCompare(b)),
    batchStatuses: query('batch_status'),
    enrollmentStatuses: query('enrollment_status'),
    studentStatuses: dynamicStudentStatuses,
    dropoutTypes: query('dropout_type'),
    batchValidationStatuses: query('batch_validation_status'),
    studentValidationStatuses: query('validation_status'),
    placementTypes: placementList,
    hierarchy,
  };

  cachedFilterOptions = {
    sqliteVer: curSqliteVer,
    mysqlVer: curMysqlVer,
    data: result,
  };
  return result;
}

// Executive KPI & Overview Analytics
export async function getExecutiveAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const { where, params } = buildFilterWhere(filters);

  // 1. Total Enrollment & Top-level counts
  const countStmt = db.prepare(`
    SELECT
      COUNT(*) as total_students,
      COUNT(DISTINCT batch_code) as total_batches,
      COUNT(DISTINCT center_code) as total_centers,
      COUNT(DISTINCT assigned_trainers) as total_trainers,
      COUNT(DISTINCT assigned_ae) as total_aes,
      COUNT(DISTINCT CASE WHEN LOWER(batch_status) = 'running' THEN batch_code END) as active_batches,
      COUNT(DISTINCT CASE WHEN LOWER(batch_status) = 'complete' OR LOWER(batch_status) = 'completed' THEN batch_code END) as completed_batches,
      COUNT(DISTINCT CASE WHEN LOWER(batch_status) = 'hold' THEN batch_code END) as hold_batches,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as total_dropouts,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as total_trained,
      COUNT(CASE WHEN incomplete_attendance_exception = 1 AND LOWER(TRIM(COALESCE(validation_status, ''))) NOT LIKE '%special approval%' AND LOWER(TRIM(COALESCE(validation_status, ''))) NOT LIKE '%special approved%' THEN 1 END) as total_exceptions,
      COUNT(DISTINCT CASE WHEN (batch_validation_status = 'Fully Validated' OR batch_validation_status = 'Partially Validated') THEN batch_code END) as validated_batches_count,
      COUNT(CASE WHEN (validation_status = 'Validated' OR validation_status = 'ReValidated') THEN 1 END) as validated_students_count,
      COUNT(CASE WHEN validation_status IS NOT NULL AND validation_status != 'Not Available' AND validation_status != '' THEN 1 END) as students_with_validation_status
    FROM raw_records
    WHERE ${where}
  `);
  countStmt.bind(params);
  let summary: any = {};
  if (countStmt.step()) {
    summary = countStmt.getAsObject();
  }
  countStmt.free();

  const totalStudents = Number(summary.total_students) || 0;
  const totalBatches = Number(summary.total_batches) || 0;
  const totalDropouts = Number(summary.total_dropouts) || 0;
  const totalTrained = Number(summary.total_trained) || 0;
  const dropoutRate = totalStudents > 0 ? (totalDropouts / totalStudents) * 100 : 0;
  const trainedRate = totalStudents > 0 ? (totalTrained / totalStudents) * 100 : 0;
  const batchValidationRate = totalBatches > 0 ? (Number(summary.validated_batches_count) / totalBatches) * 100 : 0;
  const studentsWithVal = Number(summary.students_with_validation_status) || 0;
  const studentValidationRate = studentsWithVal > 0 ? (Number(summary.validated_students_count) / studentsWithVal) * 100 : 0;

  // 2. Academic Health Averages
  const academicStmt = db.prepare(`
    SELECT
      AVG(running_attendance) as avg_running_attendance,
      AVG(beneficiary_class_attendance) as avg_beneficiary_attendance,
      AVG(ilt_completion) as avg_ilt_completion,
      AVG(fm_class_completion) as avg_fm_completion,
      AVG(final_exam_marks) as avg_exam_marks,
      COUNT(CASE WHEN final_exam_marks IS NOT NULL THEN 1 END) as students_with_exam_data
    FROM raw_records
    WHERE ${where}
  `);
  academicStmt.bind(params);
  let academicHealth: any = {};
  if (academicStmt.step()) {
    academicHealth = academicStmt.getAsObject();
  }
  academicStmt.free();

  // 3. Attention Areas
  const pendingValidationStmt = db.prepare(`
    SELECT COUNT(CASE WHEN validation_status = 'Pending' THEN 1 END) as pending_validation_count
    FROM raw_records
    WHERE ${where}
  `);
  pendingValidationStmt.bind(params);
  let pendingValCount = 0;
  if (pendingValidationStmt.step()) {
    pendingValCount = Number(pendingValidationStmt.getAsObject().pending_validation_count) || 0;
  }
  pendingValidationStmt.free();

  const lowAttendanceStmt = db.prepare(`
    SELECT COUNT(CASE WHEN (running_attendance < ? OR beneficiary_class_attendance < ?) THEN 1 END) as low_attendance_count
    FROM raw_records
    WHERE ${where}
  `);
  lowAttendanceStmt.bind([...params, currentSettings.attendanceThreshold, currentSettings.attendanceThreshold]);
  let lowAttendanceCount = 0;
  if (lowAttendanceStmt.step()) {
    lowAttendanceCount = Number(lowAttendanceStmt.getAsObject().low_attendance_count) || 0;
  }
  lowAttendanceStmt.free();

  const lowCompletionStmt = db.prepare(`
    SELECT COUNT(CASE WHEN (ilt_completion < ? OR fm_class_completion < ?) THEN 1 END) as low_completion_count
    FROM raw_records
    WHERE ${where}
  `);
  lowCompletionStmt.bind([...params, currentSettings.completionThreshold, currentSettings.completionThreshold]);
  let lowCompletionCount = 0;
  if (lowCompletionStmt.step()) {
    lowCompletionCount = Number(lowCompletionStmt.getAsObject().low_completion_count) || 0;
  }
  lowCompletionStmt.free();

  // Delayed batches count (at distinct batch level)
  const delayedBatchesStmt = db.prepare(`
    SELECT COUNT(DISTINCT batch_code) as delayed_batches_count
    FROM raw_records
    WHERE ${where}
      AND batch_actual_end_date IS NOT NULL
      AND batch_end_date IS NOT NULL
      AND batch_actual_end_date > batch_end_date
  `);
  delayedBatchesStmt.bind(params);
  let delayedBatchesCount = 0;
  if (delayedBatchesStmt.step()) {
    delayedBatchesCount = Number(delayedBatchesStmt.getAsObject().delayed_batches_count) || 0;
  }
  delayedBatchesStmt.free();

  // 4. Batch Status breakdown
  const batchStatusDistStmt = db.prepare(`
    SELECT
      COALESCE(NULLIF(batch_status, ''), 'Unknown') as status,
      COUNT(DISTINCT batch_code) as count
    FROM raw_records
    WHERE ${where}
    GROUP BY status
  `);
  batchStatusDistStmt.bind(params);
  const batchStatusDistribution: { name: string; value: number }[] = [];
  while (batchStatusDistStmt.step()) {
    const row = batchStatusDistStmt.getAsObject();
    batchStatusDistribution.push({ name: row.status as string, value: Number(row.count) });
  }
  batchStatusDistStmt.free();

  // 5. Dropout Type Distribution
  const dropoutTypeDistStmt = db.prepare(`
    SELECT
      COALESCE(NULLIF(dropout_type, ''), 'Unspecified') as type,
      COUNT(*) as count
    FROM raw_records
    WHERE ${where} AND LOWER(enrollment_status) = 'dropped out'
    GROUP BY type
  `);
  dropoutTypeDistStmt.bind(params);
  const dropoutTypeDistribution: { name: string; value: number }[] = [];
  while (dropoutTypeDistStmt.step()) {
    const row = dropoutTypeDistStmt.getAsObject();
    dropoutTypeDistribution.push({ name: row.type as string, value: Number(row.count) });
  }
  dropoutTypeDistStmt.free();

  // 6. Center-wise Top Dropouts
  const centerDropoutStmt = db.prepare(`
    SELECT
      center_code,
      COUNT(*) as students,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropouts,
      COUNT(DISTINCT batch_code) as batches
    FROM raw_records
    WHERE ${where}
    GROUP BY center_code
    ORDER BY dropouts DESC
    LIMIT 10
  `);
  centerDropoutStmt.bind(params);
  const centerDropoutRanking: any[] = [];
  while (centerDropoutStmt.step()) {
    const row = centerDropoutStmt.getAsObject();
    const s = Number(row.students) || 0;
    const d = Number(row.dropouts) || 0;
    centerDropoutRanking.push({
      center_code: row.center_code,
      students: s,
      dropouts: d,
      batches: Number(row.batches) || 0,
      dropout_rate: s > 0 ? (d / s) * 100 : 0
    });
  }
  centerDropoutStmt.free();

  // 7. Latest upload info
  const uploads = await getUploadHistoryAsync();
  const latestUpload = uploads.length > 0 ? uploads[0] : null;

  return {
    kpis: {
      total_students: totalStudents,
      total_batches: totalBatches,
      total_centers: Number(summary.total_centers) || 0,
      total_trainers: Number(summary.total_trainers) || 0,
      total_aes: Number(summary.total_aes) || 0,
      active_batches: Number(summary.active_batches) || 0,
      completed_batches: Number(summary.completed_batches) || 0,
      hold_batches: Number(summary.hold_batches) || 0,
      total_dropouts: totalDropouts,
      dropout_rate: Number(dropoutRate.toFixed(2)),
      total_trained: totalTrained,
      trained_rate: Number(trainedRate.toFixed(2)),
      total_exceptions: Number(summary.total_exceptions) || 0,
      batch_validation_rate: Number(batchValidationRate.toFixed(2)),
      student_validation_rate: Number(studentValidationRate.toFixed(2)),
      students_with_validation_status: studentsWithVal,
    },
    academic_health: {
      avg_running_attendance: academicHealth.avg_running_attendance ? Number((academicHealth.avg_running_attendance * 100).toFixed(1)) : 0,
      avg_beneficiary_attendance: academicHealth.avg_beneficiary_attendance ? Number((academicHealth.avg_beneficiary_attendance * 100).toFixed(1)) : 0,
      avg_ilt_completion: academicHealth.avg_ilt_completion ? Number((academicHealth.avg_ilt_completion * 100).toFixed(1)) : 0,
      avg_fm_completion: academicHealth.avg_fm_completion ? Number((academicHealth.avg_fm_completion * 100).toFixed(1)) : 0,
      avg_exam_marks: academicHealth.avg_exam_marks ? Number(academicHealth.avg_exam_marks.toFixed(1)) : null,
      students_with_exam_data: Number(academicHealth.students_with_exam_data) || 0,
    },
    attention_areas: {
      pending_validation_count: pendingValCount,
      exceptions_count: Number(summary.total_exceptions) || 0,
      delayed_batches_count: delayedBatchesCount,
      low_attendance_count: lowAttendanceCount,
      low_completion_count: lowCompletionCount,
      thresholds: {
        attendance: currentSettings.attendanceThreshold * 100,
        completion: currentSettings.completionThreshold * 100,
        delay_days: currentSettings.batchDelayThresholdDays,
      }
    },
    batch_status_distribution: batchStatusDistribution,
    dropout_type_distribution: dropoutTypeDistribution,
    center_dropout_ranking: centerDropoutRanking,
    latest_upload: latestUpload,
  };
}

export function consolidateUpvanDharForDiya(byRm: any[], _programType?: string): any[] {
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

  let weightedDelaySum = 0;
  let totalBatchesForDelay = 0;

  for (const item of matches) {
    if (item.avg_delay_days !== undefined && item.total_batches !== undefined) {
      weightedDelaySum += (Number(item.avg_delay_days) || 0) * (Number(item.total_batches) || 0);
      totalBatchesForDelay += Number(item.total_batches) || 0;
    }
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

  // 1. Dropout rates: keep additive merge (Initial 20.6%, Regular 14.1%, Total 34.7%)
  if (kp.initial_dropout_rate != null || kp.regular_dropout_rate != null) {
    const totalRate = Number(((Number(kp.initial_dropout_rate) || 0) + (Number(kp.regular_dropout_rate) || 0)).toFixed(1));
    kp.total_dropout_rate = totalRate;
    kp.dropout_rate = totalRate;
  }
  if (kp.trained_rate !== undefined && kp.students !== undefined && kp.trained_students !== undefined) {
    kp.trained_rate = kp.students > 0 ? Number(((kp.trained_students / kp.students) * 100).toFixed(1)) : 0;
  }

  // 2. Trained & Timeliness percentages: recalculate from merged counts so they never exceed 100%
  if (kp.trained_within_10 !== undefined && kp.trained !== undefined) {
    kp.trained_within_10_pct = kp.trained > 0 ? Number(((kp.trained_within_10 / kp.trained) * 100).toFixed(1)) : 0;
    kp.trained_after_10_pct = kp.trained > 0 ? Number(((kp.trained_after_10 / kp.trained) * 100).toFixed(1)) : 0;
    if (kp.students !== undefined) {
      kp.running_trained_pct = kp.students > 0 ? Number(((kp.trained / kp.students) * 100).toFixed(1)) : 0;
    }
  }

  // 3. Batch Closure percentages: recalculate from merged counts so they never exceed 100%
  if (kp.on_time !== undefined && kp.total_batches !== undefined) {
    kp.on_time_pct = kp.total_batches > 0 ? Number(((kp.on_time / kp.total_batches) * 100).toFixed(1)) : 0;
    kp.delayed_pct = kp.total_batches > 0 ? Number(((kp.delayed / kp.total_batches) * 100).toFixed(1)) : 0;
    if (kp.within_10_days !== undefined) {
      kp.within_10_pct = kp.total_batches > 0 ? Number(((kp.within_10_days / kp.total_batches) * 100).toFixed(1)) : 0;
      kp.after_10_pct = kp.total_batches > 0 ? Number(((kp.after_10_days / kp.total_batches) * 100).toFixed(1)) : 0;
    }
    if (kp.avg_delay_days !== undefined && totalBatchesForDelay > 0) {
      kp.avg_delay_days = Number((weightedDelaySum / totalBatchesForDelay).toFixed(1));
    }
  }

  // 4. Exceptions rate: recalculate from merged counts
  if (kp.exception_rate !== undefined && kp.total_exceptions !== undefined) {
    const denom = kp.trained_students > 0 ? kp.trained_students : kp.students;
    kp.exception_rate = denom > 0 ? Number(((kp.total_exceptions / denom) * 100).toFixed(1)) : 0;
  }

  // 5. Scheduling conductance & missed percentages: recalculate from merged counts
  if (kp.sessions_conducted !== undefined && kp.total_scheduled !== undefined) {
    kp.conducted_pct = kp.total_scheduled > 0 ? Number(((kp.sessions_conducted / kp.total_scheduled) * 100).toFixed(1)) : 100;
    kp.missed_pct = kp.total_scheduled > 0 ? Number((100 - kp.conducted_pct).toFixed(1)) : 0;
    if (kp.sessions_rescheduled !== undefined) {
      kp.rescheduled_pct = kp.total_scheduled > 0 ? Number(((kp.sessions_rescheduled / kp.total_scheduled) * 100).toFixed(1)) : 0;
    }
  }

  // 6. Running Batch Progress averages & percentages: recalculate from weighted sums/counts
  if (kp.running_attendance_sum !== undefined && kp.running_attendance_count !== undefined) {
    kp.avg_running_attendance = kp.running_attendance_count > 0
      ? Number((kp.running_attendance_sum / kp.running_attendance_count).toFixed(1))
      : 0;
  }
  if (kp.beneficiary_attendance_sum !== undefined && kp.beneficiary_attendance_count !== undefined) {
    kp.avg_beneficiary_attendance = kp.beneficiary_attendance_count > 0
      ? Number((kp.beneficiary_attendance_sum / kp.beneficiary_attendance_count).toFixed(1))
      : 0;
  }
  if (kp.ilt_completion_sum !== undefined && kp.ilt_completion_count !== undefined) {
    kp.avg_ilt_completion = kp.ilt_completion_count > 0
      ? Number((kp.ilt_completion_sum / kp.ilt_completion_count).toFixed(1))
      : 0;
  }
  if (kp.students_gte_75 !== undefined && kp.total_students !== undefined) {
    kp.students_gte_75_pct = kp.total_students > 0
      ? Number(((kp.students_gte_75 / kp.total_students) * 100).toFixed(1))
      : 0;
  }
  if (kp.students_lt_75 !== undefined && kp.total_students !== undefined) {
    kp.students_lt_75_pct = kp.total_students > 0
      ? Number(((kp.students_lt_75 / kp.total_students) * 100).toFixed(1))
      : 0;
  }
  if (kp.students_gte_50 !== undefined && kp.total_students !== undefined) {
    kp.students_gte_50_pct = kp.total_students > 0
      ? Number(((kp.students_gte_50 / kp.total_students) * 100).toFixed(1))
      : 0;
  }
  if (kp.students_lt_50 !== undefined && kp.total_students !== undefined) {
    kp.students_lt_50_pct = kp.total_students > 0
      ? Number(((kp.students_lt_50 / kp.total_students) * 100).toFixed(1))
      : 0;
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

// Dropout Analytics
export async function getDropoutAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const effectiveFilters: FilterParams = {
    ...filters,
    module: 'dropout',
    restrictDeepTech: true,
    programType: filters.programType || 'Diya and Deeptech',
  };
  const { where, params } = buildFilterWhere(effectiveFilters, { restrictDeepTech: true });

  // Overall KPIs
  const kpiStmt = db.prepare(`
    SELECT
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as total_students,
      COUNT(*) as total_students_including_dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as total_dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Initial Session Dropout' THEN 1 END) as initial_session_dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Regular Session Dropout' THEN 1 END) as regular_session_dropouts,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as total_trained,
      COUNT(CASE WHEN LOWER(batch_status) = 'running' AND LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as active_in_training
    FROM raw_records
    WHERE ${where}
  `);
  kpiStmt.bind(params);
  let kpis: any = {};
  if (kpiStmt.step()) {
    kpis = kpiStmt.getAsObject();
  }
  kpiStmt.free();

  const totalStudents = Number(kpis.total_students) || 0;
  const totalStudentsIncludingDropouts = Number(kpis.total_students_including_dropouts) || 0;
  const totalDropouts = Number(kpis.total_dropouts) || 0;
  const totalTrained = Number(kpis.total_trained) || 0;
  const dropoutRate = totalStudentsIncludingDropouts > 0 ? (totalDropouts / totalStudentsIncludingDropouts) * 100 : 0;
  const trainedRate = totalStudentsIncludingDropouts > 0 ? (totalTrained / totalStudentsIncludingDropouts) * 100 : 0;

  // Monthly trend by batch_start_date (YYYY-MM)
  const trendStmt = db.prepare(`
    SELECT
      SUBSTR(batch_start_date, 1, 7) as month_key,
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as total_students,
      COUNT(*) as total_students_including_dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Initial Session Dropout' THEN 1 END) as initial_dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Regular Session Dropout' THEN 1 END) as regular_dropouts,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained_students
    FROM raw_records
    WHERE ${where} AND batch_start_date IS NOT NULL AND batch_start_date != ''
    GROUP BY month_key
    ORDER BY month_key ASC
    LIMIT 18
  `);
  trendStmt.bind(params);
  const trend: any[] = [];
  while (trendStmt.step()) {
    const row = trendStmt.getAsObject();
    const st = Number(row.total_students) || 0;
    const stIncDp = Number(row.total_students_including_dropouts) || 0;
    const dp = Number(row.dropouts) || 0;
    const initDp = Number(row.initial_dropouts) || 0;
    const regDp = Number(row.regular_dropouts) || 0;
    const trSt = Number(row.trained_students) || 0;
    trend.push({
      month: row.month_key || 'Unknown',
      students: st,
      dropouts: dp,
      initial_dropouts: initDp,
      regular_dropouts: regDp,
      trained_students: trSt,
      dropout_rate: stIncDp > 0 ? Number(((dp / stIncDp) * 100).toFixed(1)) : 0,
      initial_dropout_rate: stIncDp > 0 ? Number(((initDp / stIncDp) * 100).toFixed(1)) : 0,
      regular_dropout_rate: stIncDp > 0 ? Number(((regDp / stIncDp) * 100).toFixed(1)) : 0,
      trained_rate: stIncDp > 0 ? Number(((trSt / stIncDp) * 100).toFixed(1)) : 0,
    });
  }
  trendStmt.free();

  // Breakdown by Program with initial, regular, and trained split
  const progStmt = db.prepare(`
    SELECT
      program_name,
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as students,
      COUNT(*) as total_students_including_dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Initial Session Dropout' THEN 1 END) as initial_dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Regular Session Dropout' THEN 1 END) as regular_dropouts,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained_students
    FROM raw_records
    WHERE ${where} AND program_name IS NOT NULL AND program_name != ''
    GROUP BY program_name
    ORDER BY dropouts DESC
    LIMIT 10
  `);
  progStmt.bind(params);
  const byProgram: any[] = [];
  while (progStmt.step()) {
    const row = progStmt.getAsObject();
    const st = Number(row.students) || 0;
    const stIncDp = Number(row.total_students_including_dropouts) || 0;
    const dp = Number(row.dropouts) || 0;
    const initDp = Number(row.initial_dropouts) || 0;
    const regDp = Number(row.regular_dropouts) || 0;
    const trSt = Number(row.trained_students) || 0;
    byProgram.push({
      name: row.program_name || 'Unassigned',
      students: st,
      dropouts: dp,
      initial_dropouts: initDp,
      regular_dropouts: regDp,
      trained_students: trSt,
      dropout_rate: stIncDp > 0 ? Number(((dp / stIncDp) * 100).toFixed(1)) : 0,
      initial_dropout_rate: stIncDp > 0 ? Number(((initDp / stIncDp) * 100).toFixed(1)) : 0,
      regular_dropout_rate: stIncDp > 0 ? Number(((regDp / stIncDp) * 100).toFixed(1)) : 0,
      trained_rate: stIncDp > 0 ? Number(((trSt / stIncDp) * 100).toFixed(1)) : 0,
    });
  }
  progStmt.free();

  // Top Centers Breakdown with initial, regular, and trained split
  const topCenterStmt = db.prepare(`
    SELECT
      center_code,
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as students,
      COUNT(*) as total_students_including_dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Initial Session Dropout' THEN 1 END) as initial_dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Regular Session Dropout' THEN 1 END) as regular_dropouts,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained_students
    FROM raw_records
    WHERE ${where} AND center_code IS NOT NULL AND center_code != ''
    GROUP BY center_code
    ORDER BY dropouts DESC
    LIMIT 10
  `);
  topCenterStmt.bind(params);
  const byCenter: any[] = [];
  while (topCenterStmt.step()) {
    const row = topCenterStmt.getAsObject();
    const st = Number(row.students) || 0;
    const stIncDp = Number(row.total_students_including_dropouts) || 0;
    const dp = Number(row.dropouts) || 0;
    const initDp = Number(row.initial_dropouts) || 0;
    const regDp = Number(row.regular_dropouts) || 0;
    const trSt = Number(row.trained_students) || 0;
    const cName = row.center_code || 'Unknown';
    byCenter.push({
      name: cName,
      center_code: cName,
      students: st,
      total_students_including_dropouts: stIncDp,
      dropouts: dp,
      initial_dropouts: initDp,
      regular_dropouts: regDp,
      trained_students: trSt,
      dropout_rate: stIncDp > 0 ? Number(((dp / stIncDp) * 100).toFixed(1)) : 0,
      initial_dropout_rate: stIncDp > 0 ? Number(((initDp / stIncDp) * 100).toFixed(1)) : 0,
      regular_dropout_rate: stIncDp > 0 ? Number(((regDp / stIncDp) * 100).toFixed(1)) : 0,
      trained_rate: stIncDp > 0 ? Number(((trSt / stIncDp) * 100).toFixed(1)) : 0,
    });
  }
  topCenterStmt.free();

  // Breakdown by Funder
  const funderStmt = db.prepare(`
    SELECT
      funder_name,
      COUNT(*) as students,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropouts
    FROM raw_records
    WHERE ${where}
    GROUP BY funder_name
    ORDER BY dropouts DESC
    LIMIT 10
  `);
  funderStmt.bind(params);
  const byFunder: any[] = [];
  while (funderStmt.step()) {
    const row = funderStmt.getAsObject();
    const st = Number(row.students) || 0;
    const dp = Number(row.dropouts) || 0;
    byFunder.push({
      name: row.funder_name || 'Unassigned',
      students: st,
      dropouts: dp,
      dropout_rate: st > 0 ? Number(((dp / st) * 100).toFixed(1)) : 0
    });
  }
  funderStmt.free();

  // Breakdown by Trainer
  const trainerStmt = db.prepare(`
    SELECT
      assigned_trainers as trainer,
      COUNT(*) as students,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropouts
    FROM raw_records
    WHERE ${where} AND assigned_trainers IS NOT NULL AND assigned_trainers != ''
    GROUP BY assigned_trainers
    ORDER BY dropouts DESC
    LIMIT 10
  `);
  trainerStmt.bind(params);
  const byTrainer: any[] = [];
  while (trainerStmt.step()) {
    const row = trainerStmt.getAsObject();
    const st = Number(row.students) || 0;
    const dp = Number(row.dropouts) || 0;
    byTrainer.push({
      name: row.trainer,
      students: st,
      dropouts: dp,
      dropout_rate: st > 0 ? Number(((dp / st) * 100).toFixed(1)) : 0
    });
  }
  trainerStmt.free();

  // RM wise Breakdown with initial, regular, and trained split
  const rmStmt = db.prepare(`
    SELECT
      rm_sh_zh,
      COUNT(*) as students,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Initial Session Dropout' THEN 1 END) as initial_dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Regular Session Dropout' THEN 1 END) as regular_dropouts,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained_students
    FROM raw_records
    WHERE ${where} AND rm_sh_zh IS NOT NULL AND rm_sh_zh != ''
    GROUP BY rm_sh_zh
    ORDER BY dropouts DESC
  `);
  rmStmt.bind(params);
  const byRm: any[] = [];
  while (rmStmt.step()) {
    const row = rmStmt.getAsObject();
    const st = Number(row.students) || 0;
    const dp = Number(row.dropouts) || 0;
    const initDp = Number(row.initial_dropouts) || 0;
    const regDp = Number(row.regular_dropouts) || 0;
    const trSt = Number(row.trained_students) || 0;
    byRm.push({
      name: row.rm_sh_zh,
      students: st,
      dropouts: dp,
      initial_dropouts: initDp,
      regular_dropouts: regDp,
      trained_students: trSt,
      dropout_rate: st > 0 ? Number(((dp / st) * 100).toFixed(1)) : 0,
      initial_dropout_rate: st > 0 ? Number(((initDp / st) * 100).toFixed(1)) : 0,
      regular_dropout_rate: st > 0 ? Number(((regDp / st) * 100).toFixed(1)) : 0,
      trained_rate: st > 0 ? Number(((trSt / st) * 100).toFixed(1)) : 0,
    });
  }
  rmStmt.free();

  // Center Heatmap Table
  const centerStmt = db.prepare(`
    SELECT
      center_code,
      COUNT(*) as students,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Initial Session Dropout' THEN 1 END) as initial_dropouts,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' AND dropout_type = 'Regular Session Dropout' THEN 1 END) as regular_dropouts,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained_students,
      COUNT(DISTINCT batch_code) as batches
    FROM raw_records
    WHERE ${where}
    GROUP BY center_code
    ORDER BY (CAST(COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) AS REAL) / NULLIF(COUNT(*), 0)) DESC, dropouts DESC
  `);
  centerStmt.bind(params);
  const centerTable: any[] = [];
  while (centerStmt.step()) {
    const row = centerStmt.getAsObject();
    const s = Number(row.students) || 0;
    const d = Number(row.dropouts) || 0;
    const tr = Number(row.trained_students) || 0;
    centerTable.push({
      name: row.center_code || 'Unknown',
      center_code: row.center_code || 'Unknown',
      students: s,
      dropouts: d,
      initial_dropouts: Number(row.initial_dropouts) || 0,
      regular_dropouts: Number(row.regular_dropouts) || 0,
      trained_students: tr,
      batches: Number(row.batches) || 0,
      dropout_rate: s > 0 ? Number(((d / s) * 100).toFixed(1)) : 0,
      trained_rate: s > 0 ? Number(((tr / s) * 100).toFixed(1)) : 0,
    });
  }
  centerStmt.free();

  // Explicitly sort all breakdowns highest to lowest based on dropout %
  byProgram.sort((a, b) => b.dropout_rate - a.dropout_rate || b.dropouts - a.dropouts);
  byCenter.sort((a, b) => b.dropout_rate - a.dropout_rate || b.dropouts - a.dropouts);
  byRm.sort((a, b) => b.dropout_rate - a.dropout_rate || b.dropouts - a.dropouts);
  byFunder.sort((a, b) => b.dropout_rate - a.dropout_rate || b.dropouts - a.dropouts);
  byTrainer.sort((a, b) => b.dropout_rate - a.dropout_rate || b.dropouts - a.dropouts);
  centerTable.sort((a, b) => b.dropout_rate - a.dropout_rate || b.dropouts - a.dropouts);

  return {
    kpis: {
      total_students: totalStudents,
      total_students_including_dropouts: totalStudentsIncludingDropouts,
      total_dropouts: totalDropouts,
      dropout_rate: Number(dropoutRate.toFixed(2)),
      initial_session_dropouts: Number(kpis.initial_session_dropouts) || 0,
      regular_session_dropouts: Number(kpis.regular_session_dropouts) || 0,
      initial_dropout_rate: totalStudents > 0 ? Number(((Number(kpis.initial_session_dropouts) || 0) / totalStudents * 100).toFixed(2)) : 0,
      regular_dropout_rate: totalStudents > 0 ? Number(((Number(kpis.regular_session_dropouts) || 0) / totalStudents * 100).toFixed(2)) : 0,
      total_trained: totalTrained,
      trained_rate: Number(trainedRate.toFixed(2)),
      active_in_training: Number(kpis.active_in_training) || 0,
    },
    trend,
    by_program: byProgram,
    by_center: byCenter,
    by_rm: consolidateUpvanDharForDiya(byRm, effectiveFilters.programType || filters.programType),
    by_funder: byFunder,
    by_trainer: byTrainer,
    center_table: centerTable,
  };
}

// Exception Analytics
export async function getExceptionAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const effectiveFilters: FilterParams = {
    ...filters,
    module: 'exception',
    restrictDeepTech: true,
    programType: filters.programType || 'Diya Only',
  };
  const { where, params } = buildFilterWhere(effectiveFilters, { restrictDeepTech: true });



  const activeExceptionFilter = `incomplete_attendance_exception = 1 AND LOWER(TRIM(COALESCE(validation_status, ''))) NOT LIKE '%special approval%' AND LOWER(TRIM(COALESCE(validation_status, ''))) NOT LIKE '%special approved%'`;

  const kpiStmt = db.prepare(`
    SELECT
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as total_student_batch_records,
      COUNT(CASE WHEN ${activeExceptionFilter} THEN 1 END) as total_exceptions,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as total_trained,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(validation_status, ''))) LIKE '%special approval%' OR LOWER(TRIM(COALESCE(validation_status, ''))) LIKE '%special approved%' THEN 1 END) as special_approvals,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(validation_status, ''))) = 'approved exception' THEN 1 END) as approved_exceptions,
      COUNT(CASE WHEN TRIM(COALESCE(special_case, '')) = '1' OR special_case = 1 THEN 1 END) as special_cases_count
    FROM raw_records
    WHERE ${where}
  `);
  kpiStmt.bind(params);
  let kpis: any = {};
  if (kpiStmt.step()) {
    kpis = kpiStmt.getAsObject();
  }
  kpiStmt.free();

  const totalRecords = Number(kpis.total_student_batch_records) || 0;
  const totalExceptions = Number(kpis.total_exceptions) || 0;
  const totalTrained = Number(kpis.total_trained) || 0;
  const specialApprovals = Number(kpis.special_approvals) || 0;
  const approvedExceptions = Number(kpis.approved_exceptions) || 0;
  const specialCasesCount = Number(kpis.special_cases_count) || 0;
  // Exceptions are counted against only the trained students:
  const exceptionRate = totalTrained > 0 ? (totalExceptions / totalTrained) * 100 : 0;

  // Breakdown by RM
  const rmStmt = db.prepare(`
    SELECT
      rm_sh_zh as name,
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as students,
      COUNT(CASE WHEN ${activeExceptionFilter} THEN 1 END) as total_exceptions,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(validation_status, ''))) LIKE '%special approval%' OR LOWER(TRIM(COALESCE(validation_status, ''))) LIKE '%special approved%' THEN 1 END) as special_approvals
    FROM raw_records
    WHERE ${where} AND rm_sh_zh IS NOT NULL AND rm_sh_zh != ''
    GROUP BY rm_sh_zh
    ORDER BY total_exceptions DESC
  `);
  rmStmt.bind(params);
  const byRm: any[] = [];
  while (rmStmt.step()) {
    const row = rmStmt.getAsObject();
    const st = Number(row.students) || 0;
    const totEx = Number(row.total_exceptions) || 0;
    const spApp = Number(row.special_approvals) || 0;
    const trSt = Number(row.trained_students) || 0;
    byRm.push({
      name: row.name,
      students: st,
      trained_students: trSt,
      total_exceptions: totEx,
      special_approvals: spApp,
      // Exception rate counted strictly against trained candidates
      exception_rate: trSt > 0 ? Number(((totEx / trSt) * 100).toFixed(1)) : 0,
    });
  }
  rmStmt.free();

  // Breakdown by Center
  const centerStmt = db.prepare(`
    SELECT
      center_code,
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as students,
      COUNT(CASE WHEN ${activeExceptionFilter} THEN 1 END) as total_exceptions,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(validation_status, ''))) LIKE '%special approval%' OR LOWER(TRIM(COALESCE(validation_status, ''))) LIKE '%special approved%' THEN 1 END) as special_approvals,
      COUNT(DISTINCT batch_code) as batches
    FROM raw_records
    WHERE ${where}
    GROUP BY center_code
    ORDER BY total_exceptions DESC
  `);
  centerStmt.bind(params);
  const byCenter: any[] = [];
  while (centerStmt.step()) {
    const row = centerStmt.getAsObject();
    const st = Number(row.students) || 0;
    const totEx = Number(row.total_exceptions) || 0;
    const spApp = Number(row.special_approvals) || 0;
    const trSt = Number(row.trained_students) || 0;
    byCenter.push({
      center_code: row.center_code,
      name: row.center_code,
      students: st,
      trained_students: trSt,
      total_exceptions: totEx,
      special_approvals: spApp,
      batches: Number(row.batches) || 0,
      // Exception rate counted strictly against trained candidates
      exception_rate: trSt > 0 ? Number(((totEx / trSt) * 100).toFixed(1)) : 0,
    });
  }
  centerStmt.free();

  // Breakdown by Program
  const progStmt = db.prepare(`
    SELECT
      program_name as name,
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as students,
      COUNT(CASE WHEN ${activeExceptionFilter} THEN 1 END) as total_exceptions,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(validation_status, ''))) LIKE '%special approval%' OR LOWER(TRIM(COALESCE(validation_status, ''))) LIKE '%special approved%' THEN 1 END) as special_approvals
    FROM raw_records
    WHERE ${where} AND program_name IS NOT NULL AND program_name != ''
    GROUP BY program_name
    ORDER BY total_exceptions DESC
  `);
  progStmt.bind(params);
  const byProgram: any[] = [];
  while (progStmt.step()) {
    const row = progStmt.getAsObject();
    const st = Number(row.students) || 0;
    const totEx = Number(row.total_exceptions) || 0;
    const spApp = Number(row.special_approvals) || 0;
    const trSt = Number(row.trained_students) || 0;
    byProgram.push({
      name: row.name,
      students: st,
      trained_students: trSt,
      total_exceptions: totEx,
      special_approvals: spApp,
      // Exception rate counted strictly against trained candidates
      exception_rate: trSt > 0 ? Number(((totEx / trSt) * 100).toFixed(1)) : 0,
    });
  }
  progStmt.free();

  // Breakdown by Trainer
  const trainerStmt = db.prepare(`
    SELECT
      assigned_trainers as trainer,
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained_students,
      COUNT(CASE WHEN ${activeExceptionFilter} THEN 1 END) as total_exceptions
    FROM raw_records
    WHERE ${where} AND assigned_trainers IS NOT NULL AND assigned_trainers != ''
    GROUP BY assigned_trainers
    ORDER BY total_exceptions DESC
    LIMIT 12
  `);
  trainerStmt.bind(params);
  const byTrainer: any[] = [];
  while (trainerStmt.step()) {
    const row = trainerStmt.getAsObject();
    const st = Number(row.students) || 0;
    const trSt = Number(row.trained_students) || 0;
    const totEx = Number(row.total_exceptions) || 0;
    byTrainer.push({
      trainer: row.trainer,
      name: row.trainer,
      students: st,
      trained_students: trSt,
      total_exceptions: totEx,
      // Exception rate counted strictly against trained candidates
      exception_rate: trSt > 0 ? Number(((totEx / trSt) * 100).toFixed(1)) : 0,
    });
  }
  trainerStmt.free();

  // Consolidate Upvan Dhar into Krishna Prasad with recalculated rates and metrics
  const byRmFiltered = consolidateUpvanDharForDiya(byRm, effectiveFilters.programType || filters.programType)
    .sort((a, b) => b.exception_rate - a.exception_rate || b.total_exceptions - a.total_exceptions || b.students - a.students);

  const byCenterFiltered = (totalExceptions > 0 ? byCenter.filter((item) => item.total_exceptions > 0) : byCenter)
    .sort((a, b) => b.exception_rate - a.exception_rate || b.total_exceptions - a.total_exceptions || b.students - a.students);

  const byProgramRaw = (totalExceptions > 0 ? byProgram.filter((item) => item.total_exceptions > 0) : byProgram)
    .sort((a, b) => b.total_exceptions - a.total_exceptions || b.students - a.students);

  const totalProgramExceptions = byProgramRaw.reduce((sum, item) => sum + (Number(item.total_exceptions) || 0), 0);
  if (totalProgramExceptions > 0 && byProgramRaw.length > 0) {
    const rawTenths = byProgramRaw.map((item) => ((Number(item.total_exceptions) || 0) / totalProgramExceptions) * 1000);
    const tenths = rawTenths.map((val, idx) => ((Number(byProgramRaw[idx].total_exceptions) || 0) > 0 ? Math.max(1, Math.floor(val)) : 0));
    const currentSum = tenths.reduce((a, b) => a + b, 0);

    if (currentSum < 1000) {
      let diff = 1000 - currentSum;
      const order = rawTenths
        .map((val, idx) => ({ idx, rem: val - tenths[idx] }))
        .sort((a, b) => b.rem - a.rem || a.idx - b.idx);
      for (let i = 0; i < order.length && diff > 0; i++) {
        tenths[order[i].idx] += 1;
        diff--;
      }
    } else if (currentSum > 1000) {
      let diff = currentSum - 1000;
      const order = rawTenths
        .map((val, idx) => ({ idx, rem: val - tenths[idx] }))
        .sort((a, b) => a.rem - b.rem || b.idx - a.idx);
      for (let i = 0; i < order.length && diff > 0; i++) {
        if (tenths[order[i].idx] > 1) {
          tenths[order[i].idx] -= 1;
          diff--;
        }
      }
    }

    byProgramRaw.forEach((item, idx) => {
      item.cohort_exception_rate = item.exception_rate;
      item.exception_rate = Number((tenths[idx] / 10).toFixed(1));
    });
  } else {
    byProgramRaw.forEach((item) => {
      item.cohort_exception_rate = item.exception_rate;
      item.exception_rate = 0;
    });
  }

  const byProgramFiltered = byProgramRaw
    .sort((a, b) => b.exception_rate - a.exception_rate || b.total_exceptions - a.total_exceptions || b.students - a.students);

  const byTrainerFiltered = (totalExceptions > 0 ? byTrainer.filter((item) => item.total_exceptions > 0) : byTrainer)
    .sort((a, b) => b.exception_rate - a.exception_rate || b.total_exceptions - a.total_exceptions || b.students - a.students);

  return {
    kpis: {
      total_exceptions: totalExceptions,
      total_records: totalRecords,
      total_students: totalRecords,
      total_trained: totalTrained,
      exception_rate: Number(exceptionRate.toFixed(2)),
      special_approvals: specialApprovals,
      approved_exceptions: approvedExceptions,
      special_cases_count: specialCasesCount,
    },
    by_rm: byRmFiltered,
    by_center: byCenterFiltered,
    by_program: byProgramFiltered,
    by_trainer: byTrainerFiltered,
    center_table: byCenterFiltered,
  };
}

// Batch Closure Efficiency (Aggregated strictly at DISTINCT BATCH grain)
export async function getBatchClosureAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const effectiveFilters: FilterParams = {
    ...filters,
    module: 'batch_closure',
    restrictDeepTech: true,
  };
  const { where, params } = buildFilterWhere(effectiveFilters, { restrictDeepTech: true });

  // Distinct batch level query
  const batchLevelQuery = `
    SELECT
      batch_code,
      center_code,
      funder_name,
      program_name,
      course_code,
      assigned_trainers,
      assigned_ae,
      rm_sh_zh,
      batch_start_date,
      batch_initial_start_date,
      batch_initial_end_date,
      batch_end_date,
      batch_actual_end_date,
      batch_status,
      batch_validation_status,
      AVG(CAST(ilt_completion AS REAL)) as ilt_completion,
      COUNT(*) as student_count,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropout_count
    FROM raw_records
    WHERE ${where}
    GROUP BY batch_code
  `;

  const stmt = db.prepare(batchLevelQuery);
  stmt.bind(params);

  let totalBatches = 0;
  let runningBatches = 0;
  let completedBatches = 0;
  let holdBatches = 0;
  let otherBatches = 0;

  let fullyValidated = 0;
  let partiallyValidated = 0;
  let notYetValidated = 0;

  let eligibleCompletedBatches = 0;
  let onTimeBatches = 0;
  let within10DaysBatches = 0;
  let after10DaysBatches = 0;

  let closedIltGte120Batches = 0;
  let closedIltLt120Batches = 0;

  const delayedBatchesList: any[] = [];
  const closureBatchesList: any[] = [];
  const closureTrendMap: Record<string, { total: number; on_time: number; delayed: number }> = {};
  const centerClosureMap: Record<string, { total: number; on_time: number; delayed: number; within_10: number; after_10: number; on_time_strict: number; delayed_strict: number; total_delay_days: number }> = {};
  const programClosureMap: Record<string, { total: number; on_time: number; delayed: number; within_10: number; after_10: number; on_time_strict: number; delayed_strict: number; total_delay_days: number }> = {};
  const rmClosureMap: Record<string, { total: number; on_time: number; delayed: number; within_10: number; after_10: number; on_time_strict: number; delayed_strict: number; total_delay_days: number }> = {};

  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    totalBatches++;

    const status = (row.batch_status || '').toLowerCase();
    const isCompleted = status === 'complete' || status === 'completed';
    if (status === 'running') runningBatches++;
    else if (isCompleted) completedBatches++;
    else if (status === 'hold') holdBatches++;
    else otherBatches++;

    const iltRaw = row.ilt_completion != null ? Number(row.ilt_completion) : null;
    const iltPct = iltRaw != null ? (iltRaw > 2.0 ? iltRaw : iltRaw * 100) : null;

    if (isCompleted) {
      if (iltPct != null && iltPct >= 120) {
        closedIltGte120Batches++;
      } else {
        closedIltLt120Batches++;
      }
    }

    const valStatus = row.batch_validation_status || 'Not Yet Validated';
    if (valStatus === 'Fully Validated') fullyValidated++;
    else if (valStatus === 'Partially Validated') partiallyValidated++;
    else notYetValidated++;

    // Calculate dates & duration if completed and dates available
    const initialEndDateStr = String(row.batch_initial_end_date || '').trim();
    const endDateStr = String(row.batch_end_date || '').trim();
    const targetEndDateStr = initialEndDateStr !== '' ? initialEndDateStr : endDateStr;
    const actualEndDateStr = String(row.batch_actual_end_date || '').trim();

    const isEligibleClosed = isCompleted && actualEndDateStr !== '' && targetEndDateStr !== '';

    if (isEligibleClosed) {
      eligibleCompletedBatches++;

      const plannedEndDate = new Date(targetEndDateStr).getTime();
      const actualEndDate = new Date(actualEndDateStr).getTime();
      const diffDays = Math.round((actualEndDate - plannedEndDate) / (1000 * 3600 * 24));

      if (diffDays <= 10) {
        within10DaysBatches++;
      } else {
        after10DaysBatches++;
      }

      const center = row.center_code || 'Unknown';
      if (!centerClosureMap[center]) {
        centerClosureMap[center] = { total: 0, on_time: 0, delayed: 0, within_10: 0, after_10: 0, on_time_strict: 0, delayed_strict: 0, total_delay_days: 0 };
      }
      centerClosureMap[center].total++;

      const program = row.program_name || 'Unknown';
      if (!programClosureMap[program]) {
        programClosureMap[program] = { total: 0, on_time: 0, delayed: 0, within_10: 0, after_10: 0, on_time_strict: 0, delayed_strict: 0, total_delay_days: 0 };
      }
      programClosureMap[program].total++;

      const rm = row.rm_sh_zh || 'Unassigned';
      if (!rmClosureMap[rm]) {
        rmClosureMap[rm] = { total: 0, on_time: 0, delayed: 0, within_10: 0, after_10: 0, on_time_strict: 0, delayed_strict: 0, total_delay_days: 0 };
      }
      rmClosureMap[rm].total++;

      const monthKey = actualEndDateStr.substring(0, 7);
      if (!closureTrendMap[monthKey]) {
        closureTrendMap[monthKey] = { total: 0, on_time: 0, delayed: 0 };
      }
      closureTrendMap[monthKey].total++;

      if (diffDays <= 10) {
        centerClosureMap[center].within_10++;
        programClosureMap[program].within_10++;
        rmClosureMap[rm].within_10++;
      } else {
        centerClosureMap[center].after_10++;
        programClosureMap[program].after_10++;
        rmClosureMap[rm].after_10++;
      }

      if (diffDays <= 0) {
        onTimeBatches++;
        centerClosureMap[center].on_time_strict++;
        programClosureMap[program].on_time_strict++;
        rmClosureMap[rm].on_time_strict++;
        closureTrendMap[monthKey].on_time++;
      } else {
        centerClosureMap[center].delayed_strict++;
        centerClosureMap[center].total_delay_days += diffDays;
        programClosureMap[program].delayed_strict++;
        programClosureMap[program].total_delay_days += diffDays;
        rmClosureMap[rm].delayed_strict++;
        rmClosureMap[rm].total_delay_days += diffDays;
        closureTrendMap[monthKey].delayed++;

        delayedBatchesList.push({
          batch_code: row.batch_code,
          center_code: row.center_code,
          program_name: row.program_name,
          course_code: row.course_code,
          assigned_trainers: row.assigned_trainers,
          batch_start_date: row.batch_start_date,
          batch_end_date: targetEndDateStr,
          batch_actual_end_date: row.batch_actual_end_date,
          delay_days: diffDays,
          is_within_10_days: diffDays <= 10,
          is_within_7_days: diffDays <= 10,
          is_after_10_days: diffDays > 10,
          batch_status: row.batch_status,
          batch_validation_status: row.batch_validation_status,
          student_count: Number(row.student_count) || 0,
          ilt_completion: iltRaw,
          ilt_pct: iltPct != null ? Number(iltPct.toFixed(1)) : null,
          is_ilt_gte_120: iltPct != null && iltPct >= 120,
          is_ilt_gte_110: iltPct != null && iltPct >= 120,
        });
      }

      closureBatchesList.push({
        batch_code: row.batch_code,
        center_code: row.center_code,
        program_name: row.program_name,
        course_code: row.course_code,
        assigned_trainers: row.assigned_trainers,
        batch_start_date: row.batch_start_date,
        batch_end_date: targetEndDateStr,
        batch_actual_end_date: row.batch_actual_end_date,
        delay_days: diffDays,
        is_within_10_days: diffDays <= 10,
        is_within_7_days: diffDays <= 10,
        is_after_10_days: diffDays > 10,
        batch_status: row.batch_status,
        batch_validation_status: row.batch_validation_status,
        student_count: Number(row.student_count) || 0,
        ilt_completion: iltRaw,
        ilt_pct: iltPct != null ? Number(iltPct.toFixed(1)) : null,
        is_ilt_gte_120: iltPct != null && iltPct >= 120,
        is_ilt_gte_110: iltPct != null && iltPct >= 120,
      });
    } else if (isCompleted) {
      eligibleCompletedBatches++;
      after10DaysBatches++;

      const center = row.center_code || 'Unknown';
      if (!centerClosureMap[center]) {
        centerClosureMap[center] = { total: 0, on_time: 0, delayed: 0, within_10: 0, after_10: 0, on_time_strict: 0, delayed_strict: 0, total_delay_days: 0 };
      }
      centerClosureMap[center].total++;
      centerClosureMap[center].after_10++;

      const program = row.program_name || 'Unknown';
      if (!programClosureMap[program]) {
        programClosureMap[program] = { total: 0, on_time: 0, delayed: 0, within_10: 0, after_10: 0, on_time_strict: 0, delayed_strict: 0, total_delay_days: 0 };
      }
      programClosureMap[program].total++;
      programClosureMap[program].after_10++;

      const rm = row.rm_sh_zh || 'Unassigned';
      if (!rmClosureMap[rm]) {
        rmClosureMap[rm] = { total: 0, on_time: 0, delayed: 0, within_10: 0, after_10: 0, on_time_strict: 0, delayed_strict: 0, total_delay_days: 0 };
      }
      rmClosureMap[rm].total++;
      rmClosureMap[rm].after_10++;

      closureBatchesList.push({
        batch_code: row.batch_code,
        center_code: row.center_code,
        program_name: row.program_name,
        course_code: row.course_code,
        assigned_trainers: row.assigned_trainers,
        batch_start_date: row.batch_start_date,
        batch_end_date: targetEndDateStr || endDateStr || '',
        batch_actual_end_date: row.batch_actual_end_date || '',
        delay_days: 0,
        is_within_10_days: false,
        is_within_7_days: false,
        is_after_10_days: true,
        batch_status: row.batch_status,
        batch_validation_status: row.batch_validation_status,
        student_count: Number(row.student_count) || 0,
        ilt_completion: iltRaw,
        ilt_pct: iltPct != null ? Number(iltPct.toFixed(1)) : null,
        is_ilt_gte_120: iltPct != null && iltPct >= 120,
        is_ilt_gte_110: iltPct != null && iltPct >= 120,
      });
    }
  }
  stmt.free();

  // Sort delayed batches by highest delay days descending
  delayedBatchesList.sort((a, b) => b.delay_days - a.delay_days);
  closureBatchesList.sort((a, b) => b.delay_days - a.delay_days);

  const onTimeRate = eligibleCompletedBatches > 0 ? (onTimeBatches / eligibleCompletedBatches) * 100 : 0;
  const closedWithin10Pct = eligibleCompletedBatches > 0 ? Number(((within10DaysBatches / eligibleCompletedBatches) * 100).toFixed(1)) : 0;
  const closedAfter10Pct = eligibleCompletedBatches > 0 ? Number(((after10DaysBatches / eligibleCompletedBatches) * 100).toFixed(1)) : 0;
  const closedIltGte120Pct = completedBatches > 0 ? Number(((closedIltGte120Batches / completedBatches) * 100).toFixed(1)) : 0;
  const closedIltLt120Pct = completedBatches > 0 ? Number(((closedIltLt120Batches / completedBatches) * 100).toFixed(1)) : 0;

  const centerClosureSummary = Object.entries(centerClosureMap).map(([center, val]) => ({
    center_code: center,
    total_eligible: val.total,
    on_time: val.within_10,
    delayed: val.after_10,
    within_10_days: val.within_10,
    after_10_days: val.after_10,
    on_time_pct: val.total > 0 ? Number(((val.within_10 / val.total) * 100).toFixed(1)) : 0,
    delayed_pct: val.total > 0 ? Number(((val.after_10 / val.total) * 100).toFixed(1)) : 0,
    within_10_pct: val.total > 0 ? Number(((val.within_10 / val.total) * 100).toFixed(1)) : 0,
    after_10_pct: val.total > 0 ? Number(((val.after_10 / val.total) * 100).toFixed(1)) : 0,
    on_time_strict: val.on_time_strict,
    delayed_strict: val.delayed_strict,
    avg_delay_days: val.delayed_strict > 0 ? Number((val.total_delay_days / val.delayed_strict).toFixed(1)) : 0
  })).sort((a, b) => b.delayed - a.delayed);

  const byRm = Object.entries(rmClosureMap).map(([rm, val]) => ({
    name: rm,
    total_batches: val.total,
    on_time: val.within_10,
    delayed: val.after_10,
    within_10_days: val.within_10,
    after_10_days: val.after_10,
    on_time_pct: val.total > 0 ? Number(((val.within_10 / val.total) * 100).toFixed(1)) : 0,
    delayed_pct: val.total > 0 ? Number(((val.after_10 / val.total) * 100).toFixed(1)) : 0,
    within_10_pct: val.total > 0 ? Number(((val.within_10 / val.total) * 100).toFixed(1)) : 0,
    after_10_pct: val.total > 0 ? Number(((val.after_10 / val.total) * 100).toFixed(1)) : 0,
    on_time_strict: val.on_time_strict,
    delayed_strict: val.delayed_strict,
    avg_delay_days: val.delayed_strict > 0 ? Number((val.total_delay_days / val.delayed_strict).toFixed(1)) : 0
  })).sort((a, b) => b.delayed - a.delayed || b.total_batches - a.total_batches);

  const byCenter = Object.entries(centerClosureMap).map(([center, val]) => ({
    name: center,
    center_code: center,
    total_batches: val.total,
    on_time: val.within_10,
    delayed: val.after_10,
    within_10_days: val.within_10,
    after_10_days: val.after_10,
    on_time_pct: val.total > 0 ? Number(((val.within_10 / val.total) * 100).toFixed(1)) : 0,
    delayed_pct: val.total > 0 ? Number(((val.after_10 / val.total) * 100).toFixed(1)) : 0,
    within_10_pct: val.total > 0 ? Number(((val.within_10 / val.total) * 100).toFixed(1)) : 0,
    after_10_pct: val.total > 0 ? Number(((val.after_10 / val.total) * 100).toFixed(1)) : 0,
    on_time_strict: val.on_time_strict,
    delayed_strict: val.delayed_strict,
    avg_delay_days: val.delayed_strict > 0 ? Number((val.total_delay_days / val.delayed_strict).toFixed(1)) : 0
  })).sort((a, b) => b.delayed - a.delayed || b.total_batches - a.total_batches);

  const byProgram = Object.entries(programClosureMap).map(([program, val]) => ({
    name: program,
    program_name: program,
    total_batches: val.total,
    on_time: val.within_10,
    delayed: val.after_10,
    within_10_days: val.within_10,
    after_10_days: val.after_10,
    on_time_pct: val.total > 0 ? Number(((val.within_10 / val.total) * 100).toFixed(1)) : 0,
    delayed_pct: val.total > 0 ? Number(((val.after_10 / val.total) * 100).toFixed(1)) : 0,
    within_10_pct: val.total > 0 ? Number(((val.within_10 / val.total) * 100).toFixed(1)) : 0,
    after_10_pct: val.total > 0 ? Number(((val.after_10 / val.total) * 100).toFixed(1)) : 0,
    on_time_strict: val.on_time_strict,
    delayed_strict: val.delayed_strict,
    avg_delay_days: val.delayed_strict > 0 ? Number((val.total_delay_days / val.delayed_strict).toFixed(1)) : 0
  })).sort((a, b) => b.delayed - a.delayed || b.total_batches - a.total_batches);

  const monthlyTrend = Object.entries(closureTrendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, val]) => ({
      month,
      total: val.total,
      on_time: val.on_time,
      delayed: val.delayed,
      on_time_rate: val.total > 0 ? Number(((val.on_time / val.total) * 100).toFixed(1)) : 0
    }));

  return {
    kpis: {
      total_batches: totalBatches,
      running_batches: runningBatches,
      completed_batches: completedBatches,
      hold_batches: holdBatches,
      other_batches: otherBatches,
      eligible_completed_batches: eligibleCompletedBatches,
      on_time_batches: onTimeBatches,
      closed_within_10_days: within10DaysBatches,
      closed_within_10_days_pct: closedWithin10Pct,
      closed_after_10_days: after10DaysBatches,
      closed_after_10_days_pct: closedAfter10Pct,
      closed_within_7_days: within10DaysBatches,
      closed_within_7_days_pct: closedWithin10Pct,
      closed_after_7_days: after10DaysBatches,
      closed_after_7_days_pct: closedAfter10Pct,
      closed_batches_ilt_gte_120: closedIltGte120Batches,
      closed_batches_ilt_gte_120_pct: closedIltGte120Pct,
      closed_batches_ilt_lt_120: closedIltLt120Batches,
      closed_batches_ilt_lt_120_pct: closedIltLt120Pct,
      closed_batches_ilt_gte_110: closedIltGte120Batches,
      closed_batches_ilt_gte_110_pct: closedIltGte120Pct,
      closed_batches_ilt_lt_110: closedIltLt120Batches,
      closed_batches_ilt_lt_110_pct: closedIltLt120Pct,
      delayed_batches_count: delayedBatchesList.length,
      on_time_closure_pct: Number(onTimeRate.toFixed(2)),
      validation_status: {
        fully_validated: fullyValidated,
        partially_validated: partiallyValidated,
        not_yet_validated: notYetValidated,
      }
    },
    monthly_trend: monthlyTrend,
    center_closure_summary: centerClosureSummary,
    by_rm: consolidateUpvanDharForDiya(byRm, effectiveFilters.programType || filters.programType),
    by_center: byCenter,
    by_program: byProgram,
    delayed_batches: delayedBatchesList,
    closure_batches: closureBatchesList,
  };
}

// Trained Analytics & Assessment Timeliness
export async function getTrainedAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const effectiveFilters: FilterParams = {
    ...filters,
    module: 'trained',
    restrictDeepTech: true,
    programType: filters.programType || 'Diya and Deeptech',
  };
  const { where, params } = buildFilterWhere(effectiveFilters, { restrictDeepTech: true });

  // 1. Overall KPIs
  const kpiStmt = db.prepare(`
    SELECT
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as total_students,
      COUNT(*) as total_students_including_dropouts,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as total_trained,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 AND (julianday(COALESCE(exam_schedule_date, batch_actual_end_date)) - julianday(batch_actual_end_date)) <= 10 THEN 1 END) as trained_within_10_days,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 AND (julianday(COALESCE(exam_schedule_date, batch_actual_end_date)) - julianday(batch_actual_end_date)) > 10 THEN 1 END) as trained_after_10_days,
      COUNT(CASE WHEN LOWER(batch_status) = 'running' AND LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as active_in_training,
      COUNT(DISTINCT batch_code) as total_batches,
      COUNT(DISTINCT CASE WHEN LOWER(batch_status) = 'running' THEN batch_code END) as running_batches,
      COUNT(DISTINCT CASE WHEN LOWER(batch_status) IN ('complete', 'completed') THEN batch_code END) as completed_batches
    FROM raw_records
    WHERE ${where}
  `);
  kpiStmt.bind(params);
  let kpis: any = {};
  if (kpiStmt.step()) {
    kpis = kpiStmt.getAsObject();
  }
  kpiStmt.free();

  const totalStudents = Number(kpis.total_students) || 0;
  const totalStudentsIncludingDropouts = Number(kpis.total_students_including_dropouts) || 0;
  const totalTrained = Number(kpis.total_trained) || 0;
  const trainedWithin10Days = Number(kpis.trained_within_10_days) || 0;
  const trainedAfter10Days = Number(kpis.trained_after_10_days) || 0;
  const activeInTraining = Number(kpis.active_in_training) || 0;

  const trainedWithin10DaysPct = totalTrained > 0 ? Number(((trainedWithin10Days / totalTrained) * 100).toFixed(1)) : 0;
  const trainedAfter10DaysPct = totalTrained > 0 ? Number(((trainedAfter10Days / totalTrained) * 100).toFixed(1)) : 0;
  const runningTrainedPct = totalStudents > 0 ? Number(((totalTrained / totalStudents) * 100).toFixed(1)) : 0;

  // 2. Breakdown by Regional Manager (RM)
  const rmStmt = db.prepare(`
    SELECT
      rm_sh_zh as name,
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 AND (julianday(COALESCE(exam_schedule_date, batch_actual_end_date)) - julianday(batch_actual_end_date)) <= 10 THEN 1 END) as trained_within_10,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 AND (julianday(COALESCE(exam_schedule_date, batch_actual_end_date)) - julianday(batch_actual_end_date)) > 10 THEN 1 END) as trained_after_10,
      COUNT(CASE WHEN LOWER(batch_status) = 'running' AND LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as in_training,
      COUNT(DISTINCT batch_code) as batches
    FROM raw_records
    WHERE ${where} AND rm_sh_zh IS NOT NULL AND rm_sh_zh != ''
    GROUP BY rm_sh_zh
    ORDER BY trained DESC
  `);
  rmStmt.bind(params);
  const byRm: any[] = [];
  while (rmStmt.step()) {
    const row = rmStmt.getAsObject() as any;
    const st = Number(row.students) || 0;
    const tr = Number(row.trained) || 0;
    const w10 = Number(row.trained_within_10) || 0;
    const a10 = Number(row.trained_after_10) || 0;
    byRm.push({
      name: row.name,
      students: st,
      trained: tr,
      trained_within_10: w10,
      trained_within_10_pct: tr > 0 ? Number(((w10 / tr) * 100).toFixed(1)) : 0,
      trained_after_10: a10,
      trained_after_10_pct: tr > 0 ? Number(((a10 / tr) * 100).toFixed(1)) : 0,
      running_trained_pct: st > 0 ? Number(((tr / st) * 100).toFixed(1)) : 0,
      in_training: Number(row.in_training) || 0,
      batches: Number(row.batches) || 0,
    });
  }
  rmStmt.free();

  // 3. Breakdown by Center
  const centerStmt = db.prepare(`
    SELECT
      center_code,
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 AND (julianday(COALESCE(exam_schedule_date, batch_actual_end_date)) - julianday(batch_actual_end_date)) <= 10 THEN 1 END) as trained_within_10,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 AND (julianday(COALESCE(exam_schedule_date, batch_actual_end_date)) - julianday(batch_actual_end_date)) > 10 THEN 1 END) as trained_after_10,
      COUNT(CASE WHEN LOWER(batch_status) = 'running' AND LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as in_training,
      COUNT(DISTINCT batch_code) as batches
    FROM raw_records
    WHERE ${where}
    GROUP BY center_code
    ORDER BY trained DESC
  `);
  centerStmt.bind(params);
  const byCenter: any[] = [];
  while (centerStmt.step()) {
    const row = centerStmt.getAsObject() as any;
    const st = Number(row.students) || 0;
    const tr = Number(row.trained) || 0;
    const w10 = Number(row.trained_within_10) || 0;
    const a10 = Number(row.trained_after_10) || 0;
    byCenter.push({
      center_code: row.center_code,
      name: row.center_code,
      students: st,
      trained: tr,
      trained_within_10: w10,
      trained_within_10_pct: tr > 0 ? Number(((w10 / tr) * 100).toFixed(1)) : 0,
      trained_after_10: a10,
      trained_after_10_pct: tr > 0 ? Number(((a10 / tr) * 100).toFixed(1)) : 0,
      running_trained_pct: st > 0 ? Number(((tr / st) * 100).toFixed(1)) : 0,
      in_training: Number(row.in_training) || 0,
      batches: Number(row.batches) || 0,
    });
  }
  centerStmt.free();

  // 4. Breakdown by Program
  const progStmt = db.prepare(`
    SELECT
      program_name as name,
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 AND (julianday(COALESCE(exam_schedule_date, batch_actual_end_date)) - julianday(batch_actual_end_date)) <= 10 THEN 1 END) as trained_within_10,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 AND (julianday(COALESCE(exam_schedule_date, batch_actual_end_date)) - julianday(batch_actual_end_date)) > 10 THEN 1 END) as trained_after_10,
      COUNT(CASE WHEN LOWER(batch_status) = 'running' AND LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as in_training,
      COUNT(DISTINCT batch_code) as batches
    FROM raw_records
    WHERE ${where} AND program_name IS NOT NULL AND program_name != ''
    GROUP BY program_name
    ORDER BY trained DESC
  `);
  progStmt.bind(params);
  const byProgram: any[] = [];
  while (progStmt.step()) {
    const row = progStmt.getAsObject() as any;
    const st = Number(row.students) || 0;
    const tr = Number(row.trained) || 0;
    const w10 = Number(row.trained_within_10) || 0;
    const a10 = Number(row.trained_after_10) || 0;
    byProgram.push({
      name: row.name,
      students: st,
      trained: tr,
      trained_within_10: w10,
      trained_within_10_pct: tr > 0 ? Number(((w10 / tr) * 100).toFixed(1)) : 0,
      trained_after_10: a10,
      trained_after_10_pct: tr > 0 ? Number(((a10 / tr) * 100).toFixed(1)) : 0,
      running_trained_pct: st > 0 ? Number(((tr / st) * 100).toFixed(1)) : 0,
      in_training: Number(row.in_training) || 0,
      batches: Number(row.batches) || 0,
    });
  }
  progStmt.free();

  // 5. Batch-level breakdown (for detailed table and audit)
  const batchStmt = db.prepare(`
    SELECT
      batch_code,
      center_code,
      program_name,
      funder_name,
      rm_sh_zh,
      assigned_trainers,
      batch_status,
      batch_actual_end_date,
      exam_schedule_date,
      COUNT(CASE WHEN LOWER(COALESCE(enrollment_status, '')) != 'dropped out' THEN 1 END) as students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 THEN 1 END) as trained,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 AND (julianday(COALESCE(exam_schedule_date, batch_actual_end_date)) - julianday(batch_actual_end_date)) <= 10 THEN 1 END) as trained_within_10,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(batch_status, ''))) IN ('complete', 'completed', 'running') AND LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'enrolled' AND final_exam_marks IS NOT NULL AND CAST(final_exam_marks AS REAL) >= 50 AND (julianday(COALESCE(exam_schedule_date, batch_actual_end_date)) - julianday(batch_actual_end_date)) > 10 THEN 1 END) as trained_after_10,
      ROUND(AVG(CASE WHEN exam_schedule_date IS NOT NULL AND batch_actual_end_date IS NOT NULL THEN (julianday(exam_schedule_date) - julianday(batch_actual_end_date)) END), 1) as avg_delay_days
    FROM raw_records
    WHERE ${where}
    GROUP BY batch_code
    ORDER BY trained_after_10 DESC, trained DESC
  `);
  batchStmt.bind(params);
  const batchesList: any[] = [];
  while (batchStmt.step()) {
    const row = batchStmt.getAsObject() as any;
    const st = Number(row.students) || 0;
    const tr = Number(row.trained) || 0;
    const w10 = Number(row.trained_within_10) || 0;
    const a10 = Number(row.trained_after_10) || 0;
    batchesList.push({
      batch_code: row.batch_code,
      center_code: row.center_code,
      program_name: row.program_name,
      funder_name: row.funder_name,
      rm_sh_zh: row.rm_sh_zh,
      assigned_trainers: row.assigned_trainers,
      batch_status: row.batch_status,
      batch_actual_end_date: row.batch_actual_end_date,
      exam_schedule_date: row.exam_schedule_date,
      students: st,
      trained: tr,
      trained_within_10: w10,
      trained_within_10_pct: tr > 0 ? Number(((w10 / tr) * 100).toFixed(1)) : 0,
      trained_after_10: a10,
      trained_after_10_pct: tr > 0 ? Number(((a10 / tr) * 100).toFixed(1)) : 0,
      avg_delay_days: row.avg_delay_days != null ? Number(row.avg_delay_days) : 0,
      status: a10 > 0 ? 'Delayed (> 10d)' : (w10 > 0 ? 'Within Time (<= 10d)' : (row.batch_status === 'running' ? 'In Training' : 'Pending Exam'))
    });
  }
  batchStmt.free();

  return {
    kpis: {
      total_students: totalStudents,
      total_students_including_dropouts: totalStudentsIncludingDropouts,
      total_trained: totalTrained,
      trained_within_10_days: trainedWithin10Days,
      trained_within_10_days_pct: trainedWithin10DaysPct,
      trained_after_10_days: trainedAfter10Days,
      trained_after_10_days_pct: trainedAfter10DaysPct,
      running_trained_pct: runningTrainedPct,
      active_in_training: activeInTraining,
      total_batches: Number(kpis.total_batches) || 0,
      running_batches: Number(kpis.running_batches) || 0,
      completed_batches: Number(kpis.completed_batches) || 0,
    },
    by_rm: consolidateUpvanDharForDiya(byRm, effectiveFilters.programType || filters.programType),
    by_center: byCenter,
    by_program: byProgram,
    batches: batchesList,
  };
}

// Running Batch Progress Analytics (Strictly Batch Status = "running", Average of Running Attendance %)
export async function getRunningBatchAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const effectiveFilters: FilterParams = {
    ...filters,
    module: 'running_batch',
    restrictDeepTech: true,
    programType: filters.programType || 'Diya and Deeptech',
    batchStatus: 'running',
  };
  const { where, params } = buildFilterWhere(effectiveFilters, { restrictDeepTech: true });

  const normRunningAttExpr = `(CASE WHEN running_attendance IS NOT NULL THEN (CASE WHEN CAST(running_attendance AS REAL) > 2.0 THEN CAST(running_attendance AS REAL) ELSE CAST(running_attendance AS REAL) * 100.0 END) ELSE NULL END)`;
  const normBenAttExpr = `(CASE WHEN beneficiary_class_attendance IS NOT NULL THEN (CASE WHEN CAST(beneficiary_class_attendance AS REAL) > 2.0 THEN CAST(beneficiary_class_attendance AS REAL) ELSE CAST(beneficiary_class_attendance AS REAL) * 100.0 END) ELSE NULL END)`;
  const normIltExpr = `(CASE WHEN ilt_completion IS NOT NULL THEN (CASE WHEN CAST(ilt_completion AS REAL) > 2.0 THEN CAST(ilt_completion AS REAL) ELSE CAST(ilt_completion AS REAL) * 100.0 END) ELSE NULL END)`;
  const normFmExpr = `(CASE WHEN fm_class_completion IS NOT NULL THEN (CASE WHEN CAST(fm_class_completion AS REAL) > 2.0 THEN CAST(fm_class_completion AS REAL) ELSE CAST(fm_class_completion AS REAL) * 100.0 END) ELSE NULL END)`;

  // 1. Overall KPIs for Batch Status = "running"
  const kpiStmt = db.prepare(`
    SELECT
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN 1 END) as enrolled_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'dropped out' THEN 1 END) as dropout_students,
      COUNT(DISTINCT batch_code) as running_batches,
      COUNT(DISTINCT center_code) as active_centers,
      COUNT(DISTINCT program_name) as active_programs,
      AVG(${normRunningAttExpr}) as avg_running_attendance,
      AVG(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN ${normRunningAttExpr} END) as enrolled_avg_running_attendance,
      AVG(${normBenAttExpr}) as avg_beneficiary_attendance,
      AVG(${normIltExpr}) as avg_ilt_completion,
      AVG(${normFmExpr}) as avg_fm_completion,
      COUNT(CASE WHEN ${normRunningAttExpr} >= 75 THEN 1 END) as students_gte_75,
      COUNT(CASE WHEN ${normRunningAttExpr} < 75 THEN 1 END) as students_lt_75,
      COUNT(CASE WHEN ${normRunningAttExpr} >= 50 THEN 1 END) as students_gte_50,
      COUNT(CASE WHEN ${normRunningAttExpr} < 50 THEN 1 END) as students_lt_50
    FROM raw_records
    WHERE ${where}
  `);
  kpiStmt.bind(params);
  let kpiRow: any = {};
  if (kpiStmt.step()) {
    kpiRow = kpiStmt.getAsObject();
  }
  kpiStmt.free();

  const totalStudents = Number(kpiRow.total_students) || 0;
  const enrolledStudents = Number(kpiRow.enrolled_students) || 0;
  const dropoutStudents = Number(kpiRow.dropout_students) || 0;
  const runningBatches = Number(kpiRow.running_batches) || 0;
  const activeCenters = Number(kpiRow.active_centers) || 0;
  const activePrograms = Number(kpiRow.active_programs) || 0;
  const avgRunningAttendance = kpiRow.avg_running_attendance != null ? Number(Number(kpiRow.avg_running_attendance).toFixed(1)) : 0;
  const enrolledAvgRunningAttendance = kpiRow.enrolled_avg_running_attendance != null ? Number(Number(kpiRow.enrolled_avg_running_attendance).toFixed(1)) : 0;
  const avgBeneficiaryAttendance = kpiRow.avg_beneficiary_attendance != null ? Number(Number(kpiRow.avg_beneficiary_attendance).toFixed(1)) : 0;
  const avgIltCompletion = kpiRow.avg_ilt_completion != null ? Number(Number(kpiRow.avg_ilt_completion).toFixed(1)) : 0;
  const avgFmCompletion = kpiRow.avg_fm_completion != null ? Number(Number(kpiRow.avg_fm_completion).toFixed(1)) : 0;
  const studentsGte75 = Number(kpiRow.students_gte_75) || 0;
  const studentsLt75 = Number(kpiRow.students_lt_75) || 0;
  const studentsGte75Pct = totalStudents > 0 ? Number(((studentsGte75 / totalStudents) * 100).toFixed(1)) : 0;
  const studentsLt75Pct = totalStudents > 0 ? Number(((studentsLt75 / totalStudents) * 100).toFixed(1)) : 0;
  const studentsGte50 = Number(kpiRow.students_gte_50) || 0;
  const studentsLt50 = Number(kpiRow.students_lt_50) || 0;
  const studentsGte50Pct = totalStudents > 0 ? Number(((studentsGte50 / totalStudents) * 100).toFixed(1)) : 0;
  const studentsLt50Pct = totalStudents > 0 ? Number(((studentsLt50 / totalStudents) * 100).toFixed(1)) : 0;

  // 2. Breakdown by RM / SH / ZH
  const rmStmt = db.prepare(`
    SELECT
      rm_sh_zh as name,
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN 1 END) as enrolled_students,
      COUNT(DISTINCT batch_code) as running_batches,
      SUM(COALESCE(${normRunningAttExpr}, 0)) as running_attendance_sum,
      COUNT(${normRunningAttExpr}) as running_attendance_count,
      AVG(${normRunningAttExpr}) as avg_running_attendance,
      SUM(COALESCE(${normBenAttExpr}, 0)) as beneficiary_attendance_sum,
      COUNT(${normBenAttExpr}) as beneficiary_attendance_count,
      AVG(${normBenAttExpr}) as avg_beneficiary_attendance,
      SUM(COALESCE(${normIltExpr}, 0)) as ilt_completion_sum,
      COUNT(${normIltExpr}) as ilt_completion_count,
      AVG(${normIltExpr}) as avg_ilt_completion,
      COUNT(CASE WHEN ${normRunningAttExpr} >= 75 THEN 1 END) as students_gte_75,
      COUNT(CASE WHEN ${normRunningAttExpr} < 75 THEN 1 END) as students_lt_75,
      COUNT(CASE WHEN ${normRunningAttExpr} >= 50 THEN 1 END) as students_gte_50,
      COUNT(CASE WHEN ${normRunningAttExpr} < 50 THEN 1 END) as students_lt_50
    FROM raw_records
    WHERE ${where} AND rm_sh_zh IS NOT NULL AND TRIM(rm_sh_zh) != ''
    GROUP BY rm_sh_zh
    ORDER BY avg_running_attendance DESC
  `);
  rmStmt.bind(params);
  const byRm: any[] = [];
  while (rmStmt.step()) {
    const r = rmStmt.getAsObject() as any;
    const tot = Number(r.total_students) || 0;
    const gte75 = Number(r.students_gte_75) || 0;
    const lt75 = Number(r.students_lt_75) || 0;
    const gte50 = Number(r.students_gte_50) || 0;
    const lt50 = Number(r.students_lt_50) || 0;
    byRm.push({
      name: r.name,
      rm_sh_zh: r.name,
      count: tot,
      total_students: tot,
      enrolled_students: Number(r.enrolled_students) || 0,
      running_batches: Number(r.running_batches) || 0,
      running_attendance_sum: Number(r.running_attendance_sum) || 0,
      running_attendance_count: Number(r.running_attendance_count) || 0,
      avg_running_attendance: r.avg_running_attendance != null ? Number(Number(r.avg_running_attendance).toFixed(1)) : 0,
      beneficiary_attendance_sum: Number(r.beneficiary_attendance_sum) || 0,
      beneficiary_attendance_count: Number(r.beneficiary_attendance_count) || 0,
      avg_beneficiary_attendance: r.avg_beneficiary_attendance != null ? Number(Number(r.avg_beneficiary_attendance).toFixed(1)) : 0,
      ilt_completion_sum: Number(r.ilt_completion_sum) || 0,
      ilt_completion_count: Number(r.ilt_completion_count) || 0,
      avg_ilt_completion: r.avg_ilt_completion != null ? Number(Number(r.avg_ilt_completion).toFixed(1)) : 0,
      students_gte_75: gte75,
      students_gte_75_pct: tot > 0 ? Number(((gte75 / tot) * 100).toFixed(1)) : 0,
      students_lt_75: lt75,
      students_lt_75_pct: tot > 0 ? Number(((lt75 / tot) * 100).toFixed(1)) : 0,
      students_gte_50: gte50,
      students_gte_50_pct: tot > 0 ? Number(((gte50 / tot) * 100).toFixed(1)) : 0,
      students_lt_50: lt50,
      students_lt_50_pct: tot > 0 ? Number(((lt50 / tot) * 100).toFixed(1)) : 0,
    });
  }
  rmStmt.free();

  // 3. Breakdown by Center
  const centerStmt = db.prepare(`
    SELECT
      center_code as name,
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN 1 END) as enrolled_students,
      COUNT(DISTINCT batch_code) as running_batches,
      SUM(COALESCE(${normRunningAttExpr}, 0)) as running_attendance_sum,
      COUNT(${normRunningAttExpr}) as running_attendance_count,
      AVG(${normRunningAttExpr}) as avg_running_attendance,
      AVG(${normBenAttExpr}) as avg_beneficiary_attendance,
      AVG(${normIltExpr}) as avg_ilt_completion,
      COUNT(CASE WHEN ${normRunningAttExpr} >= 75 THEN 1 END) as students_gte_75,
      COUNT(CASE WHEN ${normRunningAttExpr} < 75 THEN 1 END) as students_lt_75,
      COUNT(CASE WHEN ${normRunningAttExpr} >= 50 THEN 1 END) as students_gte_50,
      COUNT(CASE WHEN ${normRunningAttExpr} < 50 THEN 1 END) as students_lt_50
    FROM raw_records
    WHERE ${where} AND center_code IS NOT NULL AND TRIM(center_code) != ''
    GROUP BY center_code
    ORDER BY avg_running_attendance DESC
  `);
  centerStmt.bind(params);
  const byCenter: any[] = [];
  while (centerStmt.step()) {
    const r = centerStmt.getAsObject() as any;
    const tot = Number(r.total_students) || 0;
    const gte75 = Number(r.students_gte_75) || 0;
    const lt75 = Number(r.students_lt_75) || 0;
    const gte50 = Number(r.students_gte_50) || 0;
    const lt50 = Number(r.students_lt_50) || 0;
    byCenter.push({
      name: r.name,
      center_code: r.name,
      count: tot,
      total_students: tot,
      enrolled_students: Number(r.enrolled_students) || 0,
      running_batches: Number(r.running_batches) || 0,
      avg_running_attendance: r.avg_running_attendance != null ? Number(Number(r.avg_running_attendance).toFixed(1)) : 0,
      avg_beneficiary_attendance: r.avg_beneficiary_attendance != null ? Number(Number(r.avg_beneficiary_attendance).toFixed(1)) : 0,
      avg_ilt_completion: r.avg_ilt_completion != null ? Number(Number(r.avg_ilt_completion).toFixed(1)) : 0,
      students_gte_75: gte75,
      students_gte_75_pct: tot > 0 ? Number(((gte75 / tot) * 100).toFixed(1)) : 0,
      students_lt_75: lt75,
      students_lt_75_pct: tot > 0 ? Number(((lt75 / tot) * 100).toFixed(1)) : 0,
      students_gte_50: gte50,
      students_gte_50_pct: tot > 0 ? Number(((gte50 / tot) * 100).toFixed(1)) : 0,
      students_lt_50: lt50,
      students_lt_50_pct: tot > 0 ? Number(((lt50 / tot) * 100).toFixed(1)) : 0,
    });
  }
  centerStmt.free();

  // 4. Breakdown by Program
  const progStmt = db.prepare(`
    SELECT
      program_name as name,
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN 1 END) as enrolled_students,
      COUNT(DISTINCT batch_code) as running_batches,
      SUM(COALESCE(${normRunningAttExpr}, 0)) as running_attendance_sum,
      COUNT(${normRunningAttExpr}) as running_attendance_count,
      AVG(${normRunningAttExpr}) as avg_running_attendance,
      AVG(${normBenAttExpr}) as avg_beneficiary_attendance,
      AVG(${normIltExpr}) as avg_ilt_completion,
      COUNT(CASE WHEN ${normRunningAttExpr} >= 75 THEN 1 END) as students_gte_75,
      COUNT(CASE WHEN ${normRunningAttExpr} < 75 THEN 1 END) as students_lt_75,
      COUNT(CASE WHEN ${normRunningAttExpr} >= 50 THEN 1 END) as students_gte_50,
      COUNT(CASE WHEN ${normRunningAttExpr} < 50 THEN 1 END) as students_lt_50
    FROM raw_records
    WHERE ${where} AND program_name IS NOT NULL AND TRIM(program_name) != ''
    GROUP BY program_name
    ORDER BY avg_running_attendance DESC
  `);
  progStmt.bind(params);
  const byProgram: any[] = [];
  while (progStmt.step()) {
    const r = progStmt.getAsObject() as any;
    const tot = Number(r.total_students) || 0;
    const gte75 = Number(r.students_gte_75) || 0;
    const lt75 = Number(r.students_lt_75) || 0;
    const gte50 = Number(r.students_gte_50) || 0;
    const lt50 = Number(r.students_lt_50) || 0;
    byProgram.push({
      name: r.name,
      program_name: r.name,
      count: tot,
      total_students: tot,
      enrolled_students: Number(r.enrolled_students) || 0,
      running_batches: Number(r.running_batches) || 0,
      avg_running_attendance: r.avg_running_attendance != null ? Number(Number(r.avg_running_attendance).toFixed(1)) : 0,
      avg_beneficiary_attendance: r.avg_beneficiary_attendance != null ? Number(Number(r.avg_beneficiary_attendance).toFixed(1)) : 0,
      avg_ilt_completion: r.avg_ilt_completion != null ? Number(Number(r.avg_ilt_completion).toFixed(1)) : 0,
      students_gte_75: gte75,
      students_gte_75_pct: tot > 0 ? Number(((gte75 / tot) * 100).toFixed(1)) : 0,
      students_lt_75: lt75,
      students_lt_75_pct: tot > 0 ? Number(((lt75 / tot) * 100).toFixed(1)) : 0,
      students_gte_50: gte50,
      students_gte_50_pct: tot > 0 ? Number(((gte50 / tot) * 100).toFixed(1)) : 0,
      students_lt_50: lt50,
      students_lt_50_pct: tot > 0 ? Number(((lt50 / tot) * 100).toFixed(1)) : 0,
    });
  }
  progStmt.free();

  // 5. Running Batches Ledger List
  const batchStmt = db.prepare(`
    SELECT
      batch_code,
      center_code,
      program_name,
      funder_name,
      rm_sh_zh,
      assigned_trainers,
      batch_status,
      batch_start_date,
      batch_end_date,
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN 1 END) as enrolled_students,
      AVG(${normRunningAttExpr}) as avg_running_attendance,
      AVG(${normBenAttExpr}) as avg_beneficiary_attendance,
      AVG(${normIltExpr}) as avg_ilt_completion,
      AVG(${normFmExpr}) as avg_fm_completion,
      COUNT(CASE WHEN ${normRunningAttExpr} >= 75 THEN 1 END) as students_gte_75,
      COUNT(CASE WHEN ${normRunningAttExpr} < 75 THEN 1 END) as students_lt_75,
      COUNT(CASE WHEN ${normRunningAttExpr} >= 50 THEN 1 END) as students_gte_50,
      COUNT(CASE WHEN ${normRunningAttExpr} < 50 THEN 1 END) as students_lt_50
    FROM raw_records
    WHERE ${where} AND batch_code IS NOT NULL AND TRIM(batch_code) != ''
    GROUP BY batch_code
    ORDER BY avg_running_attendance DESC
  `);
  batchStmt.bind(params);
  const batchesList: any[] = [];
  while (batchStmt.step()) {
    const r = batchStmt.getAsObject() as any;
    const rawRm = String(r.rm_sh_zh || '').trim();
    const effectiveRm = rawRm.toLowerCase().includes('upvan') ? 'Krishna Prasad' : rawRm;
    batchesList.push({
      batch_code: r.batch_code,
      center_code: r.center_code || '',
      program_name: r.program_name || '',
      funder_name: r.funder_name || '',
      rm_sh_zh: effectiveRm,
      assigned_trainers: r.assigned_trainers || '',
      batch_status: r.batch_status || 'running',
      batch_start_date: r.batch_start_date || null,
      batch_end_date: r.batch_end_date || null,
      total_students: Number(r.total_students) || 0,
      enrolled_students: Number(r.enrolled_students) || 0,
      avg_running_attendance: r.avg_running_attendance != null ? Number(Number(r.avg_running_attendance).toFixed(1)) : 0,
      avg_beneficiary_attendance: r.avg_beneficiary_attendance != null ? Number(Number(r.avg_beneficiary_attendance).toFixed(1)) : 0,
      avg_ilt_completion: r.avg_ilt_completion != null ? Number(Number(r.avg_ilt_completion).toFixed(1)) : 0,
      avg_fm_completion: r.avg_fm_completion != null ? Number(Number(r.avg_fm_completion).toFixed(1)) : 0,
      students_gte_75: Number(r.students_gte_75) || 0,
      students_lt_75: Number(r.students_lt_75) || 0,
      students_gte_50: Number(r.students_gte_50) || 0,
      students_lt_50: Number(r.students_lt_50) || 0,
    });
  }
  batchStmt.free();

  const consolidatedByRm = consolidateUpvanDharForDiya(byRm, effectiveFilters.programType || filters.programType)
    .sort((a: any, b: any) => (b.avg_running_attendance || 0) - (a.avg_running_attendance || 0));

  return {
    kpis: {
      avg_running_attendance: avgRunningAttendance,
      enrolled_avg_running_attendance: enrolledAvgRunningAttendance,
      avg_beneficiary_attendance: avgBeneficiaryAttendance,
      avg_ilt_completion: avgIltCompletion,
      avg_fm_completion: avgFmCompletion,
      running_batches: runningBatches,
      total_students: totalStudents,
      enrolled_students: enrolledStudents,
      dropout_students: dropoutStudents,
      active_centers: activeCenters,
      active_programs: activePrograms,
      students_gte_75: studentsGte75,
      students_gte_75_pct: studentsGte75Pct,
      students_lt_75: studentsLt75,
      students_lt_75_pct: studentsLt75Pct,
      students_gte_50: studentsGte50,
      students_gte_50_pct: studentsGte50Pct,
      students_lt_50: studentsLt50,
      students_lt_50_pct: studentsLt50Pct,
    },
    by_rm: consolidatedByRm,
    by_center: byCenter,
    by_program: byProgram,
    batches: batchesList,
  };
}

// Closed Batch Progress Analytics (Strictly Batch Status = "complete", Average of Beneficiary_Class_Attendance %)
export async function getClosedBatchAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const effectiveFilters: FilterParams = {
    ...filters,
    module: 'closed_batch',
    restrictDeepTech: true,
    programType: filters.programType || 'Diya and Deeptech',
    batchStatus: 'complete',
  };
  const { where, params } = buildFilterWhere(effectiveFilters, { restrictDeepTech: true });

  const normBenAttExpr = `(CASE WHEN beneficiary_class_attendance IS NOT NULL THEN (CASE WHEN CAST(beneficiary_class_attendance AS REAL) > 2.0 THEN CAST(beneficiary_class_attendance AS REAL) ELSE CAST(beneficiary_class_attendance AS REAL) * 100.0 END) ELSE NULL END)`;
  const normRunningAttExpr = `(CASE WHEN running_attendance IS NOT NULL THEN (CASE WHEN CAST(running_attendance AS REAL) > 2.0 THEN CAST(running_attendance AS REAL) ELSE CAST(running_attendance AS REAL) * 100.0 END) ELSE NULL END)`;
  const normIltExpr = `(CASE WHEN ilt_completion IS NOT NULL THEN (CASE WHEN CAST(ilt_completion AS REAL) > 2.0 THEN CAST(ilt_completion AS REAL) ELSE CAST(ilt_completion AS REAL) * 100.0 END) ELSE NULL END)`;
  const normFmExpr = `(CASE WHEN fm_class_completion IS NOT NULL THEN (CASE WHEN CAST(fm_class_completion AS REAL) > 2.0 THEN CAST(fm_class_completion AS REAL) ELSE CAST(fm_class_completion AS REAL) * 100.0 END) ELSE NULL END)`;

  // 1. Overall KPIs for Batch Status = "complete"
  const kpiStmt = db.prepare(`
    SELECT
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN 1 END) as enrolled_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) = 'dropped out' THEN 1 END) as dropout_students,
      COUNT(DISTINCT batch_code) as completed_batches,
      COUNT(DISTINCT center_code) as active_centers,
      COUNT(DISTINCT program_name) as active_programs,
      AVG(${normBenAttExpr}) as avg_beneficiary_attendance,
      AVG(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN ${normBenAttExpr} END) as enrolled_avg_beneficiary_attendance,
      AVG(${normRunningAttExpr}) as avg_running_attendance,
      AVG(${normIltExpr}) as avg_ilt_completion,
      AVG(${normFmExpr}) as avg_fm_completion,
      COUNT(CASE WHEN ${normBenAttExpr} >= 75 THEN 1 END) as students_gte_75,
      COUNT(CASE WHEN ${normBenAttExpr} < 75 THEN 1 END) as students_lt_75,
      COUNT(CASE WHEN ${normBenAttExpr} >= 50 THEN 1 END) as students_gte_50,
      COUNT(CASE WHEN ${normBenAttExpr} < 50 THEN 1 END) as students_lt_50
    FROM raw_records
    WHERE ${where}
  `);
  kpiStmt.bind(params);
  let kpiRow: any = {};
  if (kpiStmt.step()) {
    kpiRow = kpiStmt.getAsObject();
  }
  kpiStmt.free();

  const totalStudents = Number(kpiRow.total_students) || 0;
  const enrolledStudents = Number(kpiRow.enrolled_students) || 0;
  const dropoutStudents = Number(kpiRow.dropout_students) || 0;
  const completedBatches = Number(kpiRow.completed_batches) || 0;
  const activeCenters = Number(kpiRow.active_centers) || 0;
  const activePrograms = Number(kpiRow.active_programs) || 0;
  const avgBeneficiaryAttendance = kpiRow.avg_beneficiary_attendance != null ? Number(Number(kpiRow.avg_beneficiary_attendance).toFixed(1)) : 0;
  const enrolledAvgBeneficiaryAttendance = kpiRow.enrolled_avg_beneficiary_attendance != null ? Number(Number(kpiRow.enrolled_avg_beneficiary_attendance).toFixed(1)) : 0;
  const avgRunningAttendance = kpiRow.avg_running_attendance != null ? Number(Number(kpiRow.avg_running_attendance).toFixed(1)) : 0;
  const avgIltCompletion = kpiRow.avg_ilt_completion != null ? Number(Number(kpiRow.avg_ilt_completion).toFixed(1)) : 0;
  const avgFmCompletion = kpiRow.avg_fm_completion != null ? Number(Number(kpiRow.avg_fm_completion).toFixed(1)) : 0;
  const studentsGte75 = Number(kpiRow.students_gte_75) || 0;
  const studentsLt75 = Number(kpiRow.students_lt_75) || 0;
  const studentsGte75Pct = totalStudents > 0 ? Number(((studentsGte75 / totalStudents) * 100).toFixed(1)) : 0;
  const studentsLt75Pct = totalStudents > 0 ? Number(((studentsLt75 / totalStudents) * 100).toFixed(1)) : 0;
  const studentsGte50 = Number(kpiRow.students_gte_50) || 0;
  const studentsLt50 = Number(kpiRow.students_lt_50) || 0;
  const studentsGte50Pct = totalStudents > 0 ? Number(((studentsGte50 / totalStudents) * 100).toFixed(1)) : 0;
  const studentsLt50Pct = totalStudents > 0 ? Number(((studentsLt50 / totalStudents) * 100).toFixed(1)) : 0;

  // 2. Breakdown by RM / SH / ZH
  const rmStmt = db.prepare(`
    SELECT
      rm_sh_zh as name,
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN 1 END) as enrolled_students,
      COUNT(DISTINCT batch_code) as completed_batches,
      SUM(COALESCE(${normBenAttExpr}, 0)) as beneficiary_attendance_sum,
      COUNT(${normBenAttExpr}) as beneficiary_attendance_count,
      AVG(${normBenAttExpr}) as avg_beneficiary_attendance,
      SUM(COALESCE(${normRunningAttExpr}, 0)) as running_attendance_sum,
      COUNT(${normRunningAttExpr}) as running_attendance_count,
      AVG(${normRunningAttExpr}) as avg_running_attendance,
      SUM(COALESCE(${normIltExpr}, 0)) as ilt_completion_sum,
      COUNT(${normIltExpr}) as ilt_completion_count,
      AVG(${normIltExpr}) as avg_ilt_completion,
      COUNT(CASE WHEN ${normBenAttExpr} >= 75 THEN 1 END) as students_gte_75,
      COUNT(CASE WHEN ${normBenAttExpr} < 75 THEN 1 END) as students_lt_75,
      COUNT(CASE WHEN ${normBenAttExpr} >= 50 THEN 1 END) as students_gte_50,
      COUNT(CASE WHEN ${normBenAttExpr} < 50 THEN 1 END) as students_lt_50
    FROM raw_records
    WHERE ${where} AND rm_sh_zh IS NOT NULL AND TRIM(rm_sh_zh) != ''
    GROUP BY rm_sh_zh
    ORDER BY avg_beneficiary_attendance DESC
  `);
  rmStmt.bind(params);
  const byRm: any[] = [];
  while (rmStmt.step()) {
    const r = rmStmt.getAsObject() as any;
    const tot = Number(r.total_students) || 0;
    const gte75 = Number(r.students_gte_75) || 0;
    const lt75 = Number(r.students_lt_75) || 0;
    const gte50 = Number(r.students_gte_50) || 0;
    const lt50 = Number(r.students_lt_50) || 0;
    byRm.push({
      name: r.name,
      rm_sh_zh: r.name,
      count: tot,
      total_students: tot,
      enrolled_students: Number(r.enrolled_students) || 0,
      completed_batches: Number(r.completed_batches) || 0,
      beneficiary_attendance_sum: Number(r.beneficiary_attendance_sum) || 0,
      beneficiary_attendance_count: Number(r.beneficiary_attendance_count) || 0,
      avg_beneficiary_attendance: r.avg_beneficiary_attendance != null ? Number(Number(r.avg_beneficiary_attendance).toFixed(1)) : 0,
      running_attendance_sum: Number(r.running_attendance_sum) || 0,
      running_attendance_count: Number(r.running_attendance_count) || 0,
      avg_running_attendance: r.avg_running_attendance != null ? Number(Number(r.avg_running_attendance).toFixed(1)) : 0,
      ilt_completion_sum: Number(r.ilt_completion_sum) || 0,
      ilt_completion_count: Number(r.ilt_completion_count) || 0,
      avg_ilt_completion: r.avg_ilt_completion != null ? Number(Number(r.avg_ilt_completion).toFixed(1)) : 0,
      students_gte_75: gte75,
      students_gte_75_pct: tot > 0 ? Number(((gte75 / tot) * 100).toFixed(1)) : 0,
      students_lt_75: lt75,
      students_lt_75_pct: tot > 0 ? Number(((lt75 / tot) * 100).toFixed(1)) : 0,
      students_gte_50: gte50,
      students_gte_50_pct: tot > 0 ? Number(((gte50 / tot) * 100).toFixed(1)) : 0,
      students_lt_50: lt50,
      students_lt_50_pct: tot > 0 ? Number(((lt50 / tot) * 100).toFixed(1)) : 0,
    });
  }
  rmStmt.free();

  // 3. Breakdown by Center
  const centerStmt = db.prepare(`
    SELECT
      center_code as name,
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN 1 END) as enrolled_students,
      COUNT(DISTINCT batch_code) as completed_batches,
      SUM(COALESCE(${normBenAttExpr}, 0)) as beneficiary_attendance_sum,
      COUNT(${normBenAttExpr}) as beneficiary_attendance_count,
      AVG(${normBenAttExpr}) as avg_beneficiary_attendance,
      AVG(${normRunningAttExpr}) as avg_running_attendance,
      AVG(${normIltExpr}) as avg_ilt_completion,
      COUNT(CASE WHEN ${normBenAttExpr} >= 75 THEN 1 END) as students_gte_75,
      COUNT(CASE WHEN ${normBenAttExpr} < 75 THEN 1 END) as students_lt_75,
      COUNT(CASE WHEN ${normBenAttExpr} >= 50 THEN 1 END) as students_gte_50,
      COUNT(CASE WHEN ${normBenAttExpr} < 50 THEN 1 END) as students_lt_50
    FROM raw_records
    WHERE ${where} AND center_code IS NOT NULL AND TRIM(center_code) != ''
    GROUP BY center_code
    ORDER BY avg_beneficiary_attendance DESC
  `);
  centerStmt.bind(params);
  const byCenter: any[] = [];
  while (centerStmt.step()) {
    const r = centerStmt.getAsObject() as any;
    const tot = Number(r.total_students) || 0;
    const gte75 = Number(r.students_gte_75) || 0;
    const lt75 = Number(r.students_lt_75) || 0;
    const gte50 = Number(r.students_gte_50) || 0;
    const lt50 = Number(r.students_lt_50) || 0;
    byCenter.push({
      name: r.name,
      center_code: r.name,
      count: tot,
      total_students: tot,
      enrolled_students: Number(r.enrolled_students) || 0,
      completed_batches: Number(r.completed_batches) || 0,
      avg_beneficiary_attendance: r.avg_beneficiary_attendance != null ? Number(Number(r.avg_beneficiary_attendance).toFixed(1)) : 0,
      avg_running_attendance: r.avg_running_attendance != null ? Number(Number(r.avg_running_attendance).toFixed(1)) : 0,
      avg_ilt_completion: r.avg_ilt_completion != null ? Number(Number(r.avg_ilt_completion).toFixed(1)) : 0,
      students_gte_75: gte75,
      students_gte_75_pct: tot > 0 ? Number(((gte75 / tot) * 100).toFixed(1)) : 0,
      students_lt_75: lt75,
      students_lt_75_pct: tot > 0 ? Number(((lt75 / tot) * 100).toFixed(1)) : 0,
      students_gte_50: gte50,
      students_gte_50_pct: tot > 0 ? Number(((gte50 / tot) * 100).toFixed(1)) : 0,
      students_lt_50: lt50,
      students_lt_50_pct: tot > 0 ? Number(((lt50 / tot) * 100).toFixed(1)) : 0,
    });
  }
  centerStmt.free();

  // 4. Breakdown by Program
  const progStmt = db.prepare(`
    SELECT
      program_name as name,
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN 1 END) as enrolled_students,
      COUNT(DISTINCT batch_code) as completed_batches,
      SUM(COALESCE(${normBenAttExpr}, 0)) as beneficiary_attendance_sum,
      COUNT(${normBenAttExpr}) as beneficiary_attendance_count,
      AVG(${normBenAttExpr}) as avg_beneficiary_attendance,
      AVG(${normRunningAttExpr}) as avg_running_attendance,
      AVG(${normIltExpr}) as avg_ilt_completion,
      COUNT(CASE WHEN ${normBenAttExpr} >= 75 THEN 1 END) as students_gte_75,
      COUNT(CASE WHEN ${normBenAttExpr} < 75 THEN 1 END) as students_lt_75,
      COUNT(CASE WHEN ${normBenAttExpr} >= 50 THEN 1 END) as students_gte_50,
      COUNT(CASE WHEN ${normBenAttExpr} < 50 THEN 1 END) as students_lt_50
    FROM raw_records
    WHERE ${where} AND program_name IS NOT NULL AND TRIM(program_name) != ''
    GROUP BY program_name
    ORDER BY avg_beneficiary_attendance DESC
  `);
  progStmt.bind(params);
  const byProgram: any[] = [];
  while (progStmt.step()) {
    const r = progStmt.getAsObject() as any;
    const tot = Number(r.total_students) || 0;
    const gte75 = Number(r.students_gte_75) || 0;
    const lt75 = Number(r.students_lt_75) || 0;
    const gte50 = Number(r.students_gte_50) || 0;
    const lt50 = Number(r.students_lt_50) || 0;
    byProgram.push({
      name: r.name,
      program_name: r.name,
      count: tot,
      total_students: tot,
      enrolled_students: Number(r.enrolled_students) || 0,
      completed_batches: Number(r.completed_batches) || 0,
      avg_beneficiary_attendance: r.avg_beneficiary_attendance != null ? Number(Number(r.avg_beneficiary_attendance).toFixed(1)) : 0,
      avg_running_attendance: r.avg_running_attendance != null ? Number(Number(r.avg_running_attendance).toFixed(1)) : 0,
      avg_ilt_completion: r.avg_ilt_completion != null ? Number(Number(r.avg_ilt_completion).toFixed(1)) : 0,
      students_gte_75: gte75,
      students_gte_75_pct: tot > 0 ? Number(((gte75 / tot) * 100).toFixed(1)) : 0,
      students_lt_75: lt75,
      students_lt_75_pct: tot > 0 ? Number(((lt75 / tot) * 100).toFixed(1)) : 0,
      students_gte_50: gte50,
      students_gte_50_pct: tot > 0 ? Number(((gte50 / tot) * 100).toFixed(1)) : 0,
      students_lt_50: lt50,
      students_lt_50_pct: tot > 0 ? Number(((lt50 / tot) * 100).toFixed(1)) : 0,
    });
  }
  progStmt.free();

  // 5. Closed Batches Ledger List
  const batchStmt = db.prepare(`
    SELECT
      batch_code,
      center_code,
      program_name,
      funder_name,
      rm_sh_zh,
      assigned_trainers,
      batch_status,
      batch_start_date,
      batch_end_date,
      batch_actual_end_date,
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(TRIM(COALESCE(enrollment_status, ''))) != 'dropped out' THEN 1 END) as enrolled_students,
      AVG(${normBenAttExpr}) as avg_beneficiary_attendance,
      AVG(${normRunningAttExpr}) as avg_running_attendance,
      AVG(${normIltExpr}) as avg_ilt_completion,
      AVG(${normFmExpr}) as avg_fm_completion,
      COUNT(CASE WHEN ${normBenAttExpr} >= 75 THEN 1 END) as students_gte_75,
      COUNT(CASE WHEN ${normBenAttExpr} < 75 THEN 1 END) as students_lt_75,
      COUNT(CASE WHEN ${normBenAttExpr} >= 50 THEN 1 END) as students_gte_50,
      COUNT(CASE WHEN ${normBenAttExpr} < 50 THEN 1 END) as students_lt_50
    FROM raw_records
    WHERE ${where} AND batch_code IS NOT NULL AND TRIM(batch_code) != ''
    GROUP BY batch_code
    ORDER BY avg_beneficiary_attendance DESC
  `);
  batchStmt.bind(params);
  const batchesList: any[] = [];
  while (batchStmt.step()) {
    const r = batchStmt.getAsObject() as any;
    const rawRm = String(r.rm_sh_zh || '').trim();
    const effectiveRm = rawRm.toLowerCase().includes('upvan') ? 'Krishna Prasad' : rawRm;
    batchesList.push({
      batch_code: r.batch_code,
      center_code: r.center_code || '',
      program_name: r.program_name || '',
      funder_name: r.funder_name || '',
      rm_sh_zh: effectiveRm,
      assigned_trainers: r.assigned_trainers || '',
      batch_status: r.batch_status || 'complete',
      batch_start_date: r.batch_start_date || null,
      batch_end_date: r.batch_end_date || null,
      batch_actual_end_date: r.batch_actual_end_date || null,
      total_students: Number(r.total_students) || 0,
      enrolled_students: Number(r.enrolled_students) || 0,
      avg_beneficiary_attendance: r.avg_beneficiary_attendance != null ? Number(Number(r.avg_beneficiary_attendance).toFixed(1)) : 0,
      avg_running_attendance: r.avg_running_attendance != null ? Number(Number(r.avg_running_attendance).toFixed(1)) : 0,
      avg_ilt_completion: r.avg_ilt_completion != null ? Number(Number(r.avg_ilt_completion).toFixed(1)) : 0,
      avg_fm_completion: r.avg_fm_completion != null ? Number(Number(r.avg_fm_completion).toFixed(1)) : 0,
      students_gte_75: Number(r.students_gte_75) || 0,
      students_lt_75: Number(r.students_lt_75) || 0,
      students_gte_50: Number(r.students_gte_50) || 0,
      students_lt_50: Number(r.students_lt_50) || 0,
    });
  }
  batchStmt.free();

  const consolidatedByRm = consolidateUpvanDharForDiya(byRm, effectiveFilters.programType || filters.programType)
    .sort((a: any, b: any) => (b.avg_beneficiary_attendance || 0) - (a.avg_beneficiary_attendance || 0));

  return {
    kpis: {
      avg_beneficiary_attendance: avgBeneficiaryAttendance,
      enrolled_avg_beneficiary_attendance: enrolledAvgBeneficiaryAttendance,
      avg_running_attendance: avgRunningAttendance,
      avg_ilt_completion: avgIltCompletion,
      avg_fm_completion: avgFmCompletion,
      completed_batches: completedBatches,
      total_students: totalStudents,
      enrolled_students: enrolledStudents,
      dropout_students: dropoutStudents,
      active_centers: activeCenters,
      active_programs: activePrograms,
      students_gte_75: studentsGte75,
      students_gte_75_pct: studentsGte75Pct,
      students_lt_75: studentsLt75,
      students_lt_75_pct: studentsLt75Pct,
      students_gte_50: studentsGte50,
      students_gte_50_pct: studentsGte50Pct,
      students_lt_50: studentsLt50,
      students_lt_50_pct: studentsLt50Pct,
    },
    by_rm: consolidatedByRm,
    by_center: byCenter,
    by_program: byProgram,
    batches: batchesList,
  };
}

// Faculty Deployment & Workload Analytics
export async function getFacultyAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const { where, params } = buildFilterWhere(filters);

  // Group by distinct assigned trainer
  const trainerQuery = `
    SELECT
      assigned_trainers as trainer_name,
      COUNT(DISTINCT batch_code) as total_batches,
      COUNT(DISTINCT CASE WHEN LOWER(batch_status) = 'running' THEN batch_code END) as active_batches,
      COUNT(DISTINCT CASE WHEN LOWER(batch_status) = 'complete' OR LOWER(batch_status) = 'completed' THEN batch_code END) as completed_batches,
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(batch_status) = 'running' THEN 1 END) as active_students,
      COUNT(DISTINCT center_code) as center_count,
      COUNT(DISTINCT program_name) as program_count,
      AVG(running_attendance) as avg_attendance,
      AVG(ilt_completion) as avg_ilt_completion,
      AVG(fm_class_completion) as avg_fm_completion,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropouts,
      COUNT(DISTINCT CASE WHEN incomplete_attendance_exception = 1 THEN student_code || '_' || batch_code END) as exceptions
    FROM raw_records
    WHERE ${where} AND assigned_trainers IS NOT NULL AND assigned_trainers != ''
    GROUP BY assigned_trainers
    ORDER BY active_batches DESC, total_students DESC
  `;

  const stmt = db.prepare(trainerQuery);
  stmt.bind(params);

  let totalTrainers = 0;
  let trainersWithActiveBatches = 0;
  let trainersWithCompletedBatches = 0;
  let trainersWithMultipleActiveBatches = 0;
  let totalActiveBatchesAcrossTrainers = 0;
  let totalActiveStudentsAcrossTrainers = 0;

  const trainerList: any[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    totalTrainers++;

    const activeBatches = Number(row.active_batches) || 0;
    const completedBatches = Number(row.completed_batches) || 0;
    const activeStudents = Number(row.active_students) || 0;
    const totalStudents = Number(row.total_students) || 0;
    const dropouts = Number(row.dropouts) || 0;

    if (activeBatches > 0) {
      trainersWithActiveBatches++;
      totalActiveBatchesAcrossTrainers += activeBatches;
      totalActiveStudentsAcrossTrainers += activeStudents;
    }
    if (completedBatches > 0) {
      trainersWithCompletedBatches++;
    }
    if (activeBatches > 1) {
      trainersWithMultipleActiveBatches++;
    }

    // Faculty Deployment Index Proxy (Score based on active load & student volume normalized)
    // Formula: (active_batches * 25) + (active_students / 1.5) capped at 100 for index indication
    const deploymentIndex = Math.min(100, Math.round((activeBatches * 30) + (activeStudents * 1.2)));

    trainerList.push({
      trainer_name: row.trainer_name,
      total_batches: Number(row.total_batches) || 0,
      active_batches: activeBatches,
      completed_batches: completedBatches,
      total_students: totalStudents,
      active_students: activeStudents,
      center_count: Number(row.center_count) || 0,
      program_count: Number(row.program_count) || 0,
      avg_attendance: row.avg_attendance ? Number((row.avg_attendance * 100).toFixed(1)) : 0,
      avg_ilt_completion: row.avg_ilt_completion ? Number((row.avg_ilt_completion * 100).toFixed(1)) : 0,
      avg_fm_completion: row.avg_fm_completion ? Number((row.avg_fm_completion * 100).toFixed(1)) : 0,
      dropouts,
      dropout_rate: totalStudents > 0 ? Number(((dropouts / totalStudents) * 100).toFixed(1)) : 0,
      exceptions: Number(row.exceptions) || 0,
      faculty_deployment_index: deploymentIndex,
    });
  }
  stmt.free();

  const avgActiveBatchesPerTrainer = trainersWithActiveBatches > 0
    ? Number((totalActiveBatchesAcrossTrainers / trainersWithActiveBatches).toFixed(1))
    : 0;
  const avgStudentsPerActiveTrainer = trainersWithActiveBatches > 0
    ? Number((totalActiveStudentsAcrossTrainers / trainersWithActiveBatches).toFixed(1))
    : 0;

  return {
    kpis: {
      total_trainers: totalTrainers,
      trainers_assigned_active_batches: trainersWithActiveBatches,
      trainers_assigned_completed_batches: trainersWithCompletedBatches,
      trainers_multiple_active_batches: trainersWithMultipleActiveBatches,
      avg_active_batches_per_trainer: avgActiveBatchesPerTrainer,
      avg_students_per_active_trainer: avgStudentsPerActiveTrainer,
      is_proxy_enabled: currentSettings.enableFacultyDeploymentIndex,
    },
    proxy_disclaimer: "Faculty Deployment Index is an analytical proxy based on available batch and student allocation data. It is not a calculation of actual working-hour utilisation.",
    trainers: trainerList,
  };
}

// Student Validation Analytics
export async function getStudentValidationAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const { where, params } = buildFilterWhere(filters);

  const kpiStmt = db.prepare(`
    SELECT
      COUNT(*) as total_students,
      COUNT(CASE WHEN validation_status IS NOT NULL AND validation_status != 'Not Available' AND validation_status != '' THEN 1 END) as students_with_validation_status,
      COUNT(CASE WHEN validation_status = 'Validated' THEN 1 END) as validated_students,
      COUNT(CASE WHEN validation_status = 'ReValidated' THEN 1 END) as revalidated_students,
      COUNT(CASE WHEN validation_status = 'Pending' THEN 1 END) as pending_students,
      COUNT(CASE WHEN validation_status = 'Absent' THEN 1 END) as absent_students,
      COUNT(CASE WHEN validation_status = 'Rejected' THEN 1 END) as rejected_students
    FROM raw_records
    WHERE ${where}
  `);
  kpiStmt.bind(params);
  let kpis: any = {};
  if (kpiStmt.step()) {
    kpis = kpiStmt.getAsObject();
  }
  kpiStmt.free();

  const totalStudents = Number(kpis.total_students) || 0;
  const studentsWithVal = Number(kpis.students_with_validation_status) || 0;
  const validated = Number(kpis.validated_students) || 0;
  const revalidated = Number(kpis.revalidated_students) || 0;
  const validationCompletionPct = studentsWithVal > 0 ? ((validated + revalidated) / studentsWithVal) * 100 : 0;

  // Breakdown by Status
  const statusDistStmt = db.prepare(`
    SELECT
      COALESCE(NULLIF(validation_status, ''), 'Not Available') as status,
      COUNT(*) as count
    FROM raw_records
    WHERE ${where}
    GROUP BY status
  `);
  statusDistStmt.bind(params);
  const statusDistribution: { name: string; value: number }[] = [];
  while (statusDistStmt.step()) {
    const row = statusDistStmt.getAsObject();
    statusDistribution.push({ name: row.status as string, value: Number(row.count) });
  }
  statusDistStmt.free();

  // Breakdown by Validator
  const validatorStmt = db.prepare(`
    SELECT
      COALESCE(NULLIF(validation_done_by, ''), 'Unassigned') as validator,
      COUNT(*) as total_processed,
      COUNT(CASE WHEN validation_status = 'Validated' THEN 1 END) as validated_count,
      COUNT(CASE WHEN validation_status = 'ReValidated' THEN 1 END) as revalidated_count,
      COUNT(CASE WHEN validation_status = 'Pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN validation_status = 'Rejected' THEN 1 END) as rejected_count,
      COUNT(CASE WHEN validation_status = 'Absent' THEN 1 END) as absent_count
    FROM raw_records
    WHERE ${where} AND validation_done_by IS NOT NULL AND validation_done_by != ''
    GROUP BY validation_done_by
    ORDER BY total_processed DESC
  `);
  validatorStmt.bind(params);
  const validatorBreakdown: any[] = [];
  while (validatorStmt.step()) {
    validatorBreakdown.push(validatorStmt.getAsObject());
  }
  validatorStmt.free();

  // Breakdown by Center
  const centerValStmt = db.prepare(`
    SELECT
      center_code,
      COUNT(*) as total_students,
      COUNT(CASE WHEN validation_status = 'Validated' OR validation_status = 'ReValidated' THEN 1 END) as completed_validations,
      COUNT(CASE WHEN validation_status = 'Pending' THEN 1 END) as pending_validations,
      COUNT(CASE WHEN validation_status = 'Rejected' THEN 1 END) as rejected_validations
    FROM raw_records
    WHERE ${where}
    GROUP BY center_code
    ORDER BY total_students DESC
  `);
  centerValStmt.bind(params);
  const centerBreakdown: any[] = [];
  while (centerValStmt.step()) {
    const row = centerValStmt.getAsObject();
    const tot = Number(row.total_students) || 0;
    const comp = Number(row.completed_validations) || 0;
    centerBreakdown.push({
      center_code: row.center_code,
      total_students: tot,
      completed_validations: comp,
      pending_validations: Number(row.pending_validations) || 0,
      rejected_validations: Number(row.rejected_validations) || 0,
      completion_rate: tot > 0 ? Number(((comp / tot) * 100).toFixed(1)) : 0
    });
  }
  centerValStmt.free();

  return {
    kpis: {
      total_students: totalStudents,
      students_with_validation_status: studentsWithVal,
      validated_students: validated,
      revalidated_students: revalidated,
      pending_students: Number(kpis.pending_students) || 0,
      absent_students: Number(kpis.absent_students) || 0,
      rejected_students: Number(kpis.rejected_students) || 0,
      validation_completion_pct: Number(validationCompletionPct.toFixed(2)),
    },
    status_distribution: statusDistribution,
    validator_breakdown: validatorBreakdown,
    center_breakdown: centerBreakdown,
  };
}

// Attendance & Academic Progress Analytics
export async function getAttendanceAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const { where, params } = buildFilterWhere(filters);

  const kpiStmt = db.prepare(`
    SELECT
      COUNT(*) as total_students,
      AVG(running_attendance) as avg_running_attendance,
      AVG(beneficiary_class_attendance) as avg_beneficiary_attendance,
      AVG(ilt_completion) as avg_ilt_completion,
      AVG(fm_class_completion) as avg_fm_completion,
      COUNT(CASE WHEN (running_attendance < ? OR beneficiary_class_attendance < ?) THEN 1 END) as students_below_attendance_threshold,
      COUNT(CASE WHEN (ilt_completion < ? OR fm_class_completion < ?) THEN 1 END) as students_below_completion_threshold
    FROM raw_records
    WHERE ${where}
  `);
  kpiStmt.bind([
    ...params,
    currentSettings.attendanceThreshold,
    currentSettings.attendanceThreshold,
    currentSettings.completionThreshold,
    currentSettings.completionThreshold
  ]);
  let kpis: any = {};
  if (kpiStmt.step()) {
    kpis = kpiStmt.getAsObject();
  }
  kpiStmt.free();

  // Breakdown by Center
  const centerStmt = db.prepare(`
    SELECT
      center_code,
      COUNT(*) as students,
      AVG(running_attendance) as avg_attendance,
      AVG(beneficiary_class_attendance) as avg_beneficiary_attendance,
      AVG(ilt_completion) as avg_ilt_completion,
      AVG(fm_class_completion) as avg_fm_completion
    FROM raw_records
    WHERE ${where}
    GROUP BY center_code
    ORDER BY avg_attendance ASC
  `);
  centerStmt.bind(params);
  const centerAttendance: any[] = [];
  while (centerStmt.step()) {
    const row = centerStmt.getAsObject() as any;
    centerAttendance.push({
      center_code: row.center_code,
      students: Number(row.students) || 0,
      avg_running_attendance: row.avg_attendance ? Number((row.avg_attendance * 100).toFixed(1)) : 0,
      avg_beneficiary_attendance: row.avg_beneficiary_attendance ? Number((row.avg_beneficiary_attendance * 100).toFixed(1)) : 0,
      avg_ilt_completion: row.avg_ilt_completion ? Number((row.avg_ilt_completion * 100).toFixed(1)) : 0,
      avg_fm_completion: row.avg_fm_completion ? Number((row.avg_fm_completion * 100).toFixed(1)) : 0,
    });
  }
  centerStmt.free();

  // Attention Area: Low Attendance Student List
  const lowAttendanceListStmt = db.prepare(`
    SELECT
      student_code,
      batch_code,
      center_code,
      program_name,
      assigned_trainers,
      running_attendance,
      beneficiary_class_attendance,
      ilt_completion,
      fm_class_completion,
      enrollment_status
    FROM raw_records
    WHERE ${where} AND (running_attendance < ? OR beneficiary_class_attendance < ?)
    LIMIT 100
  `);
  lowAttendanceListStmt.bind([...params, currentSettings.attendanceThreshold, currentSettings.attendanceThreshold]);
  const lowAttendanceList: any[] = [];
  while (lowAttendanceListStmt.step()) {
    const row = lowAttendanceListStmt.getAsObject() as any;
    lowAttendanceList.push({
      student_code: row.student_code,
      batch_code: row.batch_code,
      center_code: row.center_code,
      program_name: row.program_name,
      assigned_trainers: row.assigned_trainers,
      running_attendance_pct: row.running_attendance ? Number((row.running_attendance * 100).toFixed(1)) : 0,
      beneficiary_attendance_pct: row.beneficiary_class_attendance ? Number((row.beneficiary_class_attendance * 100).toFixed(1)) : 0,
      ilt_completion_pct: row.ilt_completion ? Number((row.ilt_completion * 100).toFixed(1)) : 0,
      fm_completion_pct: row.fm_class_completion ? Number((row.fm_class_completion * 100).toFixed(1)) : 0,
      enrollment_status: row.enrollment_status,
    });
  }
  lowAttendanceListStmt.free();

  return {
    kpis: {
      avg_running_attendance: kpis.avg_running_attendance ? Number((kpis.avg_running_attendance * 100).toFixed(1)) : 0,
      avg_beneficiary_attendance: kpis.avg_beneficiary_attendance ? Number((kpis.avg_beneficiary_attendance * 100).toFixed(1)) : 0,
      avg_ilt_completion: kpis.avg_ilt_completion ? Number((kpis.avg_ilt_completion * 100).toFixed(1)) : 0,
      avg_fm_completion: kpis.avg_fm_completion ? Number((kpis.avg_fm_completion * 100).toFixed(1)) : 0,
      students_below_attendance_threshold: Number(kpis.students_below_attendance_threshold) || 0,
      students_below_completion_threshold: Number(kpis.students_below_completion_threshold) || 0,
      thresholds: {
        attendance: currentSettings.attendanceThreshold * 100,
        completion: currentSettings.completionThreshold * 100,
      }
    },
    center_attendance: centerAttendance,
    low_attendance_students: lowAttendanceList,
  };
}

// Placement Analytics
export async function getPlacementAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const { where, params } = buildFilterWhere(filters);

  const kpiStmt = db.prepare(`
    SELECT
      COUNT(*) as total_students,
      COUNT(CASE WHEN placement_type IS NOT NULL AND placement_type != '' THEN 1 END) as students_with_placement_info,
      COUNT(CASE WHEN placement_type = 'Placed By Anudip CRD' THEN 1 END) as placed_by_crd,
      COUNT(CASE WHEN placement_type = 'Self Placed' THEN 1 END) as self_placed,
      COUNT(CASE WHEN placement_type = 'Placed By Anudip Center/Local' THEN 1 END) as placed_by_local,
      COUNT(CASE WHEN placement_type = 'Placed By College/Campus' THEN 1 END) as placed_by_campus
    FROM raw_records
    WHERE ${where}
  `);
  kpiStmt.bind(params);
  let kpis: any = {};
  if (kpiStmt.step()) {
    kpis = kpiStmt.getAsObject();
  }
  kpiStmt.free();

  const totalPlaced = (Number(kpis.placed_by_crd) || 0) +
    (Number(kpis.self_placed) || 0) +
    (Number(kpis.placed_by_local) || 0) +
    (Number(kpis.placed_by_campus) || 0);

  // Breakdown by Placement Type
  const distStmt = db.prepare(`
    SELECT
      placement_type as name,
      COUNT(*) as value
    FROM raw_records
    WHERE ${where} AND placement_type IS NOT NULL AND placement_type != ''
    GROUP BY placement_type
    ORDER BY value DESC
  `);
  distStmt.bind(params);
  const distribution: any[] = [];
  while (distStmt.step()) {
    distribution.push(distStmt.getAsObject());
  }
  distStmt.free();

  // Breakdown by Program
  const progStmt = db.prepare(`
    SELECT
      program_name,
      COUNT(*) as total_students,
      COUNT(CASE WHEN placement_type IS NOT NULL AND placement_type != '' THEN 1 END) as placed_students
    FROM raw_records
    WHERE ${where}
    GROUP BY program_name
    ORDER BY placed_students DESC
  `);
  progStmt.bind(params);
  const byProgram: any[] = [];
  while (progStmt.step()) {
    byProgram.push(progStmt.getAsObject());
  }
  progStmt.free();

  return {
    kpis: {
      total_students: Number(kpis.total_students) || 0,
      students_with_placement_info: Number(kpis.students_with_placement_info) || 0,
      total_placed_students: totalPlaced,
      placed_by_crd: Number(kpis.placed_by_crd) || 0,
      self_placed: Number(kpis.self_placed) || 0,
      placed_by_local: Number(kpis.placed_by_local) || 0,
      placed_by_campus: Number(kpis.placed_by_campus) || 0,
    },
    distribution,
    by_program: byProgram,
  };
}

// Center Performance Overview (Center-Level Aggregation)
export async function getCenterAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const { where, params } = buildFilterWhere(filters);

  const stmt = db.prepare(`
    SELECT
      center_code,
      COUNT(DISTINCT batch_code) as total_batches,
      COUNT(DISTINCT CASE WHEN LOWER(batch_status) = 'running' THEN batch_code END) as active_batches,
      COUNT(DISTINCT CASE WHEN LOWER(batch_status) = 'complete' OR LOWER(batch_status) = 'completed' THEN batch_code END) as completed_batches,
      COUNT(*) as total_students,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropouts,
      AVG(running_attendance) as avg_attendance,
      AVG(ilt_completion) as avg_ilt_completion,
      AVG(fm_class_completion) as avg_fm_completion,
      COUNT(DISTINCT CASE WHEN incomplete_attendance_exception = 1 THEN student_code || '_' || batch_code END) as exceptions,
      COUNT(CASE WHEN validation_status = 'Validated' OR validation_status = 'ReValidated' THEN 1 END) as validated_students,
      COUNT(CASE WHEN placement_type IS NOT NULL AND placement_type != '' THEN 1 END) as placed_students
    FROM raw_records
    WHERE ${where}
    GROUP BY center_code
    ORDER BY total_students DESC
  `);
  stmt.bind(params);
  const centers: any[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    const st = Number(row.total_students) || 0;
    const dp = Number(row.dropouts) || 0;
    centers.push({
      center_code: row.center_code,
      total_batches: Number(row.total_batches) || 0,
      active_batches: Number(row.active_batches) || 0,
      completed_batches: Number(row.completed_batches) || 0,
      total_students: st,
      dropouts: dp,
      dropout_rate: st > 0 ? Number(((dp / st) * 100).toFixed(1)) : 0,
      avg_attendance: row.avg_attendance ? Number((row.avg_attendance * 100).toFixed(1)) : 0,
      avg_ilt_completion: row.avg_ilt_completion ? Number((row.avg_ilt_completion * 100).toFixed(1)) : 0,
      avg_fm_completion: row.avg_fm_completion ? Number((row.avg_fm_completion * 100).toFixed(1)) : 0,
      exceptions: Number(row.exceptions) || 0,
      validated_students: Number(row.validated_students) || 0,
      placed_students: Number(row.placed_students) || 0,
    });
  }
  stmt.free();
  return centers;
}

// AE Performance Overview (Descriptive Only)
export async function getAeAnalytics(filters: FilterParams = {}) {
  const db = await getDb();
  const { where, params } = buildFilterWhere(filters);

  const stmt = db.prepare(`
    SELECT
      assigned_ae as ae_name,
      COUNT(DISTINCT batch_code) as total_batches,
      COUNT(DISTINCT CASE WHEN LOWER(batch_status) = 'running' THEN batch_code END) as active_batches,
      COUNT(DISTINCT CASE WHEN LOWER(batch_status) = 'complete' OR LOWER(batch_status) = 'completed' THEN batch_code END) as completed_batches,
      COUNT(*) as total_students,
      COUNT(DISTINCT center_code) as total_centers,
      COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropouts,
      COUNT(DISTINCT CASE WHEN incomplete_attendance_exception = 1 THEN student_code || '_' || batch_code END) as exceptions,
      COUNT(CASE WHEN validation_status = 'Validated' OR validation_status = 'ReValidated' THEN 1 END) as validated_students,
      AVG(running_attendance) as avg_attendance,
      AVG(ilt_completion) as avg_ilt_completion,
      AVG(fm_class_completion) as avg_fm_completion
    FROM raw_records
    WHERE ${where} AND assigned_ae IS NOT NULL AND assigned_ae != ''
    GROUP BY assigned_ae
    ORDER BY total_batches DESC
  `);
  stmt.bind(params);
  const aes: any[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    const st = Number(row.total_students) || 0;
    const dp = Number(row.dropouts) || 0;
    aes.push({
      ae_name: row.ae_name,
      total_batches: Number(row.total_batches) || 0,
      active_batches: Number(row.active_batches) || 0,
      completed_batches: Number(row.completed_batches) || 0,
      total_students: st,
      total_centers: Number(row.total_centers) || 0,
      dropouts: dp,
      dropout_rate: st > 0 ? Number(((dp / st) * 100).toFixed(1)) : 0,
      exceptions: Number(row.exceptions) || 0,
      validated_students: Number(row.validated_students) || 0,
      avg_attendance: row.avg_attendance ? Number((row.avg_attendance * 100).toFixed(1)) : 0,
      avg_ilt_completion: row.avg_ilt_completion ? Number((row.avg_ilt_completion * 100).toFixed(1)) : 0,
      avg_fm_completion: row.avg_fm_completion ? Number((row.avg_fm_completion * 100).toFixed(1)) : 0,
    });
  }
  stmt.free();
  return aes;
}

// Data Explorer / Raw Records pagination & search
export async function getRawRecords(filters: FilterParams = {}, page = 1, pageSize = 50, search = '', sortColumn = 'id', sortDirection = 'DESC') {
  const db = await getDb();
  const { where, params } = buildFilterWhere(filters);

  let searchWhere = where;
  const searchParams = [...params];
  if (search && search.trim() !== '') {
    searchWhere += ` AND (
      student_code LIKE ? OR
      batch_code LIKE ? OR
      center_code LIKE ? OR
      assigned_trainers LIKE ? OR
      assigned_ae LIKE ? OR
      program_name LIKE ? OR
      funder_name LIKE ?
    )`;
    const q = `%${search.trim()}%`;
    searchParams.push(q, q, q, q, q, q, q);
  }

  // Count total matching
  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM raw_records WHERE ${searchWhere}`);
  countStmt.bind(searchParams);
  let total = 0;
  if (countStmt.step()) {
    total = Number(countStmt.getAsObject().total) || 0;
  }
  countStmt.free();

  // Validate sort column to avoid SQL injection
  const allowedSorts = [
    'id', 'center_code', 'funder_name', 'program_name', 'assigned_trainers', 'assigned_ae',
    'rm_sh_zh', 'batch_code', 'course_code', 'batch_start_date', 'batch_end_date', 'batch_status',
    'student_code', 'enrollment_status', 'dropout_type', 'final_exam_marks', 'placement_type',
    'ilt_completion', 'fm_class_completion', 'running_attendance', 'validation_status', 'special_case', 'joining_date', 'is_exception'
  ];
  const safeSort = allowedSorts.includes(sortColumn) ? sortColumn : 'id';
  const safeDir = sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const offset = (page - 1) * pageSize;
  const recordsStmt = db.prepare(`
    SELECT * FROM raw_records
    WHERE ${searchWhere}
    ORDER BY ${safeSort} ${safeDir}
    LIMIT ? OFFSET ?
  `);
  recordsStmt.bind([...searchParams, pageSize, offset]);

  const records: SourceRow[] = [];
  while (recordsStmt.step()) {
    records.push(recordsStmt.getAsObject() as unknown as SourceRow);
  }
  recordsStmt.free();

  return {
    records,
    pagination: {
      page,
      pageSize,
      totalRecords: total,
      totalPages: Math.ceil(total / pageSize) || 1,
    }
  };
}

// Data Quality Metrics
export async function getDataQualityMetrics() {
  const db = await getDb();

  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total_records,
      COUNT(DISTINCT student_code) as distinct_students,
      COUNT(DISTINCT batch_code) as distinct_batches,
      COUNT(CASE WHEN student_code IS NULL OR student_code = '' THEN 1 END) as missing_student_codes,
      COUNT(CASE WHEN batch_code IS NULL OR batch_code = '' THEN 1 END) as missing_batch_codes,
      COUNT(CASE WHEN center_code IS NULL OR center_code = '' THEN 1 END) as missing_center_codes,
      COUNT(CASE WHEN assigned_trainers IS NULL OR assigned_trainers = '' THEN 1 END) as missing_trainers,
      COUNT(CASE WHEN batch_start_date IS NULL OR batch_start_date = '' THEN 1 END) as missing_start_dates,
      COUNT(CASE WHEN validation_status IS NULL OR validation_status = '' OR validation_status = 'Not Available' THEN 1 END) as missing_validation_data,
      COUNT(CASE WHEN placement_type IS NULL OR placement_type = '' THEN 1 END) as missing_placement_data,
      COUNT(CASE WHEN enrollment_status IS NULL OR enrollment_status = '' THEN 1 END) as missing_enrollment_status,
      COUNT(CASE WHEN running_attendance IS NULL THEN 1 END) as missing_attendance
    FROM raw_records
  `);

  let metrics: any = {};
  if (stmt.step()) {
    metrics = stmt.getAsObject();
  }
  stmt.free();

  const total = Number(metrics.total_records) || 0;
  const missingCore = Number(metrics.missing_student_codes) + Number(metrics.missing_batch_codes) + Number(metrics.missing_center_codes);
  const validRecords = Math.max(0, total - missingCore);
  const dataQualityPct = total > 0 ? (validRecords / total) * 100 : 100;

  return {
    total_records: total,
    valid_records: validRecords,
    invalid_records: missingCore,
    duplicate_records: 0,
    missing_student_codes: Number(metrics.missing_student_codes) || 0,
    missing_batch_codes: Number(metrics.missing_batch_codes) || 0,
    missing_center_codes: Number(metrics.missing_center_codes) || 0,
    missing_trainer_mapping: Number(metrics.missing_trainers) || 0,
    missing_dates: Number(metrics.missing_start_dates) || 0,
    missing_validation_data: Number(metrics.missing_validation_data) || 0,
    missing_placement_data: Number(metrics.missing_placement_data) || 0,
    data_quality_pct: Number(dataQualityPct.toFixed(1)),
    field_scores: {
      student_code: total > 0 ? Number((((total - Number(metrics.missing_student_codes)) / total) * 100).toFixed(1)) : 100,
      batch_code: total > 0 ? Number((((total - Number(metrics.missing_batch_codes)) / total) * 100).toFixed(1)) : 100,
      center_code: total > 0 ? Number((((total - Number(metrics.missing_center_codes)) / total) * 100).toFixed(1)) : 100,
      trainer: total > 0 ? Number((((total - Number(metrics.missing_trainers)) / total) * 100).toFixed(1)) : 100,
      batch_start_date: total > 0 ? Number((((total - Number(metrics.missing_start_dates)) / total) * 100).toFixed(1)) : 100,
      enrollment_status: total > 0 ? Number((((total - Number(metrics.missing_enrollment_status)) / total) * 100).toFixed(1)) : 100,
      attendance: total > 0 ? Number((((total - Number(metrics.missing_attendance)) / total) * 100).toFixed(1)) : 100,
    }
  };
}

// Anudip Exception Formula Logic
// 1. Special Approval check from Exception Approval Report: if status = "Special Approval", exception count = 0
// 2. Get Trained Status first: Batch Status=complete, Enrollment Status='enrolled', Final Exam Marks >= 50
function normalizeIsoDateForException(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) return val.toISOString().split('T')[0];
    return null;
  }
  const str = String(val).trim();
  if (!str || str === '—' || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'n/a') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const isoPrefix = str.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (isoPrefix) return isoPrefix[1];
  const dmyMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+.*)?$/);
  if (dmyMatch) {
    let p1 = parseInt(dmyMatch[1], 10);
    let p2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    let day = p1;
    let month = p2;
    if (p2 > 12 && p1 <= 12) {
      month = p1;
      day = p2;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    if (y >= 1900 && y <= 2100) return parsed.toISOString().split('T')[0];
  }
  return null;
}

export function evaluateStudentExceptionLogic(row: {
  enrollment_status?: string | null;
  batch_status?: string | null;
  program_name?: string | null;
  placement_type?: string | null;
  ilt_completion?: number | null;
  ilt_as_on_joining_date?: number | null;
  ILT_as_on_Joining_Date?: number | null;
  fm_class_completion?: number | null;
  beneficiary_class_attendance?: number | null;
  running_attendance?: number | null;
  dropout_type?: string | null;
  final_exam_marks?: number | null;
  special_case?: string | number | null;
  joining_date?: string | null;
  batch_actual_end_date?: string | null;
  validation_status?: string | null;
  status?: string | null;
  approval_status?: string | null;
}): { isException: number; isTrained: number; reason: string } {
  const enrollmentStatus = String(row.enrollment_status || '').trim().toLowerCase();
  const batchStatus = String(row.batch_status || '').trim().toLowerCase();
  const isBatchComplete = batchStatus === 'complete' || batchStatus === 'completed';
  const placementRaw = String(row.placement_type || '').trim();
  const placementType = placementRaw.toLowerCase();
  const hasPlacementType = placementType !== '' && placementType !== '—' && placementType !== '-' && placementType !== 'null' && placementType !== 'na' && placementType !== 'n/a';
  const finalExamMarks = row.final_exam_marks !== null && row.final_exam_marks !== undefined && String(row.final_exam_marks).trim() !== '' ? Number(row.final_exam_marks) : null;
  const validationStatus = String(row.validation_status ?? row.status ?? row.approval_status ?? '').trim().toLowerCase();

  // 1. Trained Count Check: Batch Status = Complete or Running, Enrollment Status = 'Enrolled', Final Exam Marks >= 50
  const isBatchCompleteOrRunning = isBatchComplete || batchStatus === 'running';
  const isTrained = (
    isBatchCompleteOrRunning &&
    enrollmentStatus === 'enrolled' &&
    finalExamMarks !== null &&
    !isNaN(finalExamMarks) &&
    finalExamMarks >= 50
  ) ? 1 : 0;

  // Special Approval check: If status = "Special Approval" or "Approved Exception", exception count becomes zero
  if (
    validationStatus.includes('special approval') ||
    validationStatus.includes('special approved') ||
    validationStatus === 'approved exception'
  ) {
    return { isException: 0, isTrained, reason: 'Exempt: Special Approval granted in Exception Approval Report (Exception Count = 0)' };
  }

  // Excel Formula Gate: =If(Trained Count<>1, 0, ...)
  if (isTrained !== 1) {
    return { isException: 0, isTrained: 0, reason: 'Trained Count <> 1 (Exception Count = 0)' };
  }

  // Student Status: Enrolled Status="Enrolled" and Placement Type=" " -> "Running", else Placed categories
  const studentStatus = !hasPlacementType ? 'Running' : 'Placed';

  // Metrics Normalization (0.0 to 1.0+): ILT completion%, ILT_as_on_Joining_Date, and Beneficiary Class Attendance %
  const rawIlt = row.ilt_completion !== null && row.ilt_completion !== undefined && String(row.ilt_completion).trim() !== ''
    ? Number(row.ilt_completion)
    : Number(row.fm_class_completion ?? 0);
  const iltPct = rawIlt > 2.0 ? rawIlt / 100 : Math.max(0, rawIlt);

  const rawAtt = row.beneficiary_class_attendance !== null && row.beneficiary_class_attendance !== undefined && String(row.beneficiary_class_attendance).trim() !== ''
    ? Number(row.beneficiary_class_attendance)
    : Number(row.running_attendance ?? 0);
  const attendancePct = rawAtt > 2.0 ? rawAtt / 100 : Math.max(0, rawAtt);

  const rawRunningAtt = row.running_attendance !== null && row.running_attendance !== undefined && String(row.running_attendance).trim() !== ''
    ? Number(row.running_attendance)
    : 0;
  const runningAttPct = rawRunningAtt > 2.0 ? rawRunningAtt / 100 : Math.max(0, rawRunningAtt);

  const joiningIltCandidate = row.ilt_as_on_joining_date ?? row.ILT_as_on_Joining_Date;
  let iltJoiningPct: number;
  if (joiningIltCandidate !== null && joiningIltCandidate !== undefined && String(joiningIltCandidate).trim() !== '') {
    const rawIltJoining = Number(joiningIltCandidate);
    iltJoiningPct = rawIltJoining > 2.0 ? rawIltJoining / 100 : Math.max(0, rawIltJoining);
  } else if (runningAttPct > 0 && attendancePct > 0) {
    // Derive ILT_as_on_Joining_Date from Beneficiary Class Attendance % / Running Attendance % when column is not populated
    iltJoiningPct = attendancePct / runningAttPct;
  } else {
    iltJoiningPct = iltPct;
  }

  const EPS = 1e-9;
  const minRequiredAttendanceIlt = Math.min(iltPct * 0.5, 0.50);
  const minRequiredAttendanceJoining = Math.min(iltJoiningPct * 0.5, 0.50);

  const joiningDateIso = normalizeIsoDateForException(row.joining_date);
  const actualEndDateIso = normalizeIsoDateForException(row.batch_actual_end_date);
  const isJoiningAfterActualEnd = Boolean(joiningDateIso && actualEndDateIso && joiningDateIso > actualEndDateIso);

  // Branch 1: If(And(Student Status="Placed", Batch Status="Complete", Joining Date > Batch Actual End Date),
  //              If(And(ILT completion%>=90%, Beneficiary Class Attendance %>=Min(ILT completion%*50%,50%)), 0, 1), ...)
  if (studentStatus === 'Placed' && isBatchComplete && isJoiningAfterActualEnd) {
    if (iltPct + EPS >= 0.90 && attendancePct + EPS >= minRequiredAttendanceIlt) {
      return {
        isException: 0,
        isTrained: 1,
        reason: 'Compliant: Placed with Joining Date > Batch Actual End Date meets ILT completion% >= 90% and Attendance >= Min(ILT completion%*50%, 50%)'
      };
    }
    return {
      isException: 1,
      isTrained: 1,
      reason: 'Exception: Placed with Joining Date > Batch Actual End Date (Requires ILT completion% >= 90% & Attendance >= Min(ILT completion%*50%, 50%))'
    };
  }

  // Branch 2 (Else):
  // If(Or(
  //   And(Student Status="Running", ILT completion%>=90%, Beneficiary Class Attendance %>=Min(ILT completion%*50%,50%)),
  //   And(Placement Type="Placed By Anudip Crd", ILT_as_on_Joining_Date>=70%, Beneficiary Class Attendance %>=Min(ILT_as_on_Joining_Date*50%,50%)),
  //   And(Placement Type="Placed By Anudip Center/Local", ILT_as_on_Joining_Date>=70%, Beneficiary Class Attendance %>=Min(ILT_as_on_Joining_Date*50%,50%)),
  //   And(Placement Type="Self Placed", ILT_as_on_Joining_Date>=50%, Beneficiary Class Attendance %>=Min(ILT_as_on_Joining_Date*50%,50%)),
  //   And(Placement Type="Placed By College/Campus", ILT_as_on_Joining_Date>=50%, Beneficiary Class Attendance %>=Min(ILT_as_on_Joining_Date*50%,50%))
  // ), 0, 1)
  const isCrd = placementType === 'placed by anudip crd' || placementType.includes('crd');
  const isCenterLocal = placementType === 'placed by anudip center/local' || placementType.includes('center') || placementType.includes('local');
  const isSelfPlaced = placementType === 'self placed' || placementType.includes('self');
  const isCollegeCampus = placementType === 'placed by college/campus' || placementType.includes('college') || placementType.includes('campus');

  const condRunning = studentStatus === 'Running' && iltPct + EPS >= 0.90 && attendancePct + EPS >= minRequiredAttendanceIlt;
  const condCrd = isCrd && iltJoiningPct + EPS >= 0.70 && attendancePct + EPS >= minRequiredAttendanceJoining;
  const condCenterLocal = isCenterLocal && iltJoiningPct + EPS >= 0.70 && attendancePct + EPS >= minRequiredAttendanceJoining;
  const condSelfPlaced = isSelfPlaced && iltJoiningPct + EPS >= 0.50 && attendancePct + EPS >= minRequiredAttendanceJoining;
  const condCollegeCampus = isCollegeCampus && iltJoiningPct + EPS >= 0.50 && attendancePct + EPS >= minRequiredAttendanceJoining;

  if (condRunning || condCrd || condCenterLocal || condSelfPlaced || condCollegeCampus) {
    return {
      isException: 0,
      isTrained: 1,
      reason: studentStatus === 'Running'
        ? 'Compliant: Running student meets ILT completion% >= 90% and Attendance >= Min(ILT completion%*50%, 50%)'
        : `Compliant: ${placementRaw} meets required ILT_as_on_Joining_Date and Attendance >= Min(ILT_as_on_Joining_Date*50%, 50%)`
    };
  }

  if (studentStatus === 'Running') {
    return {
      isException: 1,
      isTrained: 1,
      reason: 'Exception: Running student fails ILT completion% >= 90% or Attendance >= Min(ILT completion%*50%, 50%)'
    };
  }

  if (isCrd || isCenterLocal) {
    return {
      isException: 1,
      isTrained: 1,
      reason: `Exception: ${placementRaw} fails ILT_as_on_Joining_Date >= 70% or Attendance >= Min(ILT_as_on_Joining_Date*50%, 50%)`
    };
  }

  return {
    isException: 1,
    isTrained: 1,
    reason: `Exception: ${placementRaw || 'Placed'} fails ILT_as_on_Joining_Date >= 50% or Attendance >= Min(ILT_as_on_Joining_Date*50%, 50%)`
  };
}

// Initial Seed Generator (Master Operational Workbook baseline: exactly 17,726 Diya student records + Deeptech)
async function seedInitialData(db: Database) {
  const centers = [
    'WBCOE', 'KOL-01', 'KOL-02', 'DEL-01', 'DEL-02', 'MUM-01', 'HYD-01',
    'BLR-01', 'PAT-01', 'BBSR-01', 'RCH-01', 'GHY-01', 'PUN-01', 'CHN-01'
  ];

  const funders = [
    'DBS Bank', 'Wells Fargo', 'S&Y Collage Model', 'S&Y',
    'Accenture', 'Cisco Systems', 'Capgemini'
  ];

  const diyaPrograms = [
    { name: 'Diya - CCSS with AI', course: 'CRS-AI-01' },
    { name: 'Diya - ITeS Customer Experience', course: 'CRS-ITES-02' },
    { name: 'Diya - Web Development', course: 'CRS-FSW-04' },
    { name: 'AWS Cloud Computing', course: 'CRS-AWS-05' },
    { name: 'SAVE', course: 'CRS-SAVE-06' }
  ];

  const deepTechProgram = { name: 'Deep Tech', course: 'CRS-DT-03' };

  const trainers = [
    'Subhashis Roy', 'Priyanka Sen', 'Amitabh Sharma', 'Sneha Mukherjee',
    'Rahul Verma', 'Kavita Nair', 'Debashis Das', 'Manoj Patel', 'Ritu Ganguly', 'Santosh Rao'
  ];

  const aes = [
    'Arnab Roy', 'Sweta Banerjee', 'Tanmoy Ghosh', 'Pritha Chatterjee', 'Vikram Sengupta'
  ];

  const rmShZhs = [
    'Vivek Kumar', 'Krishna Sadhan Adhikari', 'Pradip Kumar Biswas', 'Khalid Khan', 'Shadan Ahmad',
    'Arnab Roy', 'Rajesh Sen', 'Suman Ghosh', 'Manoj Sharma', 'Pritha Chatterjee',
    'Sandeep Verma', 'Anjali Das', 'Sweta Banerjee', 'Abhijit Mukherjee', 'Subir Dey',
    'Priyanka Roy', 'Joydeep Kar', 'Subodh Chandra', 'Rupesh Patel', 'Tapas Kundu'
  ];

  const validationDoneByList = ['Pooja Sharma (Validator)', 'Anil Roy (AE QA)', 'Sunita Paul (Validator)', 'Arnab Roy'];

  const uploadId = 'UPL-INITIAL-MASTER';
  const uploadDate = '2026-09-28T10:30:00.000Z';

  const totalDiyaTarget = 17726;
  const totalDeepTechTarget = 1540;
  const totalMasterRows = totalDiyaTarget + totalDeepTechTarget;

  db.run(`
    INSERT INTO uploads (id, file_name, sheet_name, uploaded_by, uploaded_at, row_count, valid_row_count, invalid_row_count, duplicate_count, processing_status, processing_duration_ms, source_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    uploadId,
    'data (1).xlsx',
    'Export',
    'arnab.roy@anudip.org',
    uploadDate,
    totalMasterRows,
    totalMasterRows,
    0,
    0,
    'completed',
    1420,
    'hash-init-8921a7df82'
  ]);

  const insertStmt = db.prepare(`
    INSERT INTO raw_records (
      center_code, funder_name, program_name, assigned_trainers, assigned_ae, rm_sh_zh,
      batch_code, course_code, batch_start_date, batch_initial_start_date, batch_initial_end_date,
      batch_end_date, batch_actual_end_date, batch_status, batch_validation_status,
      student_code, enrollment_status, dropout_type, email_verification_status,
      final_exam_marks, placement_type, exam_schedule_date, ilt_completion,
      fm_class_completion, running_attendance, beneficiary_class_attendance,
      incomplete_attendance_exception, incomplete_module_exception, validation_status,
      validation_done_by, upload_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.run('BEGIN TRANSACTION');
  try {
    // 1. Generate Exactly 17,726 Diya Operational Records
    const diyaBatchCount = 590;
    for (let s = 1; s <= totalDiyaTarget; s++) {
      const b = (s % diyaBatchCount) + 1;
      const center = centers[b % centers.length];
      const funder = funders[b % funders.length];
      const prog = diyaPrograms[b % diyaPrograms.length];
      const trainer = trainers[b % trainers.length];
      const ae = aes[b % aes.length];
      const rm = rmShZhs[b % rmShZhs.length];
      const batchCode = `BCH-${center}-${100 + b}`;
      const studentCode = `STU-${10000 + s}`;

      // Batch timeline: some running, completed, hold
      const isCompleted = b <= 350;
      const isRunning = b > 350 && b <= 545;

      const batchStatus = isRunning ? 'running' : (isCompleted ? 'complete' : 'hold');
      const batchValStatus = isCompleted ? (b % 4 === 0 ? 'Partially Validated' : 'Fully Validated') : (b % 2 === 0 ? 'Not Yet Validated' : 'Partially Validated');

      // Dates
      const startYear = 2026;
      const startMonth = String(1 + (b % 8)).padStart(2, '0');
      const startDate = `${startYear}-${startMonth}-10`;
      const initialStartDate = `${startYear}-${startMonth}-05`;

      const endMonth = String(Math.min(12, Number(startMonth) + 3)).padStart(2, '0');
      const endDate = `${startYear}-${endMonth}-15`;
      const initialEndDate = `${startYear}-${endMonth}-10`;

      let actualEndDate: string | null = null;
      if (isCompleted) {
        if (b % 3 === 0) {
          const delayDays = (b % 5) * 4 + 6;
          const delayedDate = new Date(new Date(endDate).getTime() + delayDays * 86400000);
          actualEndDate = delayedDate.toISOString().split('T')[0];
        } else {
          actualEndDate = endDate;
        }
      }

      // Dropout simulation (around 12-18% overall)
      const isDropout = (s + b) % 7 === 0;
      const enrollmentStatus = isDropout ? 'dropped out' : (isCompleted ? 'completed' : 'enrolled');

      let dropoutType: string | null = null;
      if (isDropout) {
        if (s % 3 === 0) dropoutType = 'Initial Session Dropout';
        else if (s % 3 === 1) dropoutType = 'Regular Session Dropout';
        else dropoutType = 'M&E Dropout';
      }

      // Email verification
      const emailStatus = s % 10 === 0 ? 'p' : (s % 15 === 0 ? 'n' : 'y');

      // Exam & Placement
      let finalExamMarks: number | null = null;
      let placementType: string | null = null;
      let examScheduleDate: string | null = null;

      if (!isDropout && isCompleted) {
        finalExamMarks = 55 + (s * 7 + b * 3) % 43; // 55 to 98
        examScheduleDate = `${startYear}-${endMonth}-12`;

        const placementSeed = (s + b) % 5;
        if (placementSeed === 0) placementType = 'Placed By Anudip CRD';
        else if (placementSeed === 1) placementType = 'Self Placed';
        else if (placementSeed === 2) placementType = 'Placed By Anudip Center/Local';
        else if (placementSeed === 3) placementType = 'Placed By College/Campus';
        else placementType = null;
      }

      // Progress decimals
      const iltCompletion = isDropout ? 0.25 : Math.min(1.0, 0.65 + ((s * 3 + b) % 35) / 100);
      const fmCompletion = isDropout ? 0.20 : Math.min(1.0, 0.70 + ((s * 2 + b) % 30) / 100);
      const runningAttendance = isDropout ? 0.35 : Math.min(1.0, 0.72 + ((s * 4 + b) % 28) / 100);
      const beneficiaryAttendance = isDropout ? 0.30 : Math.min(1.0, 0.70 + ((s * 3 + b) % 30) / 100);

      const attendanceException = (s % 2 === 0) ? (runningAttendance < 0.75 ? 1 : 0) : 0;

      // We simulate that Exception Approval Reports were uploaded for some students
      const hasExceptionApprovalUpload = (s % 7 === 0);
      let moduleException = 0;
      let validationStatus = 'Validated';

      if (hasExceptionApprovalUpload) {
        const approvalSeed = s % 3;
        if (approvalSeed === 0) {
          validationStatus = 'Special Approval';
        } else if (approvalSeed === 1) {
          validationStatus = 'Approved Exception';
        } else {
          moduleException = 0;
          validationStatus = 'Exception Rejected';
        }
      }

      if (isDropout) {
        validationStatus = (s % 2 === 0) ? 'Absent' : 'Rejected';
      } else if (isRunning && s % 5 === 0) {
        validationStatus = 'Pending';
      } else if (s % 17 === 0) {
        validationStatus = 'ReValidated';
      }

      const validationDoneBy = validationDoneByList[(s + b) % validationDoneByList.length];

      insertStmt.run([
        center, funder, prog.name, trainer, ae, rm,
        batchCode, prog.course, startDate, initialStartDate, initialEndDate,
        endDate, actualEndDate, batchStatus, batchValStatus,
        studentCode, enrollmentStatus, dropoutType, emailStatus,
        finalExamMarks, placementType, examScheduleDate,
        iltCompletion, fmCompletion, runningAttendance, beneficiaryAttendance,
        attendanceException, moduleException, validationStatus,
        validationDoneBy, uploadId
      ]);
    }

    // 2. Generate 1,540 DeepTech Records (50 Batches)
    const dtBatchCount = 50;
    const dtFunders = ['DBS Bank', 'Wells Fargo', 'S&Y Collage Model'];
    const dtRms = ['Vivek Kumar', 'Krishna Sadhan Adhikari', 'Pradip Kumar Biswas'];

    for (let d = 1; d <= totalDeepTechTarget; d++) {
      const b = (d % dtBatchCount) + 1;
      const center = centers[b % centers.length];
      const funder = dtFunders[b % dtFunders.length];
      const prog = deepTechProgram;
      const trainer = trainers[b % trainers.length];
      const ae = aes[b % aes.length];
      const rm = dtRms[b % dtRms.length];
      const batchCode = `BCH-DT-${center}-${700 + b}`;
      const studentCode = `STU-DT-${1000 + d}`;

      const isCompleted = b <= 30;
      const isRunning = b > 30 && b <= 45;

      const batchStatus = isRunning ? 'running' : (isCompleted ? 'complete' : 'hold');
      const batchValStatus = isCompleted ? 'Fully Validated' : 'Partially Validated';

      const startYear = 2026;
      const startMonth = String(1 + (b % 8)).padStart(2, '0');
      const startDate = `${startYear}-${startMonth}-10`;
      const initialStartDate = `${startYear}-${startMonth}-05`;

      const endMonth = String(Math.min(12, Number(startMonth) + 3)).padStart(2, '0');
      const endDate = `${startYear}-${endMonth}-15`;
      const initialEndDate = `${startYear}-${endMonth}-10`;

      const isDropout = (d + b) % 9 === 0;
      const enrollmentStatus = isDropout ? 'dropped out' : (isCompleted ? 'completed' : 'enrolled');

      let dropoutType: string | null = null;
      if (isDropout) {
        dropoutType = d % 2 === 0 ? 'Initial Session Dropout' : 'Regular Session Dropout';
      }

      const emailStatus = 'y';
      let finalExamMarks: number | null = null;
      let placementType: string | null = null;
      let examScheduleDate: string | null = null;

      if (!isDropout && isCompleted) {
        finalExamMarks = 68 + (d * 5 + b * 2) % 30;
        examScheduleDate = `${startYear}-${endMonth}-12`;
        placementType = d % 2 === 0 ? 'Placed By Anudip CRD' : 'Placed By Anudip Center/Local';
      }

      const iltCompletion = isDropout ? 0.30 : Math.min(1.0, 0.75 + ((d * 2 + b) % 25) / 100);
      const fmCompletion = isDropout ? 0.25 : Math.min(1.0, 0.80 + ((d + b) % 20) / 100);
      const runningAttendance = isDropout ? 0.40 : Math.min(1.0, 0.78 + ((d * 3 + b) % 22) / 100);
      const beneficiaryAttendance = isDropout ? 0.35 : Math.min(1.0, 0.75 + ((d * 2 + b) % 25) / 100);

      const attendanceException = (d % 2 === 0) ? (runningAttendance < 0.75 ? 1 : 0) : 0;

      const hasExceptionApprovalUpload = (d % 7 === 0);
      let moduleException = 0;
      let validationStatus = 'Validated';

      if (hasExceptionApprovalUpload) {
        const approvalSeed = d % 3;
        if (approvalSeed === 0) {
          validationStatus = 'Special Approval';
        } else if (approvalSeed === 1) {
          validationStatus = 'Approved Exception';
        } else {
          moduleException = 0;
          validationStatus = 'Exception Rejected';
        }
      }

      if (isDropout) {
        validationStatus = 'Rejected';
      }
      const validationDoneBy = validationDoneByList[(d + b) % validationDoneByList.length];

      insertStmt.run([
        center, funder, prog.name, trainer, ae, rm,
        batchCode, prog.course, startDate, initialStartDate, initialEndDate,
        endDate, endDate, batchStatus, batchValStatus,
        studentCode, enrollmentStatus, dropoutType, emailStatus,
        finalExamMarks, placementType, examScheduleDate,
        iltCompletion, fmCompletion, runningAttendance, beneficiaryAttendance,
        attendanceException, moduleException, validationStatus,
        validationDoneBy, uploadId
      ]);
    }

    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  } finally {
    insertStmt.free();
  }

  logAudit('system', 'System', 'Initial Database Seed', `Seeded Master Operational Workbook dataset: ${totalDiyaTarget} Diya records + ${totalDeepTechTarget} DeepTech records (${totalMasterRows} total)`, 'success', uploadId);
}

// Helper to safely parse attendance values (strings with %, decimals, numbers, integers)
export function parseAttendancePercentage(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    return val > 1 && val <= 100 ? val / 100 : Math.max(0, Math.min(1.0, val));
  }
  const cleanStr = String(val).replace(/%/g, '').replace(/,/g, '.').trim();
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return null;
  return num > 1 && num <= 100 ? num / 100 : Math.max(0, Math.min(1.0, num));
}

// Process Exception Approval Report Import
export async function processExceptionApprovalReportImport(rows: any[], uploadedBy = 'arnab.roy@anudip.org') {
  const db = await getDb();
  let approvedCount = 0;
  let specialApprovalCount = 0;
  let rejectedCount = 0;
  let recordsUpdated = 0;

  // Build high-speed cache of raw_records student IDs
  const mapStmt = db.prepare(`SELECT id, LOWER(TRIM(COALESCE(student_code, ''))) as sc, LOWER(TRIM(COALESCE(batch_code, ''))) as bc FROM raw_records`);
  const studentMap = new Map<string, number[]>();
  const studentBatchMap = new Map<string, number[]>();
  while (mapStmt.step()) {
    const r = mapStmt.getAsObject() as any;
    if (r.sc) {
      if (!studentMap.has(r.sc)) studentMap.set(r.sc, []);
      studentMap.get(r.sc)!.push(r.id);
      if (r.bc) {
        const key = `${r.sc}___${r.bc}`;
        if (!studentBatchMap.has(key)) studentBatchMap.set(key, []);
        studentBatchMap.get(key)!.push(r.id);
      }
    }
  }
  mapStmt.free();

  // Load existing Exception_App_Rpt map to update details in place without touching other existing reports
  const existingReportMap = new Map<string, number>();
  const existingReportStmt = db.prepare(`SELECT id, LOWER(TRIM(COALESCE(student_code, ''))) as sc, LOWER(TRIM(COALESCE(batch_code, ''))) as bc FROM Exception_App_Rpt`);
  while (existingReportStmt.step()) {
    const r = existingReportStmt.getAsObject() as any;
    if (r.sc && r.bc) {
      existingReportMap.set(`${r.sc}___${r.bc}`, r.id);
    } else if (r.sc) {
      existingReportMap.set(r.sc, r.id);
    }
  }
  existingReportStmt.free();

  const updateSpecialApproval = db.prepare(`UPDATE raw_records SET incomplete_attendance_exception = 0, incomplete_module_exception = 0, validation_status = 'Special Approval' WHERE id = ?`);

  const updateReportStmt = db.prepare(`
    UPDATE Exception_App_Rpt SET
      date = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE date END,
      student_name = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE student_name END,
      center_code = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE center_code END,
      center_name = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE center_name END,
      reason = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE reason END,
      remarks = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE remarks END,
      status = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE status END,
      created_by = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE created_by END,
      created_by_email = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE created_by_email END,
      cm_name = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE cm_name END,
      cm_email = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE cm_email END,
      approval_remarks = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE approval_remarks END,
      approved_by = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE approved_by END,
      approved_by_email = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE approved_by_email END,
      approved_date = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE approved_date END,
      exception_remove_status = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE exception_remove_status END,
      exception_remove_date = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE exception_remove_date END
    WHERE id = ?
  `);

  const insertReportStmt = db.prepare(`
    INSERT INTO Exception_App_Rpt (
      date, batch_code, student_code, student_name, center_code, center_name,
      reason, remarks, status, created_by, created_by_email, cm_name, cm_email,
      approval_remarks, approved_by, approved_by_email, approved_date,
      exception_remove_status, exception_remove_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const parsedItems: any[] = [];

  function getField(row: any, ...keys: string[]): string | null {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
    }
    for (const k of keys) {
      const kClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const rowKey of Object.keys(row)) {
        const rowKeyClean = rowKey.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (rowKeyClean === kClean && row[rowKey] !== undefined && row[rowKey] !== null && String(row[rowKey]).trim() !== '') {
          return String(row[rowKey]).trim();
        }
      }
    }
    return null;
  }

  db.run('BEGIN TRANSACTION');
  try {
    for (const row of rows) {
      const studentCode = getField(row, 'student_code', 'studentCode', 'Student Code', 'student_id', 'Student ID', 'Candidate ID', 'reg_id') || '';
      const batchCode = getField(row, 'batch_code', 'batchCode', 'Batch Code', 'batch_id', 'Batch ID', 'batch') || '';
      if (!studentCode && !batchCode) continue;

      const date = getField(row, 'date', 'Date', 'report_date', 'approval_date') || null;
      const studentName = getField(row, 'student_name', 'studentName', 'Student Name', 'Candidate Name', 'name') || null;
      const centerCode = getField(row, 'center_code', 'centerCode', 'Center Code', 'center') || null;
      const centerName = getField(row, 'center_name', 'centerName', 'Center Name') || null;
      const reason = getField(row, 'reason', 'Reason', 'exception_reason', 'Exception Reason') || null;
      const remarks = getField(row, 'remarks', 'Remarks', 'comment', 'comments', 'Notes', 'Remarks / Reason') || null;
      const status = getField(row, 'status', 'Status', 'approval_status', 'Approval Status', 'decision', 'Decision') || 'Approved';
      const createdBy = getField(row, 'created_by', 'createdBy', 'Created By') || null;
      const createdByEmail = getField(row, 'created_by_email', 'createdByEmail', 'Created By Email') || null;
      const cmName = getField(row, 'cm_name', 'cmName', 'CM Name', 'Center Manager') || null;
      const cmEmail = getField(row, 'cm_email', 'cmEmail', 'CM Email') || null;
      const approvalRemarks = getField(row, 'approval_remarks', 'approvalRemarks', 'Approval Remarks') || null;
      const approvedBy = getField(row, 'approved_by', 'approvedBy', 'Approved By', 'Approver') || null;
      const approvedByEmail = getField(row, 'approved_by_email', 'approvedByEmail', 'Approved By Email') || null;
      const approvedDate = getField(row, 'approved_date', 'approvedDate', 'Approved Date') || null;
      const exceptionRemoveStatus = getField(row, 'exception_remove_status', 'exceptionRemoveStatus', 'Exception Remove Status') || null;
      const exceptionRemoveDate = getField(row, 'exception_remove_date', 'exceptionRemoveDate', 'Exception Remove Date') || null;

      const statusLower = status.toLowerCase();
      const combinedText = [status, remarks, approvalRemarks, reason, exceptionRemoveStatus].filter(Boolean).join(' ').toLowerCase();
      const isSpecialApproval =
        statusLower === 'special approval' ||
        statusLower === 'special approved' ||
        statusLower === 'special' ||
        combinedText.includes('special approval') ||
        combinedText.includes('special approved') ||
        combinedText.includes('special_approval') ||
        (statusLower.includes('approved') && combinedText.includes('special'));
      const isApproved = !isSpecialApproval && (statusLower === 'approved' || statusLower === 'cleared' || statusLower === 'resolved' || statusLower.includes('approved'));
      const isRejected = !isSpecialApproval && !isApproved;

      const scNorm = studentCode.toLowerCase();
      const bcNorm = batchCode.toLowerCase();

      let matchingIds: number[] | undefined;
      if (scNorm && bcNorm) matchingIds = studentBatchMap.get(`${scNorm}___${bcNorm}`);
      if ((!matchingIds || matchingIds.length === 0) && scNorm) matchingIds = studentMap.get(scNorm);

      // Strict raw_records check: Only process students that actually exist in raw_records
      if (!matchingIds || matchingIds.length === 0) {
        continue;
      }

      if (isSpecialApproval) specialApprovalCount++;
      else if (isApproved) approvedCount++;
      else rejectedCount++;

      const keyWithBatch = `${scNorm}___${bcNorm}`;
      const existingId = (bcNorm && existingReportMap.get(keyWithBatch)) || (scNorm && existingReportMap.get(scNorm));

      if (existingId) {
        // Update details in existing record in Exception_App_Rpt (leaving other existing reports untouched)
        updateReportStmt.run([
          date, date, date,
          studentName, studentName, studentName,
          centerCode, centerCode, centerCode,
          centerName, centerName, centerName,
          reason, reason, reason,
          remarks, remarks, remarks,
          status, status, status,
          createdBy, createdBy, createdBy,
          createdByEmail, createdByEmail, createdByEmail,
          cmName, cmName, cmName,
          cmEmail, cmEmail, cmEmail,
          approvalRemarks, approvalRemarks, approvalRemarks,
          approvedBy, approvedBy, approvedBy,
          approvedByEmail, approvedByEmail, approvedByEmail,
          approvedDate, approvedDate, approvedDate,
          exceptionRemoveStatus, exceptionRemoveStatus, exceptionRemoveStatus,
          exceptionRemoveDate, exceptionRemoveDate, exceptionRemoveDate,
          existingId
        ]);
      } else {
        // Insert new entry into Exception_App_Rpt
        insertReportStmt.run([
          date, batchCode || null, studentCode || null, studentName, centerCode, centerName,
          reason, remarks, status, createdBy, createdByEmail, cmName, cmEmail,
          approvalRemarks, approvedBy, approvedByEmail, approvedDate,
          exceptionRemoveStatus, exceptionRemoveDate
        ]);
      }

      parsedItems.push({
        date, batch_code: batchCode, student_code: studentCode, student_name: studentName,
        center_code: centerCode, center_name: centerName, reason, remarks, status,
        created_by: createdBy, created_by_email: createdByEmail, cm_name: cmName, cm_email: cmEmail,
        approval_remarks: approvalRemarks, approved_by: approvedBy, approved_by_email: approvedByEmail,
        approved_date: approvedDate, exception_remove_status: exceptionRemoveStatus,
        exception_remove_date: exceptionRemoveDate, isSpecialApproval, isApproved, isRejected
      });

      if (isSpecialApproval) {
        for (const id of matchingIds) {
          updateSpecialApproval.run([id]);
          recordsUpdated++;
        }
      }
    }

    insertReportStmt.free();
    updateReportStmt.free();
    updateSpecialApproval.free();

    db.run('COMMIT');
    saveDbToDisk();

    // Mirror updates to MySQL Exception_App_Rpt and raw_records
    if (getActiveEngine() === 'mysql' || process.env.MYSQL_HOST) {
      try {
        const pool = await getMysqlPool();
        if (pool) {
          const conn = await pool.getConnection();
          try {
            await conn.query('SET SESSION innodb_lock_wait_timeout = 120');
            await conn.beginTransaction();
            for (const item of parsedItems) {
              if (!item.student_code && !item.batch_code) continue;
              const [existingRows]: any = await conn.query(
                'SELECT id FROM Exception_App_Rpt WHERE LOWER(TRIM(student_code)) = LOWER(TRIM(?)) AND (batch_code IS NULL OR batch_code = "" OR LOWER(TRIM(batch_code)) = LOWER(TRIM(?))) LIMIT 1',
                [item.student_code, item.batch_code || '']
              );

              if (existingRows.length > 0) {
                await conn.query(
                  `UPDATE Exception_App_Rpt SET
                    date = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE date END,
                    student_name = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE student_name END,
                    center_code = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE center_code END,
                    center_name = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE center_name END,
                    reason = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE reason END,
                    remarks = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE remarks END,
                    status = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE status END,
                    created_by = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE created_by END,
                    created_by_email = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE created_by_email END,
                    cm_name = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE cm_name END,
                    cm_email = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE cm_email END,
                    approval_remarks = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE approval_remarks END,
                    approved_by = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE approved_by END,
                    approved_by_email = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE approved_by_email END,
                    approved_date = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE approved_date END,
                    exception_remove_status = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE exception_remove_status END,
                    exception_remove_date = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE exception_remove_date END
                  WHERE id = ?`,
                  [
                    item.date, item.date, item.date,
                    item.student_name, item.student_name, item.student_name,
                    item.center_code, item.center_code, item.center_code,
                    item.center_name, item.center_name, item.center_name,
                    item.reason, item.reason, item.reason,
                    item.remarks, item.remarks, item.remarks,
                    item.status, item.status, item.status,
                    item.created_by, item.created_by, item.created_by,
                    item.created_by_email, item.created_by_email, item.created_by_email,
                    item.cm_name, item.cm_name, item.cm_name,
                    item.cm_email, item.cm_email, item.cm_email,
                    item.approval_remarks, item.approval_remarks, item.approval_remarks,
                    item.approved_by, item.approved_by, item.approved_by,
                    item.approved_by_email, item.approved_by_email, item.approved_by_email,
                    item.approved_date, item.approved_date, item.approved_date,
                    item.exception_remove_status, item.exception_remove_status, item.exception_remove_status,
                    item.exception_remove_date, item.exception_remove_date, item.exception_remove_date,
                    existingRows[0].id
                  ]
                );
              } else {
                await conn.query(
                  `INSERT INTO Exception_App_Rpt (
                    date, batch_code, student_code, student_name, center_code, center_name,
                    reason, remarks, status, created_by, created_by_email, cm_name, cm_email,
                    approval_remarks, approved_by, approved_by_email, approved_date,
                    exception_remove_status, exception_remove_date, uploaded_by
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    item.date, item.batch_code, item.student_code, item.student_name, item.center_code, item.center_name,
                    item.reason, item.remarks, item.status, item.created_by, item.created_by_email,
                    item.cm_name, item.cm_email, item.approval_remarks, item.approved_by,
                    item.approved_by_email, item.approved_date, item.exception_remove_status,
                    item.exception_remove_date, uploadedBy
                  ]
                );
              }

              if (item.isSpecialApproval && item.student_code) {
                if (item.batch_code) {
                  await conn.query(
                    `UPDATE raw_records SET incomplete_attendance_exception = 0, incomplete_module_exception = 0, validation_status = 'Special Approval'
                     WHERE LOWER(TRIM(student_code)) = LOWER(TRIM(?)) AND LOWER(TRIM(batch_code)) = LOWER(TRIM(?))`,
                    [item.student_code, item.batch_code]
                  );
                } else {
                  await conn.query(
                    `UPDATE raw_records SET incomplete_attendance_exception = 0, incomplete_module_exception = 0, validation_status = 'Special Approval'
                     WHERE LOWER(TRIM(student_code)) = LOWER(TRIM(?))`,
                    [item.student_code]
                  );
                }
              }
            }
            await conn.commit();
          } catch (e: any) {
            await conn.rollback();
            console.error('MySQL Exception_App_Rpt transaction failed:', e.message);
            throw e;
          } finally {
            conn.release();
          }
        }
      } catch (err: any) {
        console.error('MySQL Exception_App_Rpt pool error:', err.message);
        throw err;
      }
    }

    logAudit(
      uploadedBy,
      'System Admin',
      'UPLOAD_EXCEPTION_APPROVAL_REPORT',
      `Updated Exception_App_Rpt: ${specialApprovalCount} special approvals, ${approvedCount} standard approved, ${rejectedCount} pending/rejected across ${recordsUpdated} dataset records without modifying existing reports.`
    );

    return {
      success: true,
      specialApprovalCount,
      approvedCount,
      rejectedCount,
      recordsUpdated,
      totalProcessed: rows.length
    };
  } catch (err: any) {
    db.run('ROLLBACK');
    throw err;
  }
}

// -----------------------------------------------------------------------------
// System Restore Points & Database Snapshots Management
// -----------------------------------------------------------------------------

const RESTORE_POINTS_DIR = path.join(os.tmpdir(), 'ae_insight_restore_points');
const MANIFEST_PATH = path.join(RESTORE_POINTS_DIR, 'manifest.json');

function ensureRestorePointsDir() {
  if (!fs.existsSync(RESTORE_POINTS_DIR)) {
    fs.mkdirSync(RESTORE_POINTS_DIR, { recursive: true });
  }
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function getRestorePoints(): RestorePoint[] {
  ensureRestorePointsDir();
  if (!fs.existsSync(MANIFEST_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    const list: RestorePoint[] = JSON.parse(raw);
    return list.filter((item) => fs.existsSync(path.join(RESTORE_POINTS_DIR, item.fileName)));
  } catch (err) {
    console.error('Failed to read restore points manifest:', err);
    return [];
  }
}

function saveRestorePointsManifest(points: RestorePoint[]) {
  ensureRestorePointsDir();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(points, null, 2), 'utf-8');
}

export async function createRestorePoint(
  name?: string,
  description?: string,
  userEmail = 'aedevelopments@anudip.org',
  isBaseline = false
): Promise<RestorePoint> {
  ensureRestorePointsDir();
  saveDbToDisk();

  const db = await getDb();
  let recordCount = 0;
  let batchCount = 0;
  let uploadCount = 0;

  try {
    const r1 = db.exec('SELECT COUNT(*) as cnt FROM raw_records');
    recordCount = (r1[0]?.values[0][0] as number) || 0;
  } catch (e) {}

  try {
    const r2 = db.exec('SELECT COUNT(DISTINCT batch_code) as cnt FROM raw_records');
    batchCount = (r2[0]?.values[0][0] as number) || 0;
  } catch (e) {}

  try {
    const r3 = db.exec('SELECT COUNT(*) as cnt FROM uploads');
    uploadCount = (r3[0]?.values[0][0] as number) || 0;
  } catch (e) {}

  const id = `rp_${Date.now()}`;
  const fileName = `${id}.sqlite`;
  const destPath = path.join(RESTORE_POINTS_DIR, fileName);

  if (fs.existsSync(DB_FILE_PATH)) {
    fs.copyFileSync(DB_FILE_PATH, destPath);
  } else {
    const data = db.export();
    fs.writeFileSync(destPath, Buffer.from(data));
  }

  const stat = fs.statSync(destPath);
  const now = new Date();
  const pointName =
    name && name.trim()
      ? name.trim()
      : `Restore Point (${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})`;

  const pointDesc =
    description && description.trim()
      ? description.trim()
      : `Snapshot containing ${recordCount.toLocaleString()} student records across ${batchCount.toLocaleString()} batches.`;

  const newPoint: RestorePoint = {
    id,
    name: pointName,
    description: pointDesc,
    fileName,
    createdAt: now.toISOString(),
    fileSize: stat.size,
    fileSizeFormatted: formatBytes(stat.size),
    recordCount,
    batchCount,
    uploadCount,
    createdBy: userEmail,
    isBaseline,
  };

  const points = getRestorePoints();
  points.unshift(newPoint);
  saveRestorePointsManifest(points);

  logAudit(
    userEmail,
    'Admin',
    'CREATE_RESTORE_POINT',
    `Created restore point "${pointName}" (${formatBytes(stat.size)}, ${recordCount} records, ID: ${id})`,
    'success'
  );

  return newPoint;
}

export async function restoreFromPoint(id: string, userEmail = 'aedevelopments@anudip.org') {
  const points = getRestorePoints();
  const target = points.find((p) => p.id === id);
  if (!target) {
    throw new Error(`Restore point not found with ID: ${id}`);
  }

  const filePath = path.join(RESTORE_POINTS_DIR, target.fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Restore point file missing from disk: ${target.fileName}`);
  }

  // 1. Create a safety snapshot of current state before reverting
  try {
    await createRestorePoint(
      `Pre-Restore Safety Point (Before ${target.name})`,
      `Automatic safety backup captured before reverting to restore point ${target.id}`,
      userEmail,
      false
    );
  } catch (err) {
    console.warn('Could not create pre-restore safety point:', err);
  }

  // 2. Load the target snapshot into sql.js
  const fileBuffer = fs.readFileSync(filePath);
  const SQL = await initSqlJs();
  dbInstance = new SQL.Database(fileBuffer);
  saveDbToDisk();

  // 3. Query new records
  const db = await getDb();
  let newRecordCount = 0;
  try {
    const r1 = db.exec('SELECT COUNT(*) as cnt FROM raw_records');
    newRecordCount = (r1[0]?.values[0][0] as number) || 0;
  } catch (e) {}

  logAudit(
    userEmail,
    'Admin',
    'RESTORE_DATABASE',
    `Database successfully restored to "${target.name}" (${newRecordCount} records restored, source: ${target.fileName})`,
    'success'
  );

  return {
    success: true,
    restoredPoint: target,
    recordCount: newRecordCount,
  };
}

export async function deleteRestorePoint(id: string, userEmail = 'aedevelopments@anudip.org') {
  const points = getRestorePoints();
  const target = points.find((p) => p.id === id);
  if (!target) {
    throw new Error(`Restore point not found with ID: ${id}`);
  }

  const filePath = path.join(RESTORE_POINTS_DIR, target.fileName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn('Failed to delete physical file:', err);
    }
  }

  const filtered = points.filter((p) => p.id !== id);
  saveRestorePointsManifest(filtered);

  logAudit(
    userEmail,
    'Admin',
    'DELETE_RESTORE_POINT',
    `Deleted restore point "${target.name}" (ID: ${id})`,
    'success'
  );

  return { success: true };
}

export function getRestorePointFilePath(id: string): { filePath: string; fileName: string; displayName: string } {
  const points = getRestorePoints();
  const target = points.find((p) => p.id === id);
  if (!target) {
    throw new Error(`Restore point not found with ID: ${id}`);
  }
  const filePath = path.join(RESTORE_POINTS_DIR, target.fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error('Restore point file does not exist on disk');
  }
  return {
    filePath,
    fileName: target.fileName,
    displayName: `${target.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.sqlite`,
  };
}

export async function getExceptionApprovalReports(): Promise<any[]> {
  const db = await getDb();
  const rows: any[] = [];
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT e.*
      FROM Exception_App_Rpt e
      INNER JOIN raw_records r ON LOWER(TRIM(COALESCE(e.student_code, ''))) = LOWER(TRIM(COALESCE(r.student_code, '')))
      ORDER BY e.id DESC
    `);
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
  } catch (e) {
    console.warn('SQLite Exception_App_Rpt fetch warning:', e);
  }

  if (getActiveEngine() === 'mysql' || process.env.MYSQL_HOST) {
    try {
      const pool = await getMysqlPool();
      if (pool) {
        const [mysqlRows]: any = await pool.query(`
          SELECT DISTINCT e.*
          FROM Exception_App_Rpt e
          INNER JOIN raw_records r ON LOWER(TRIM(COALESCE(e.student_code, ''))) = LOWER(TRIM(COALESCE(r.student_code, '')))
          ORDER BY e.id DESC
        `);
        if (mysqlRows && mysqlRows.length > 0) {
          return mysqlRows;
        }
      }
    } catch (e) {
      console.warn('MySQL Exception_App_Rpt fetch warning:', e);
    }
  }

  return rows;
}

const processedSchedulingChunks = new Set<string>();

export async function insertScheduledVsConducted(
  rows: any[],
  uploadId?: string,
  uploadedBy = 'arnab.roy@anudip.org',
  options?: { chunkIndex?: number; isFinal?: boolean; totalChunks?: number }
): Promise<{ success: boolean; recordsInserted: number; uploadId: string }> {
  const uid = uploadId || crypto.randomUUID();
  const isFinalChunk = options?.isFinal !== false;
  const chunkKey = options?.chunkIndex !== undefined ? `svc:${uid}:${options.chunkIndex}` : null;

  if (chunkKey && processedSchedulingChunks.has(chunkKey)) {
    return {
      success: true,
      recordsInserted: rows ? rows.length : 0,
      uploadId: uid,
    };
  }

  const db = await getDb();

  // 1. Ensure SQLite table scheduled_vs_conducted exists
  db.run(`
    CREATE TABLE IF NOT EXISTS scheduled_vs_conducted (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_date TEXT,
      fm_email_id TEXT,
      batch_code TEXT,
      actual_center_code TEXT,
      program_name TEXT,
      gmeet_id TEXT,
      batch_status TEXT,
      actual_status TEXT,
      schedule_class_start_time TEXT,
      actual_class_started TEXT,
      schedule_class_end_time TEXT,
      actual_class_ended TEXT,
      class_link TEXT,
      form_status TEXT,
      upload_id TEXT,
      uploaded_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const validRows = (rows || []).filter(r => {
    const bc = r?.batch_code ? String(r.batch_code).trim() : '';
    return bc !== '' && bc.toLowerCase() !== 'null';
  });

  if (options?.chunkIndex === undefined || options?.chunkIndex === 0) {
    try {
      db.run("DELETE FROM scheduled_vs_conducted WHERE upload_id = 'UPL-SYSTEM-SCHED-INIT'");
    } catch {}
  }

  if (validRows.length > 0) {
    db.run('BEGIN TRANSACTION;');
    const insertStmt = db.prepare(`
      INSERT INTO scheduled_vs_conducted (
        slot_date, fm_email_id, batch_code, actual_center_code, program_name,
        gmeet_id, batch_status, actual_status, schedule_class_start_time,
        actual_class_started, schedule_class_end_time, actual_class_ended,
        class_link, form_status, upload_id, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of validRows) {
      insertStmt.run([
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
        uid,
        uploadedBy
      ]);
    }
    insertStmt.free();
    db.run('COMMIT;');
    sqliteDataVersion++;
    if (isFinalChunk) {
      saveDbToDisk();
    }
  }

  if (chunkKey) {
    processedSchedulingChunks.add(chunkKey);
  }

  // 2. Insert into MySQL table scheduled_vs_conducted in afae_aeinsight database
  if (getActiveEngine() === 'mysql' && validRows.length > 0) {
    try {
      await insertScheduledVsConductedToMysql(validRows, uid, uploadedBy);
    } catch {
      // Fallback to SQLite
    }
  }

  // 3. Log audit event on final chunk / single upload
  if (isFinalChunk) {
    logAudit(
      uploadedBy,
      'Admin',
      'UPLOAD_SCHEDULED_VS_CONDUCTED',
      `Uploaded Scheduled vs Conducted workbook: session records saved to scheduled_vs_conducted in database afae_aeinsight.`,
      'success',
      uid
    );
  }

  return {
    success: true,
    recordsInserted: validRows.length,
    uploadId: uid,
  };
}

interface SqliteSchedulingGroupRow {
  center_code: string;
  batch_code: string;
  program_name: string;
  fm_email_id: string;
  batch_status: string;
  total_scheduled: number;
  sessions_not_conducted: number;
  earliest_slot_date: string | null;
  latest_slot_date: string | null;
}

interface SqliteSchedulingMeta {
  version: number;
  batchToRmMap: Map<string, string>;
  batchToAeMap: Map<string, string>;
  rawBatchCodesByNorm: Map<string, Set<string>>;
  rescheduledMap: Map<string, number>;
  center_options: string[];
  program_options: string[];
  fm_options: string[];
  unfilteredBatchGroups: SqliteSchedulingGroupRow[];
}

let cachedSqliteSchedulingMeta: SqliteSchedulingMeta | null = null;
let schedulingSeedCheckedVersion = -1;
const sqliteSchedulingAnalyticsCache = new Map<string, { sqliteVer: number; mysqlVer: number; engine: string; data: SchedulingAnalyticsData }>();
const sqliteScheduledRecordsCache = new Map<string, { sqliteVer: number; mysqlVer: number; engine: string; data: { rows: any[]; totalCount: number } }>();

function resolveSqliteMatchingBatchCodes(
  meta: SqliteSchedulingMeta,
  effectiveRms: string[],
  effectiveAes: string[]
): { rawCodes: string[]; normSet: Set<string> } | null {
  if (effectiveRms.length === 0 && effectiveAes.length === 0) {
    return null;
  }

  const lowerRms = effectiveRms.map(r => r.trim().toLowerCase());
  const includeKrishnaAndUpvan = lowerRms.some(r => r === 'krishna prasad' || r.includes('krishna prasad'));
  const lowerAes = new Set(effectiveAes.map(a => a.trim().toLowerCase()));

  const matchedRawCodes = new Set<string>();
  const normSet = new Set<string>();
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

    normSet.add(normBc);
    const rawSet = meta.rawBatchCodesByNorm.get(normBc);
    if (rawSet && rawSet.size > 0) {
      for (const raw of rawSet) matchedRawCodes.add(raw);
    } else {
      matchedRawCodes.add(normBc);
    }
  }

  return { rawCodes: Array.from(matchedRawCodes), normSet };
}

async function getSqliteSchedulingMeta(db: Database): Promise<SqliteSchedulingMeta> {
  await seedSampleScheduledVsConductedIfEmpty(db);

  if (cachedSqliteSchedulingMeta && cachedSqliteSchedulingMeta.version === sqliteDataVersion) {
    return cachedSqliteSchedulingMeta;
  }

  const rescheduledMap = new Map<string, number>();
  try {
    const srStmt = db.prepare(`
      SELECT
        batch_code as bc,
        trainer_name,
        COUNT(actual_class_date) as cnt
      FROM slot_replacement
      WHERE batch_code IS NOT NULL AND batch_code != ''
        AND actual_class_date IS NOT NULL AND actual_class_date != ''
      GROUP BY batch_code, trainer_name
    `);
    while (srStmt.step()) {
      const r = srStmt.getAsObject() as any;
      if (r.bc) {
        const bcNorm = String(r.bc).toLowerCase().trim();
        const trNorm = String(r.trainer_name || '').toLowerCase().trim();
        const key = `${bcNorm}___${trNorm}`;
        rescheduledMap.set(key, (rescheduledMap.get(key) || 0) + (Number(r.cnt) || 0));
      }
    }
    srStmt.free();
  } catch {}

  const batchToRmMap = new Map<string, string>();
  const batchToAeMap = new Map<string, string>();
  const centerToRmMap = new Map<string, string>();
  const centerToAeMap = new Map<string, string>();
  const rawBatchCodesByNorm = new Map<string, Set<string>>();

  const registerRawBatch = (rawBc: any) => {
    if (!rawBc) return '';
    const str = String(rawBc);
    const trimmed = str.trim();
    const norm = trimmed.toLowerCase();
    if (!norm || norm === 'null') return '';
    let set = rawBatchCodesByNorm.get(norm);
    if (!set) {
      set = new Set<string>();
      rawBatchCodesByNorm.set(norm, set);
    }
    set.add(trimmed);
    if (str !== trimmed) set.add(str);
    return norm;
  };

  try {
    const rmMapStmt = db.prepare(`
      SELECT batch_code as bc, MAX(center_code) as cc, MAX(rm_sh_zh) as rm_sh_zh, MAX(assigned_ae) as assigned_ae
      FROM raw_records
      WHERE batch_code IS NOT NULL AND batch_code != ''
      GROUP BY batch_code
    `);
    while (rmMapStmt.step()) {
      const r = rmMapStmt.getAsObject() as any;
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
    rmMapStmt.free();
  } catch {}

  const centerSet = new Set<string>();
  const progSet = new Set<string>();
  const fmSet = new Set<string>();
  const unfilteredBatchGroups: SqliteSchedulingGroupRow[] = [];

  try {
    const groupStmt = db.prepare(`
      SELECT
        COALESCE(actual_center_code, '') as center_code,
        batch_code,
        COALESCE(program_name, '') as program_name,
        COALESCE(fm_email_id, '') as fm_email_id,
        COALESCE(MAX(batch_status), 'Running') as batch_status,
        COUNT(slot_date) as total_scheduled,
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
      WHERE batch_code IS NOT NULL AND TRIM(batch_code) != '' AND LOWER(TRIM(batch_code)) != 'null'
      GROUP BY actual_center_code, batch_code, program_name, fm_email_id
      ORDER BY actual_center_code ASC, batch_code ASC, fm_email_id ASC
    `);

    while (groupStmt.step()) {
      const row = groupStmt.getAsObject() as any;
      const normBc = registerRawBatch(row.batch_code);
      const cc = String(row.center_code || '').trim();
      const ccNorm = cc.toLowerCase();
      const pn = String(row.program_name || '').trim();
      const fm = String(row.fm_email_id || '').trim();
      if (cc) centerSet.add(cc);
      if (pn) progSet.add(pn);
      if (fm) fmSet.add(fm);

      // Fallback RM/AE resolution from Center Code when batch_code is not in raw_records
      if (normBc && ccNorm) {
        if (!batchToRmMap.has(normBc) && centerToRmMap.has(ccNorm)) {
          batchToRmMap.set(normBc, centerToRmMap.get(ccNorm)!);
        }
        if (!batchToAeMap.has(normBc) && centerToAeMap.has(ccNorm)) {
          batchToAeMap.set(normBc, centerToAeMap.get(ccNorm)!);
        }
      }

      unfilteredBatchGroups.push({
        center_code: cc,
        batch_code: String(row.batch_code || '').trim(),
        program_name: pn,
        fm_email_id: fm,
        batch_status: String(row.batch_status || 'Running').trim(),
        total_scheduled: Number(row.total_scheduled) || 0,
        sessions_not_conducted: Number(row.sessions_not_conducted) || 0,
        earliest_slot_date: row.earliest_slot_date ? String(row.earliest_slot_date) : null,
        latest_slot_date: row.latest_slot_date ? String(row.latest_slot_date) : null,
      });
    }
    groupStmt.free();
  } catch {}

  cachedSqliteSchedulingMeta = {
    version: sqliteDataVersion,
    batchToRmMap,
    batchToAeMap,
    rawBatchCodesByNorm,
    rescheduledMap,
    center_options: Array.from(centerSet).sort((a, b) => a.localeCompare(b)),
    program_options: Array.from(progSet).sort((a, b) => a.localeCompare(b)),
    fm_options: Array.from(fmSet).sort((a, b) => a.localeCompare(b)),
    unfilteredBatchGroups,
  };

  return cachedSqliteSchedulingMeta;
}

export async function getScheduledVsConducted(
  limit = 50,
  offset = 0,
  search = '',
  filters: FilterParams = {}
): Promise<{ rows: any[]; totalCount: number }> {
  const curEngine = getActiveEngine();
  const curMysqlVer = getMysqlDataVersion();

  // If MySQL is active, read from MySQL
  if (curEngine === 'mysql') {
    try {
      const mysqlRes = await getScheduledVsConductedFromMysql(limit, offset, search, filters);
      if (mysqlRes && mysqlRes.totalCount > 0) {
        return mysqlRes;
      }
    } catch {
      // Fall back to SQLite
    }
  }

  const db = await getDb();
  const meta = await getSqliteSchedulingMeta(db);
  const curSqliteVer = sqliteDataVersion;

  const cacheKey = JSON.stringify({ limit, offset, search: search.trim(), filters });
  const cached = sqliteScheduledRecordsCache.get(cacheKey);
  if (
    cached &&
    cached.sqliteVer === curSqliteVer &&
    cached.mysqlVer === curMysqlVer &&
    cached.engine === curEngine
  ) {
    return cached.data;
  }

  let where = '1=1';
  const params: any[] = [];

  const pt = (filters.programType || '').trim().toLowerCase();
  if (pt === 'diya only') {
    where += ` AND (LOWER(TRIM(COALESCE(program_name, ''))) NOT LIKE '%deep%tech%' AND LOWER(TRIM(COALESCE(program_name, ''))) NOT LIKE '%deeptech%' AND LOWER(TRIM(COALESCE(batch_code, ''))) NOT LIKE '%deep%')`;
  } else if (pt === 'deeptech only' || pt === 'deep tech only') {
    where += ` AND (LOWER(TRIM(COALESCE(program_name, ''))) LIKE '%deep%tech%' OR LOWER(TRIM(COALESCE(program_name, ''))) LIKE '%deeptech%' OR LOWER(TRIM(COALESCE(batch_code, ''))) LIKE '%deep%')`;
  }

  const effectiveCenters = (filters.centerCodes && filters.centerCodes.length > 0)
    ? filters.centerCodes.filter(c => c && c !== 'ALL')
    : (filters.centerCode && filters.centerCode !== 'ALL')
      ? filters.centerCode.split(',').map(c => c.trim()).filter(c => c && c !== 'ALL')
      : [];

  if (effectiveCenters.length === 1) {
    where += ` AND actual_center_code = ?`;
    params.push(effectiveCenters[0].trim());
  } else if (effectiveCenters.length > 1) {
    const placeholders = effectiveCenters.map(() => '?').join(', ');
    where += ` AND actual_center_code IN (${placeholders})`;
    params.push(...effectiveCenters.map(c => c.trim()));
  }

  const effectiveProgramNames = (filters.programNames && filters.programNames.length > 0)
    ? filters.programNames.filter(p => p && p !== 'ALL')
    : (filters.programName && filters.programName !== 'ALL')
      ? filters.programName.split(',').map(p => p.trim()).filter(p => p && p !== 'ALL')
      : [];

  if (effectiveProgramNames.length === 1) {
    where += ` AND program_name = ?`;
    params.push(effectiveProgramNames[0].trim());
  } else if (effectiveProgramNames.length > 1) {
    const placeholders = effectiveProgramNames.map(() => '?').join(', ');
    where += ` AND program_name IN (${placeholders})`;
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

  const matchedBatches = resolveSqliteMatchingBatchCodes(meta, effectiveRms, effectiveAes);
  if (matchedBatches !== null) {
    if (matchedBatches.rawCodes.length === 0) {
      const emptyRes = { rows: [], totalCount: 0 };
      sqliteScheduledRecordsCache.set(cacheKey, {
        sqliteVer: curSqliteVer,
        mysqlVer: curMysqlVer,
        engine: curEngine,
        data: emptyRes,
      });
      return emptyRes;
    }
    const placeholders = matchedBatches.rawCodes.map(() => '?').join(', ');
    where += ` AND batch_code IN (${placeholders})`;
    params.push(...matchedBatches.rawCodes);
  }

  if (filters.batchCode && filters.batchCode !== 'ALL') {
    where += ` AND batch_code = ?`;
    params.push(filters.batchCode.trim());
  }
  if (filters.batchStatus && filters.batchStatus !== 'ALL') {
    where += ` AND LOWER(TRIM(batch_status)) = LOWER(TRIM(?))`;
    params.push(filters.batchStatus);
  }

  const normalizedSlotDateExpr = `(CASE
    WHEN slot_date IS NULL OR TRIM(slot_date) = '' THEN NULL
    WHEN SUBSTR(TRIM(slot_date), 5, 1) IN ('-', '/') AND SUBSTR(TRIM(slot_date), 8, 1) IN ('-', '/')
      THEN REPLACE(SUBSTR(TRIM(slot_date), 1, 10), '/', '-')
    WHEN SUBSTR(TRIM(slot_date), 3, 1) IN ('-', '/') AND SUBSTR(TRIM(slot_date), 6, 1) IN ('-', '/')
      THEN SUBSTR(TRIM(slot_date), 7, 4) || '-' || SUBSTR(TRIM(slot_date), 4, 2) || '-' || SUBSTR(TRIM(slot_date), 1, 2)
    ELSE SUBSTR(TRIM(slot_date), 1, 10)
  END)`;

  if (filters.startDate && filters.startDate.trim() !== '') {
    where += ` AND ${normalizedSlotDateExpr} >= ?`;
    params.push(filters.startDate.trim());
  }
  if (filters.endDate && filters.endDate.trim() !== '') {
    where += ` AND ${normalizedSlotDateExpr} <= ?`;
    params.push(filters.endDate.trim());
  }

  if (search && search.trim() !== '') {
    const term = `%${search.trim().toLowerCase()}%`;
    where += ` AND (
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

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM scheduled_vs_conducted WHERE ${where}`);
  countStmt.bind(params);
  let totalCount = 0;
  if (countStmt.step()) {
    totalCount = Number(countStmt.getAsObject().total) || 0;
  }
  countStmt.free();

  const rowsStmt = db.prepare(`SELECT * FROM scheduled_vs_conducted WHERE ${where} ORDER BY slot_date DESC, id DESC LIMIT ? OFFSET ?`);
  rowsStmt.bind([...params, limit, offset]);
  const rows: any[] = [];
  while (rowsStmt.step()) {
    rows.push(rowsStmt.getAsObject());
  }
  rowsStmt.free();

  const result = { rows, totalCount };
  sqliteScheduledRecordsCache.set(cacheKey, {
    sqliteVer: curSqliteVer,
    mysqlVer: curMysqlVer,
    engine: curEngine,
    data: result,
  });
  return result;
}

export async function insertSlotReplacement(
  rows: any[],
  uploadId?: string,
  uploadedBy = 'arnab.roy@anudip.org',
  options?: { chunkIndex?: number; isFinal?: boolean; totalChunks?: number }
): Promise<{ success: boolean; recordsInserted: number; uploadId: string }> {
  const uid = uploadId || crypto.randomUUID();
  const isFinalChunk = options?.isFinal !== false;
  const chunkKey = options?.chunkIndex !== undefined ? `sr:${uid}:${options.chunkIndex}` : null;

  if (chunkKey && processedSchedulingChunks.has(chunkKey)) {
    return {
      success: true,
      recordsInserted: rows ? rows.length : 0,
      uploadId: uid,
    };
  }

  const db = await getDb();

  // 1. Ensure SQLite table slot_replacement exists
  db.run(`
    CREATE TABLE IF NOT EXISTS slot_replacement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_code TEXT,
      trainer_name TEXT,
      batch_code TEXT,
      alias TEXT,
      actual_class_date TEXT,
      replacement_class_date TEXT,
      center_code TEXT,
      center_name TEXT,
      approved_rejected_by TEXT,
      approval_rejected_date TEXT,
      requested_date TEXT,
      request_status TEXT,
      reason TEXT,
      upload_id TEXT,
      uploaded_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const validRows = (rows || []).filter(r => {
    const bc = r?.batch_code ? String(r.batch_code).trim() : '';
    return bc !== '' && bc.toLowerCase() !== 'null';
  });

  if (validRows.length > 0) {
    db.run('BEGIN TRANSACTION;');
    const insertStmt = db.prepare(`
      INSERT INTO slot_replacement (
        emp_code, trainer_name, batch_code, alias, actual_class_date,
        replacement_class_date, center_code, center_name, approved_rejected_by,
        approval_rejected_date, requested_date, request_status, reason,
        upload_id, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of validRows) {
      insertStmt.run([
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
        uid,
        uploadedBy
      ]);
    }
    insertStmt.free();
    db.run('COMMIT;');
    sqliteDataVersion++;
    if (isFinalChunk) {
      saveDbToDisk();
    }
  }

  if (chunkKey) {
    processedSchedulingChunks.add(chunkKey);
  }

  // 2. Insert into MySQL table slot_replacement in afae_aeinsight database
  if (getActiveEngine() === 'mysql' && validRows.length > 0) {
    try {
      await insertSlotReplacementToMysql(validRows, uid, uploadedBy);
    } catch {
      // Fall back to SQLite
    }
  }

  // 3. Log audit event on final chunk / single upload
  if (isFinalChunk) {
    logAudit(
      uploadedBy,
      'Admin',
      'UPLOAD_SLOT_REPLACEMENT',
      `Uploaded Slot Replacement workbook: records saved to slot_replacement in database afae_aeinsight.`,
      'success',
      uid
    );
  }

  return {
    success: true,
    recordsInserted: validRows.length,
    uploadId: uid,
  };
}

export async function getSlotReplacements(
  limit = 50,
  offset = 0,
  search = ''
): Promise<{ rows: any[]; totalCount: number }> {
  // If MySQL is active, read from MySQL
  if (getActiveEngine() === 'mysql') {
    try {
      return await getSlotReplacementsFromMysql(limit, offset, search);
    } catch {
      // Fall back to SQLite
    }
  }

  const db = await getDb();
  let where = '1=1';
  const params: any[] = [];
  if (search && search.trim() !== '') {
    const term = `%${search.trim().toLowerCase()}%`;
    where += ` AND (
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

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM slot_replacement WHERE ${where}`);
  countStmt.bind(params);
  let totalCount = 0;
  if (countStmt.step()) {
    totalCount = Number(countStmt.getAsObject().total) || 0;
  }
  countStmt.free();

  const rowsStmt = db.prepare(`SELECT * FROM slot_replacement WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`);
  rowsStmt.bind([...params, limit, offset]);
  const rows: any[] = [];
  while (rowsStmt.step()) {
    rows.push(rowsStmt.getAsObject());
  }
  rowsStmt.free();

  return { rows, totalCount };
}


async function seedSampleScheduledVsConductedIfEmpty(db: Database) {
  if (schedulingSeedCheckedVersion === sqliteDataVersion) {
    return;
  }

  const checkStmt = db.prepare('SELECT COUNT(*) as c FROM scheduled_vs_conducted');
  let count = 0;
  if (checkStmt.step()) {
    count = Number(checkStmt.getAsObject().c) || 0;
  }
  checkStmt.free();

  // Check if existing seed only had 1 RM (from old LIMIT 35 seed) without running an unindexed SQL join
  let needsReseed = count === 0;
  if (count > 0) {
    try {
      const seedBatchStmt = db.prepare(`
        SELECT DISTINCT batch_code
        FROM scheduled_vs_conducted
        WHERE upload_id = 'UPL-SYSTEM-SCHED-INIT' AND batch_code IS NOT NULL
      `);
      const seedBatches: string[] = [];
      while (seedBatchStmt.step()) {
        const bc = String(seedBatchStmt.getAsObject().batch_code || '').toLowerCase().trim();
        if (bc) seedBatches.push(bc);
      }
      seedBatchStmt.free();

      if (seedBatches.length > 0) {
        const rmLookupStmt = db.prepare(`
          SELECT batch_code, rm_sh_zh
          FROM raw_records
          WHERE batch_code IS NOT NULL AND rm_sh_zh IS NOT NULL
          GROUP BY batch_code
        `);
        const bcToRm = new Map<string, string>();
        while (rmLookupStmt.step()) {
          const r = rmLookupStmt.getAsObject() as any;
          const bc = String(r.batch_code || '').toLowerCase().trim();
          const rm = String(r.rm_sh_zh || '').trim();
          if (bc && rm) bcToRm.set(bc, rm);
        }
        rmLookupStmt.free();

        const matchedRms = new Set<string>();
        for (const bc of seedBatches) {
          const rm = bcToRm.get(bc);
          if (rm) matchedRms.add(rm);
        }
        if (matchedRms.size > 0 && matchedRms.size <= 2) {
          needsReseed = true;
        }
      }
    } catch (e) {}
  }

  if (!needsReseed) {
    schedulingSeedCheckedVersion = sqliteDataVersion;
    return;
  }

  if (count > 0) {
    db.run("DELETE FROM scheduled_vs_conducted WHERE upload_id = 'UPL-SYSTEM-SCHED-INIT'");
  }

  // Retrieve distinct batches across all RMs from raw_records
  const batchStmt = db.prepare(`
    SELECT
      batch_code,
      center_code,
      program_name,
      assigned_trainers,
      batch_status,
      rm_sh_zh
    FROM raw_records
    WHERE batch_code IS NOT NULL AND batch_code != ''
    GROUP BY batch_code
    ORDER BY id ASC
  `);

  const allBatches: any[] = [];
  while (batchStmt.step()) {
    allBatches.push(batchStmt.getAsObject());
  }
  batchStmt.free();

  const batchesByRm = new Map<string, any[]>();
  for (const b of allBatches) {
    const rm = String(b.rm_sh_zh || 'Unassigned').trim();
    if (!batchesByRm.has(rm)) batchesByRm.set(rm, []);
    const list = batchesByRm.get(rm)!;
    if (list.length < 4) {
      list.push(b);
    }
  }

  const batchesToSeed: any[] = [];
  for (const list of batchesByRm.values()) {
    batchesToSeed.push(...list);
  }

  if (batchesToSeed.length === 0) {
    schedulingSeedCheckedVersion = sqliteDataVersion;
    return;
  }

  db.run('BEGIN TRANSACTION;');
  const insertStmt = db.prepare(`
    INSERT INTO scheduled_vs_conducted (
      slot_date, fm_email_id, batch_code, actual_center_code, program_name,
      gmeet_id, batch_status, actual_status, schedule_class_start_time,
      actual_class_started, schedule_class_end_time, actual_class_ended,
      class_link, form_status, upload_id, uploaded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date('2026-10-20');
  const uid = 'UPL-SYSTEM-SCHED-INIT';

  for (let bIdx = 0; bIdx < batchesToSeed.length; bIdx++) {
    const b = batchesToSeed[bIdx];
    const trainerList = (b.assigned_trainers || 'trainer@anudip.org')
      .split(';')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const trainerEmail = trainerList[0] || 'trainer.anudip@anudip.org';
    const batchCode = String(b.batch_code).trim();
    const centerCode = String(b.center_code || 'WBCOE').trim();
    const programName = String(b.program_name || 'Deep Tech').trim();
    const batchStatus = String(b.batch_status || 'Running').trim();

    const slotsCount = 14 + (bIdx % 9);
    for (let s = 0; s < slotsCount; s++) {
      const slotD = new Date(now);
      slotD.setDate(slotD.getDate() - (slotsCount - s) * 2);
      const slotDateStr = slotD.toISOString().split('T')[0];

      const gmeetId = `meet.google.com/anp-${batchCode.toLowerCase().replace(/[^a-z0-9]/g, '')}-${s + 1}`;
      const classLink = `https://${gmeetId}`;

      let actualStatus = 'Conducted';
      let formStatus = 'Submitted';
      let actualStart: string | null = '10:02 AM';
      let actualEnd: string | null = '12:05 PM';

      const statusSeed = (bIdx * 7 + s * 13) % 100;
      if (statusSeed < 14) {
        actualStatus = 'Sessions Not started in CMIS';
        formStatus = 'No Form Filled';
        actualStart = null;
        actualEnd = null;
      } else if (statusSeed < 23) {
        actualStatus = 'Session not ended on CMIS';
        formStatus = 'No Form Filled';
        actualStart = '10:05 AM';
        actualEnd = null;
      }

      insertStmt.run([
        slotDateStr,
        trainerEmail,
        batchCode,
        centerCode,
        programName,
        gmeetId,
        batchStatus,
        actualStatus,
        '10:00 AM',
        actualStart,
        '12:00 PM',
        actualEnd,
        classLink,
        formStatus,
        uid,
        'system'
      ]);
    }
  }

  insertStmt.free();
  db.run('COMMIT;');
  saveDbToDisk();
  schedulingSeedCheckedVersion = sqliteDataVersion;
}

export async function getSchedulingAnalytics(filters: FilterParams = {}): Promise<SchedulingAnalyticsData> {
  const curEngine = getActiveEngine();
  const curMysqlVer = getMysqlDataVersion();

  if (curEngine === 'mysql') {
    try {
      const mysqlRes = await getSchedulingAnalyticsFromMysql(filters);
      if (mysqlRes && mysqlRes.batches && mysqlRes.batches.length > 0) {
        return mysqlRes;
      }
    } catch {
      // Fall back to SQLite
    }
  }

  const db = await getDb();
  const meta = await getSqliteSchedulingMeta(db);
  const curSqliteVer = sqliteDataVersion;

  const cacheKey = JSON.stringify(filters);
  const cached = sqliteSchedulingAnalyticsCache.get(cacheKey);
  if (
    cached &&
    cached.sqliteVer === curSqliteVer &&
    cached.mysqlVer === curMysqlVer &&
    cached.engine === curEngine
  ) {
    return cached.data;
  }

  const pt = (filters.programType || '').trim().toLowerCase();
  const effectiveCenters = (filters.centerCodes && filters.centerCodes.length > 0)
    ? filters.centerCodes.filter(c => c && c !== 'ALL')
    : (filters.centerCode && filters.centerCode !== 'ALL')
      ? filters.centerCode.split(',').map(c => c.trim()).filter(c => c && c !== 'ALL')
      : [];

  const effectiveProgramNames = (filters.programNames && filters.programNames.length > 0)
    ? filters.programNames.filter(p => p && p !== 'ALL')
    : (filters.programName && filters.programName !== 'ALL')
      ? filters.programName.split(',').map(p => p.trim()).filter(p => p && p !== 'ALL')
      : [];

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

  const matchedBatches = resolveSqliteMatchingBatchCodes(meta, effectiveRms, effectiveAes);
  const hasDateFilter = Boolean(
    (filters.startDate && filters.startDate.trim() !== '') ||
    (filters.endDate && filters.endDate.trim() !== '')
  );

  let groupedRows: SqliteSchedulingGroupRow[] = [];

  if (!hasDateFilter) {
    // Ultra-fast in-memory filtering of pre-grouped batch rows (< 0.2ms)
    const lowerCentersSet = effectiveCenters.length > 0
      ? new Set(effectiveCenters.map(c => c.trim().toLowerCase()))
      : null;
    const lowerProgsSet = effectiveProgramNames.length > 0
      ? new Set(effectiveProgramNames.map(p => p.trim().toLowerCase()))
      : null;
    const targetBatchCodeLower = filters.batchCode && filters.batchCode !== 'ALL'
      ? filters.batchCode.trim().toLowerCase()
      : null;
    const targetBatchStatusLower = filters.batchStatus && filters.batchStatus !== 'ALL'
      ? filters.batchStatus.trim().toLowerCase()
      : null;
    const trainerFilter = filters.assignedTrainer || filters.trainer;
    const targetTrainerLower = trainerFilter && trainerFilter !== 'ALL'
      ? trainerFilter.trim().toLowerCase()
      : null;
    const searchTermLower = filters.search && filters.search.trim()
      ? filters.search.trim().toLowerCase()
      : null;

    groupedRows = meta.unfilteredBatchGroups.filter(row => {
      const bcLower = row.batch_code.toLowerCase();
      const progLower = row.program_name.toLowerCase();
      const centerLower = row.center_code.toLowerCase();
      const fmLower = row.fm_email_id.toLowerCase();

      if (pt === 'diya only') {
        if ((progLower.includes('deep') && progLower.includes('tech')) || progLower.includes('deeptech') || bcLower.includes('deep')) {
          return false;
        }
      } else if (pt === 'deeptech only' || pt === 'deep tech only') {
        if (!((progLower.includes('deep') && progLower.includes('tech')) || progLower.includes('deeptech') || bcLower.includes('deep'))) {
          return false;
        }
      }

      if (lowerCentersSet && !lowerCentersSet.has(centerLower)) return false;
      if (lowerProgsSet && !lowerProgsSet.has(progLower)) return false;
      if (matchedBatches !== null && !matchedBatches.normSet.has(bcLower)) return false;
      if (targetBatchCodeLower && bcLower !== targetBatchCodeLower) return false;
      if (targetBatchStatusLower && row.batch_status.toLowerCase() !== targetBatchStatusLower) return false;
      if (targetTrainerLower && !fmLower.includes(targetTrainerLower)) return false;
      if (searchTermLower) {
        if (
          !bcLower.includes(searchTermLower) &&
          !fmLower.includes(searchTermLower) &&
          !centerLower.includes(searchTermLower) &&
          !progLower.includes(searchTermLower)
        ) {
          return false;
        }
      }

      return true;
    });
  } else {
    // Date filter active: run indexed SQLite query
    if (matchedBatches !== null && matchedBatches.rawCodes.length === 0) {
      groupedRows = [];
    } else {
      let where = "batch_code IS NOT NULL AND TRIM(batch_code) != '' AND LOWER(TRIM(batch_code)) != 'null'";
      const params: any[] = [];

      if (pt === 'diya only') {
        where += ` AND (LOWER(TRIM(COALESCE(program_name, ''))) NOT LIKE '%deep%tech%' AND LOWER(TRIM(COALESCE(program_name, ''))) NOT LIKE '%deeptech%' AND LOWER(TRIM(COALESCE(batch_code, ''))) NOT LIKE '%deep%')`;
      } else if (pt === 'deeptech only' || pt === 'deep tech only') {
        where += ` AND (LOWER(TRIM(COALESCE(program_name, ''))) LIKE '%deep%tech%' OR LOWER(TRIM(COALESCE(program_name, ''))) LIKE '%deeptech%' OR LOWER(TRIM(COALESCE(batch_code, ''))) LIKE '%deep%')`;
      }

      if (effectiveCenters.length === 1) {
        where += ` AND actual_center_code = ?`;
        params.push(effectiveCenters[0].trim());
      } else if (effectiveCenters.length > 1) {
        const placeholders = effectiveCenters.map(() => '?').join(', ');
        where += ` AND actual_center_code IN (${placeholders})`;
        params.push(...effectiveCenters.map(c => c.trim()));
      }

      if (effectiveProgramNames.length === 1) {
        where += ` AND program_name = ?`;
        params.push(effectiveProgramNames[0].trim());
      } else if (effectiveProgramNames.length > 1) {
        const placeholders = effectiveProgramNames.map(() => '?').join(', ');
        where += ` AND program_name IN (${placeholders})`;
        params.push(...effectiveProgramNames.map(p => p.trim()));
      }

      if (matchedBatches !== null) {
        const placeholders = matchedBatches.rawCodes.map(() => '?').join(', ');
        where += ` AND batch_code IN (${placeholders})`;
        params.push(...matchedBatches.rawCodes);
      }

      if (filters.batchCode && filters.batchCode !== 'ALL') {
        where += ` AND batch_code = ?`;
        params.push(filters.batchCode.trim());
      }
      if (filters.batchStatus && filters.batchStatus !== 'ALL') {
        where += ` AND LOWER(TRIM(batch_status)) = LOWER(TRIM(?))`;
        params.push(filters.batchStatus);
      }
      const trainerFilter = filters.assignedTrainer || filters.trainer;
      if (trainerFilter && trainerFilter !== 'ALL') {
        where += ` AND LOWER(TRIM(fm_email_id)) LIKE ?`;
        params.push(`%${trainerFilter.trim().toLowerCase()}%`);
      }

      const normalizedSlotDateExpr = `(CASE
        WHEN slot_date IS NULL OR TRIM(slot_date) = '' THEN NULL
        WHEN SUBSTR(TRIM(slot_date), 5, 1) IN ('-', '/') AND SUBSTR(TRIM(slot_date), 8, 1) IN ('-', '/')
          THEN REPLACE(SUBSTR(TRIM(slot_date), 1, 10), '/', '-')
        WHEN SUBSTR(TRIM(slot_date), 3, 1) IN ('-', '/') AND SUBSTR(TRIM(slot_date), 6, 1) IN ('-', '/')
          THEN SUBSTR(TRIM(slot_date), 7, 4) || '-' || SUBSTR(TRIM(slot_date), 4, 2) || '-' || SUBSTR(TRIM(slot_date), 1, 2)
        ELSE SUBSTR(TRIM(slot_date), 1, 10)
      END)`;

      if (filters.startDate && filters.startDate.trim() !== '') {
        where += ` AND ${normalizedSlotDateExpr} >= ?`;
        params.push(filters.startDate.trim());
      }
      if (filters.endDate && filters.endDate.trim() !== '') {
        where += ` AND ${normalizedSlotDateExpr} <= ?`;
        params.push(filters.endDate.trim());
      }
      if (filters.search && filters.search.trim()) {
        const term = `%${filters.search.trim().toLowerCase()}%`;
        where += ` AND (
          LOWER(COALESCE(batch_code, '')) LIKE ? OR
          LOWER(COALESCE(fm_email_id, '')) LIKE ? OR
          LOWER(COALESCE(actual_center_code, '')) LIKE ? OR
          LOWER(COALESCE(program_name, '')) LIKE ?
        )`;
        params.push(term, term, term, term);
      }

      const query = `
        SELECT
          COALESCE(actual_center_code, '') as center_code,
          batch_code,
          COALESCE(program_name, '') as program_name,
          COALESCE(fm_email_id, '') as fm_email_id,
          COALESCE(MAX(batch_status), 'Running') as batch_status,
          COUNT(slot_date) as total_scheduled,
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
        WHERE ${where}
        GROUP BY actual_center_code, batch_code, program_name, fm_email_id
        ORDER BY actual_center_code ASC, batch_code ASC, fm_email_id ASC
      `;

      const stmt = db.prepare(query);
      stmt.bind(params);
      while (stmt.step()) {
        const row: any = stmt.getAsObject();
        groupedRows.push({
          center_code: String(row.center_code || ''),
          batch_code: String(row.batch_code || ''),
          program_name: String(row.program_name || ''),
          fm_email_id: String(row.fm_email_id || ''),
          batch_status: String(row.batch_status || 'Running'),
          total_scheduled: Number(row.total_scheduled) || 0,
          sessions_not_conducted: Number(row.sessions_not_conducted) || 0,
          earliest_slot_date: row.earliest_slot_date ? String(row.earliest_slot_date) : null,
          latest_slot_date: row.latest_slot_date ? String(row.latest_slot_date) : null,
        });
      }
      stmt.free();
    }
  }

  const batches: SchedulingBatchItem[] = [];
  let totalScheduledAll = 0;
  let totalNotConductedAll = 0;

  for (const row of groupedRows) {
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
      batch_status: row.batch_status || 'Running',
      earliest_slot_date: row.earliest_slot_date || undefined,
      latest_slot_date: row.latest_slot_date || undefined,
    });
  }

  const totalConductedAll = Math.max(0, totalScheduledAll - totalNotConductedAll);
  const overallConductedPct = totalScheduledAll > 0 ? Number(((totalConductedAll / totalScheduledAll) * 100).toFixed(1)) : 100;
  const batchesWithMissed = batches.filter(b => b.sessions_not_conducted > 0).length;
  const zeroMissed = batches.length - batchesWithMissed;
  const totalRescheduledAll = batches.reduce((acc, b) => acc + (b.sessions_rescheduled || 0), 0);

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

  const distinctBatchesCount = new Set(batches.map(b => b.batch_code)).size;

  const initialRecords = await getScheduledVsConducted(50, 0, filters.search || '', filters);

  const finalResult: SchedulingAnalyticsData = {
    summary: {
      total_batches: distinctBatchesCount,
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
    initial_records: initialRecords,
  };

  sqliteSchedulingAnalyticsCache.set(cacheKey, {
    sqliteVer: curSqliteVer,
    mysqlVer: curMysqlVer,
    engine: curEngine,
    data: finalResult,
  });

  return finalResult;
}

export async function getBatchSessionDetails(batchCode: string, fmEmailId?: string): Promise<any[]> {
  if (getActiveEngine() === 'mysql') {
    try {
      const mysqlRows = await getBatchSessionDetailsFromMysql(batchCode, fmEmailId);
      if (mysqlRows && mysqlRows.length > 0) {
        return mysqlRows;
      }
    } catch {
      // Fall back to SQLite
    }
  }

  const db = await getDb();
  let sql = `SELECT * FROM scheduled_vs_conducted WHERE batch_code = ?`;
  const sqlParams: any[] = [batchCode.trim()];

  if (fmEmailId && fmEmailId.trim() && fmEmailId !== 'ALL' && fmEmailId !== 'N/A') {
    sql += ` AND fm_email_id = ?`;
    sqlParams.push(fmEmailId.trim());
  }

  sql += ` ORDER BY slot_date ASC, id ASC`;

  const stmt = db.prepare(sql);
  stmt.bind(sqlParams);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();

  if (rows.length > 0) {
    return rows;
  }

  // Fallback for case/whitespace differences
  let fallbackSql = `SELECT * FROM scheduled_vs_conducted WHERE LOWER(TRIM(batch_code)) = LOWER(TRIM(?))`;
  const fallbackParams: any[] = [batchCode];
  if (fmEmailId && fmEmailId.trim() && fmEmailId !== 'ALL' && fmEmailId !== 'N/A') {
    fallbackSql += ` AND LOWER(TRIM(fm_email_id)) = LOWER(TRIM(?))`;
    fallbackParams.push(fmEmailId.trim());
  }
  fallbackSql += ` ORDER BY slot_date ASC, id ASC`;

  const fbStmt = db.prepare(fallbackSql);
  fbStmt.bind(fallbackParams);
  while (fbStmt.step()) {
    rows.push(fbStmt.getAsObject());
  }
  fbStmt.free();
  return rows;
}

export async function insertChallenges(
  rows: any[],
  uploadId?: string,
  uploadedBy = 'arnab.roy@anudip.org'
): Promise<{ totalRecords: number; validCount: number; uploadId: string }> {
  if (getActiveEngine() === 'mysql') {
    try {
      return await insertChallengesToMysql(rows, uploadId, uploadedBy);
    } catch (e) {
      console.warn('MySQL insertChallenges failed, using SQLite:', e);
    }
  }

  const db = await getDb();
  const actualUploadId = uploadId || `upl_ch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  db.run('BEGIN TRANSACTION;');
  const stmt = db.prepare(`
    INSERT INTO challenges (
      sl_no, rm_name, challenges, impact, upload_id, uploaded_by
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const r of rows) {
    stmt.run([
      r.sl_no !== undefined && r.sl_no !== null ? String(r.sl_no).trim() : null,
      r.rm_name !== undefined && r.rm_name !== null ? String(r.rm_name).trim() : null,
      r.challenges !== undefined && r.challenges !== null ? String(r.challenges).trim() : null,
      r.impact !== undefined && r.impact !== null ? String(r.impact).trim() : null,
      actualUploadId,
      uploadedBy,
    ]);
    count++;
  }
  stmt.free();
  db.run('COMMIT;');
  saveDbToDisk();

  return { totalRecords: rows.length, validCount: count, uploadId: actualUploadId };
}

export async function getChallenges(
  limit = 50,
  offset = 0,
  search = ''
): Promise<{ rows: any[]; totalCount: number }> {
  if (getActiveEngine() === 'mysql') {
    try {
      const res = await getChallengesFromMysql(limit, offset, search);
      if (res && (res.totalCount > 0 || res.rows.length > 0)) return res;
    } catch {
      // Fallback
    }
  }

  const db = await getDb();
  let whereClause = '';
  const params: any[] = [];
  if (search && search.trim() !== '') {
    const term = `%${search.trim()}%`;
    whereClause = ` WHERE rm_name LIKE ? OR challenges LIKE ? OR impact LIKE ? OR sl_no LIKE ?`;
    params.push(term, term, term, term);
  }

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM challenges${whereClause}`);
  if (params.length > 0) countStmt.bind(params);
  let totalCount = 0;
  if (countStmt.step()) {
    totalCount = Number(countStmt.getAsObject().total) || 0;
  }
  countStmt.free();

  let querySql = `SELECT * FROM challenges${whereClause} ORDER BY id ASC`;
  const queryParams = [...params];
  if (limit > 0) {
    querySql += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);
  }

  const stmt = db.prepare(querySql);
  if (queryParams.length > 0) stmt.bind(queryParams);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();

  return { rows, totalCount };
}

export interface ChartRawExportRequest {
  module: 'trained' | 'dropout' | 'exception' | 'batch_closure' | 'scheduling';
  chartType?: string;
  chartTitle?: string;
  filters?: FilterParams;
  chartSummary?: any[];
}

function getEffectiveRmForExport(rawRm: any, programType?: string): string {
  const pt = (programType || '').trim().toLowerCase();
  const isDeepTechOnly = pt === 'deeptech only' || pt === 'deep tech only';
  const rmStr = String(rawRm || '').trim();
  if (!rmStr) return 'Unassigned';
  if (!isDeepTechOnly && rmStr.toLowerCase().includes('upvan')) {
    return 'Krishna Prasad';
  }
  return rmStr;
}

function parseDateDiffDays(endStr: any, startStr: any): number | null {
  if (!endStr || !startStr) return null;
  const dEnd = new Date(String(endStr).trim());
  const dStart = new Date(String(startStr).trim());
  if (isNaN(dEnd.getTime()) || isNaN(dStart.getTime())) return null;
  return Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 3600 * 24));
}

export async function exportChartRawDataWorkbook(req: ChartRawExportRequest): Promise<{ buffer: Buffer; fileName: string }> {
  const db = await getDb();
  const wb = XLSX.utils.book_new();
  const mod = req.module;
  const chartType = (req.chartType || 'all').toLowerCase();
  const filters: FilterParams = req.filters || {};
  const chartSummary = Array.isArray(req.chartSummary) ? req.chartSummary : [];

  // 1. Add Chart_Summary sheet if provided (skip duplicate summary sheet when exporting batch_summary directly)
  if (chartSummary.length > 0 && !chartType.startsWith('batch_summary')) {
    const cleanSummary = chartSummary.map((row, idx) => {
      const out: Record<string, any> = { Sl_No: idx + 1 };
      for (const [k, v] of Object.entries(row || {})) {
        if (typeof v !== 'object' || v === null) {
          out[k] = v;
        }
      }
      return out;
    });
    const summaryWs = XLSX.utils.json_to_sheet(cleanSummary);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Chart_Summary');
  }

  // Extract entity names displayed in the chart (for RM, Top 10/12 Center, Program, Trainer, or Batch Summary)
  const chartEntitySet = new Set<string>();
  if (
    ['rm', 'center', 'program', 'trainer', 'batch_summary'].includes(chartType) ||
    chartType.startsWith('batch_summary')
  ) {
    for (const item of chartSummary) {
      const entityKey = String(
        item.batch_code || item.name || item.center_code || item.program_name || item.trainer || item.rm_sh_zh || ''
      ).trim().toLowerCase();
      if (entityKey) chartEntitySet.add(entityKey);
    }
  }

  if (mod === 'trained' || mod === 'dropout' || mod === 'exception') {
    const effectiveFilters: FilterParams = {
      ...filters,
      module: mod,
      restrictDeepTech: true,
    };
    const { where, params } = buildFilterWhere(effectiveFilters, { restrictDeepTech: true });

    const sql = `SELECT * FROM raw_records WHERE ${where} ORDER BY batch_code ASC, student_code ASC`;
    const stmt = db.prepare(sql);
    stmt.bind(params);

    const allEnrichedRows: any[] = [];
    const chartScopedRows: any[] = [];

    while (stmt.step()) {
      const r = stmt.getAsObject() as any;
      const effectiveRm = getEffectiveRmForExport(r.rm_sh_zh, filters.programType);
      const batchStatusLower = String(r.batch_status || '').trim().toLowerCase();
      const enrollStatusLower = String(r.enrollment_status || '').trim().toLowerCase();
      const isBatchComplete = batchStatusLower === 'complete' || batchStatusLower === 'completed';
      const isBatchCompleteOrRunning = isBatchComplete || batchStatusLower === 'running';
      const isEnrolled = enrollStatusLower === 'enrolled';
      const marksNum = r.final_exam_marks !== null && r.final_exam_marks !== undefined && r.final_exam_marks !== '' ? Number(r.final_exam_marks) : null;
      const isTrained = isBatchCompleteOrRunning && isEnrolled && marksNum !== null && !isNaN(marksNum) && marksNum >= 50;

      let enriched: Record<string, any> = {};

      if (mod === 'trained') {
        const examOrActualEnd = r.exam_schedule_date || r.batch_actual_end_date;
        const delayDays = isTrained ? parseDateDiffDays(examOrActualEnd, r.batch_actual_end_date) : null;
        const isWithin10Days = isTrained && delayDays !== null && delayDays <= 10 ? 1 : 0;
        const isDelayedOver10Days = isTrained && (delayDays === null || delayDays > 10) ? 1 : 0;

        enriched = {
          Effective_RM_Name: effectiveRm,
          Original_RM_SH_ZH: r.rm_sh_zh || 'Unassigned',
          Center_Code: r.center_code || 'Unknown',
          Program_Name: r.program_name || 'Unknown',
          Batch_Code: r.batch_code || '',
          Student_Code: r.student_code || '',
          Batch_Status: r.batch_status || '',
          Enrollment_Status: r.enrollment_status || '',
          Final_Exam_Marks: marksNum,
          Batch_Actual_End_Date: r.batch_actual_end_date || '',
          Exam_Schedule_Date: r.exam_schedule_date || '',
          Assessment_Delay_Days: delayDays,
          Is_Completed_Enrolled_Flag: isBatchComplete && isEnrolled ? 1 : 0,
          Is_Trained_Chart_Counted_Flag: isTrained ? 1 : 0,
          Is_Trained_Within_10_Days_Flag: isWithin10Days,
          Is_Trained_Delayed_Over_10_Days_Flag: isDelayedOver10Days,
          Funder_Name: r.funder_name || '',
          Course_Code: r.course_code || '',
          Assigned_Trainers: r.assigned_trainers || '',
          Assigned_AE: r.assigned_ae || '',
          Batch_Start_Date: r.batch_start_date || '',
          Batch_Planned_End_Date: r.batch_end_date || '',
          Running_Attendance: r.running_attendance,
          Beneficiary_Class_Attendance: r.beneficiary_class_attendance,
          FM_Class_Completion: r.fm_class_completion,
          ILT_Completion: r.ilt_completion,
          Placement_Type: r.placement_type || '',
          Email_Verification_Status: r.email_verification_status || '',
          Student_Validation_Status: r.validation_status || '',
          Validation_Done_By: r.validation_done_by || '',
          Batch_Validation_Status: r.batch_validation_status || '',
        };
      } else if (mod === 'dropout') {
        const isDropout = enrollStatusLower === 'dropped out';
        const dType = String(r.dropout_type || '').trim();
        const isInitialDropout = isDropout && dType === 'Initial Session Dropout' ? 1 : 0;
        const isRegularDropout = isDropout && dType === 'Regular Session Dropout' ? 1 : 0;
        const isRetained = isDropout ? 0 : 1;
        const batchStartMonth = r.batch_start_date ? String(r.batch_start_date).substring(0, 7) : 'Unknown';
        let lifecycleOutcome = 'Active / Ongoing Enrolled';
        if (isInitialDropout) lifecycleOutcome = 'Initial Session Dropout';
        else if (isRegularDropout) lifecycleOutcome = 'Regular Session Dropout';
        else if (isDropout) lifecycleOutcome = 'Other Dropout';
        else if (isBatchComplete) lifecycleOutcome = 'Completed Batch (Retained)';

        enriched = {
          Effective_RM_Name: effectiveRm,
          Original_RM_SH_ZH: r.rm_sh_zh || 'Unassigned',
          Center_Code: r.center_code || 'Unknown',
          Program_Name: r.program_name || 'Unknown',
          Batch_Start_Month: batchStartMonth,
          Batch_Code: r.batch_code || '',
          Student_Code: r.student_code || '',
          Enrollment_Status: r.enrollment_status || '',
          Dropout_Type: r.dropout_type || '',
          Lifecycle_Outcome: lifecycleOutcome,
          Total_Students_Flag: 1,
          Is_Initial_Dropout_Flag: isInitialDropout,
          Is_Regular_Dropout_Flag: isRegularDropout,
          Is_Total_Dropout_Flag: isDropout ? 1 : 0,
          Is_Retained_Student_Flag: isRetained,
          Batch_Status: r.batch_status || '',
          Joining_Date: r.joining_date || '',
          Batch_Start_Date: r.batch_start_date || '',
          Batch_End_Date: r.batch_end_date || '',
          Batch_Actual_End_Date: r.batch_actual_end_date || '',
          Funder_Name: r.funder_name || '',
          Course_Code: r.course_code || '',
          Assigned_Trainers: r.assigned_trainers || '',
          Assigned_AE: r.assigned_ae || '',
          Running_Attendance: r.running_attendance,
          Beneficiary_Class_Attendance: r.beneficiary_class_attendance,
          Final_Exam_Marks: marksNum,
          Student_Validation_Status: r.validation_status || '',
        };
      } else if (mod === 'exception') {
        const primaryTrainer = r.assigned_trainers
          ? String(r.assigned_trainers).split(',')[0].trim() || 'Unassigned'
          : 'Unassigned';
        const rawExc = Number(r.incomplete_attendance_exception) === 1;
        const specStr = String(r.special_case ?? '').trim().toLowerCase();
        const valStr = String(r.validation_status ?? '').trim().toLowerCase();
        const isSpecialExcluded =
          specStr === '1' ||
          specStr === 'special' ||
          specStr === 'special_case' ||
          r.special_case === 1 ||
          valStr.includes('special approval') ||
          valStr.includes('special approved');
        const isCountedException = rawExc && !isSpecialExcluded ? 1 : 0;

        enriched = {
          Effective_RM_Name: effectiveRm,
          Original_RM_SH_ZH: r.rm_sh_zh || 'Unassigned',
          Center_Code: r.center_code || 'Unknown',
          Program_Name: r.program_name || 'Unknown',
          Primary_Trainer: primaryTrainer,
          All_Assigned_Trainers: r.assigned_trainers || '',
          Batch_Code: r.batch_code || '',
          Student_Code: r.student_code || '',
          Is_Trained_Denominator_Flag: isTrained ? 1 : 0,
          Is_Counted_Exception_In_Chart_Flag: isCountedException,
          Raw_Incomplete_Attendance_Exception_Flag: rawExc ? 1 : 0,
          Incomplete_Module_Exception_Flag: Number(r.incomplete_module_exception) === 1 ? 1 : 0,
          Is_Special_Approval_Excluded_Flag: isSpecialExcluded ? 1 : 0,
          Special_Case_Value: r.special_case ?? '',
          Student_Validation_Status: r.validation_status || '',
          Validation_Done_By: r.validation_done_by || '',
          ILT_Completion: r.ilt_completion,
          ILT_as_on_Joining_Date: r.ilt_as_on_joining_date ?? r.ilt_completion,
          FM_Class_Completion: r.fm_class_completion,
          Running_Attendance: r.running_attendance,
          Beneficiary_Class_Attendance: r.beneficiary_class_attendance,
          Placement_Type: r.placement_type || '',
          Joining_Date: r.joining_date || '',
          Final_Exam_Marks: marksNum,
          Batch_Status: r.batch_status || '',
          Enrollment_Status: r.enrollment_status || '',
          Batch_Start_Date: r.batch_start_date || '',
          Batch_End_Date: r.batch_end_date || '',
          Batch_Actual_End_Date: r.batch_actual_end_date || '',
          Funder_Name: r.funder_name || '',
          Assigned_AE: r.assigned_ae || '',
        };
      }

      allEnrichedRows.push(enriched);

      if (chartEntitySet.size > 0) {
        let rowEntity = '';
        if (chartType === 'center') rowEntity = String(r.center_code || 'Unknown').trim().toLowerCase();
        else if (chartType === 'program') rowEntity = String(r.program_name || 'Unknown').trim().toLowerCase();
        else if (chartType === 'trainer') {
          rowEntity = (r.assigned_trainers ? String(r.assigned_trainers).split(',')[0].trim() : 'Unassigned').toLowerCase();
        }
        if (chartEntitySet.has(rowEntity)) {
          chartScopedRows.push(enriched);
        }
      }
    }
    stmt.free();

    if (chartEntitySet.size > 0 && chartScopedRows.length > 0 && chartScopedRows.length < allEnrichedRows.length) {
      const wsScoped = XLSX.utils.json_to_sheet(chartScopedRows);
      XLSX.utils.book_append_sheet(wb, wsScoped, 'Chart_Raw_Data');
      const wsAll = XLSX.utils.json_to_sheet(allEnrichedRows);
      XLSX.utils.book_append_sheet(wb, wsAll, 'All_Filtered_Raw_Data');
    } else {
      const wsAll = XLSX.utils.json_to_sheet(
        allEnrichedRows.length > 0 ? allEnrichedRows : [{ Note: 'No matching raw records for current filters' }]
      );
      XLSX.utils.book_append_sheet(wb, wsAll, 'Chart_Raw_Data');
    }
  } else if (mod === 'batch_closure') {
    const effectiveFilters: FilterParams = {
      ...filters,
      module: 'batch_closure',
      restrictDeepTech: true,
    };
    const { where, params } = buildFilterWhere(effectiveFilters, { restrictDeepTech: true });

    const batchLevelQuery = `
      SELECT
        batch_code,
        center_code,
        funder_name,
        program_name,
        course_code,
        assigned_trainers,
        assigned_ae,
        rm_sh_zh,
        batch_start_date,
        batch_initial_start_date,
        batch_initial_end_date,
        batch_end_date,
        batch_actual_end_date,
        batch_status,
        batch_validation_status,
        AVG(CAST(ilt_completion AS REAL)) as ilt_completion,
        COUNT(*) as student_count,
        COUNT(CASE WHEN LOWER(enrollment_status) = 'dropped out' THEN 1 END) as dropout_count
      FROM raw_records
      WHERE ${where}
      GROUP BY batch_code
      ORDER BY batch_code ASC
    `;

    const stmt = db.prepare(batchLevelQuery);
    stmt.bind(params);

    const allBatchRows: any[] = [];
    const scopedBatchRows: any[] = [];

    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      const effectiveRm = getEffectiveRmForExport(row.rm_sh_zh, filters.programType);
      const batchStatusLower = String(row.batch_status || '').trim().toLowerCase();
      const isCompleted = batchStatusLower === 'complete' || batchStatusLower === 'completed';
      const initialEndDateStr = String(row.batch_initial_end_date || '').trim();
      const endDateStr = String(row.batch_end_date || '').trim();
      const baselineEndDateStr = initialEndDateStr !== '' ? initialEndDateStr : endDateStr;
      const actualEndDateStr = String(row.batch_actual_end_date || '').trim();

      const isEligibleClosed = isCompleted && Boolean(actualEndDateStr && baselineEndDateStr);
      let diffDays: number | null = null;
      if (isEligibleClosed) {
        const plannedEndDate = new Date(baselineEndDateStr).getTime();
        const actualEndDate = new Date(actualEndDateStr).getTime();
        diffDays = Math.round((actualEndDate - plannedEndDate) / (1000 * 3600 * 24));
      }
      const iltRaw = row.ilt_completion != null ? Number(row.ilt_completion) : null;
      const iltPct = iltRaw != null ? Number((iltRaw > 2.0 ? iltRaw : iltRaw * 100).toFixed(1)) : null;

      const isWithin10 = isEligibleClosed && diffDays !== null && diffDays <= 10;
      const isAfter10 = isCompleted && (!isEligibleClosed || (diffDays !== null && diffDays > 10));

      const batchRecord = {
        Batch_Code: row.batch_code || '',
        Effective_RM_Name: effectiveRm,
        Original_RM_SH_ZH: row.rm_sh_zh || 'Unassigned',
        Center_Code: row.center_code || 'Unknown',
        Program_Name: row.program_name || 'Unknown',
        Batch_Status: row.batch_status || '',
        Batch_Validation_Status: row.batch_validation_status || 'Not Yet Validated',
        Batch_Start_Date: row.batch_start_date || '',
        Initial_Batch_End_Date: row.batch_initial_end_date || '',
        Planned_Batch_End_Date: row.batch_end_date || '',
        Baseline_Target_End_Date: baselineEndDateStr,
        Actual_Batch_End_Date: row.batch_actual_end_date || '',
        Closure_Delay_Days: diffDays,
        Is_Eligible_Closed_Batch_Flag: isEligibleClosed ? 1 : 0,
        Is_On_Time_Closure_Flag: isEligibleClosed && diffDays !== null && diffDays <= 0 ? 1 : 0,
        Is_Delayed_Closure_Flag: isEligibleClosed && diffDays !== null && diffDays > 0 ? 1 : 0,
        Is_Closed_Within_10_Days_Flag: isWithin10 ? 1 : 0,
        Is_Closed_After_10_Days_Flag: isAfter10 ? 1 : 0,
        Is_Closed_Within_7_Days_Flag: isWithin10 ? 1 : 0,
        Is_Closed_After_7_Days_Flag: isAfter10 ? 1 : 0,
        Avg_ILT_Completion_Pct: iltPct,
        Student_Count: Number(row.student_count) || 0,
        Dropout_Count: Number(row.dropout_count) || 0,
        Funder_Name: row.funder_name || '',
        Course_Code: row.course_code || '',
        Assigned_Trainers: row.assigned_trainers || '',
        Assigned_AE: row.assigned_ae || '',
      };

      allBatchRows.push(batchRecord);

      if (chartEntitySet.size > 0) {
        let entityVal = '';
        if (chartType === 'center') entityVal = String(row.center_code || 'Unknown').trim().toLowerCase();
        else if (chartType === 'program') entityVal = String(row.program_name || 'Unknown').trim().toLowerCase();
        if (chartEntitySet.has(entityVal)) {
          scopedBatchRows.push(batchRecord);
        }
      }
    }
    stmt.free();

    if (chartEntitySet.size > 0 && scopedBatchRows.length > 0 && scopedBatchRows.length < allBatchRows.length) {
      const wsScoped = XLSX.utils.json_to_sheet(scopedBatchRows);
      XLSX.utils.book_append_sheet(wb, wsScoped, 'Chart_Batches_Raw_Data');
      const wsAll = XLSX.utils.json_to_sheet(allBatchRows);
      XLSX.utils.book_append_sheet(wb, wsAll, 'All_Batches_Raw_Data');
    } else {
      const wsAll = XLSX.utils.json_to_sheet(
        allBatchRows.length > 0 ? allBatchRows : [{ Note: 'No matching batches for current filters' }]
      );
      XLSX.utils.book_append_sheet(wb, wsAll, 'Chart_Batches_Raw_Data');
    }
  } else if (mod === 'scheduling') {
    const schedData = await getSchedulingAnalytics(filters);
    const meta = await getSqliteSchedulingMeta(db);

    const allBatchSummaryRows: any[] = [];
    const scopedBatchSummaryRows: any[] = [];
    const targetBatchCodesLower = new Set<string>();

    for (const b of schedData.batches || []) {
      const bcLower = String(b.batch_code || '').trim().toLowerCase();
      const rawRm = meta.batchToRmMap.get(bcLower) || 'Unassigned';
      const effectiveRm = getEffectiveRmForExport(rawRm, filters.programType);

      const batchRow = {
        Effective_RM_Name: effectiveRm,
        Original_RM_Name: rawRm,
        Center_Code: b.center_code || 'N/A',
        Batch_Code: b.batch_code || 'N/A',
        Program_Name: b.program_name || 'N/A',
        Trainer_FM_Email_ID: b.fm_email_id || 'N/A',
        Batch_Status: b.batch_status || 'Running',
        No_Of_Scheduled: b.total_scheduled || 0,
        No_Of_Conducted: b.sessions_conducted || 0,
        No_Of_Not_Conducted: b.sessions_not_conducted || 0,
        No_Of_Rescheduled: b.sessions_rescheduled || 0,
        Conducted_Pct: b.conducted_pct || 0,
        Earliest_Slot_Date: b.earliest_slot_date || '',
        Latest_Slot_Date: b.latest_slot_date || '',
      };

      allBatchSummaryRows.push(batchRow);

      let inScope = true;
      if (chartType === 'rm') {
        if (effectiveRm.trim().toLowerCase() === 'unassigned') {
          inScope = false;
        } else if (chartEntitySet.size > 0) {
          inScope = chartEntitySet.has(effectiveRm.trim().toLowerCase());
        }
      } else if (chartEntitySet.size > 0) {
        if (chartType === 'center') {
          inScope = chartEntitySet.has(String(b.center_code || 'N/A').trim().toLowerCase());
        } else if (chartType === 'program') {
          inScope = chartEntitySet.has(String(b.program_name || 'N/A').trim().toLowerCase());
        } else if (chartType === 'batch_summary' || chartType.startsWith('batch_summary')) {
          inScope = chartEntitySet.has(bcLower);
        }
      }
      if (inScope) {
        scopedBatchSummaryRows.push(batchRow);
        if (bcLower) targetBatchCodesLower.add(bcLower);
      }
    }

    const summarySheetName = chartType.startsWith('batch_summary') ? 'Batch_Summary' : 'Chart_Batch_Summary';

    if (
      (chartEntitySet.size > 0 || chartType === 'rm') &&
      scopedBatchSummaryRows.length > 0 &&
      scopedBatchSummaryRows.length <= allBatchSummaryRows.length
    ) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scopedBatchSummaryRows), summarySheetName);
      if (scopedBatchSummaryRows.length < allBatchSummaryRows.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allBatchSummaryRows), 'All_Batch_Summary');
      }
    } else {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(allBatchSummaryRows.length > 0 ? allBatchSummaryRows : [{ Note: 'No matching scheduling batches' }]),
        summarySheetName
      );
      for (const b of schedData.batches || []) {
        const bcLower = String(b.batch_code || '').trim().toLowerCase();
        if (bcLower) targetBatchCodesLower.add(bcLower);
      }
    }

    // Also include underlying raw session slots from scheduled_vs_conducted (and slot_replacement)
    let rawSlotRows: any[] = [];
    let rawReplacementRows: any[] = [];

    if (targetBatchCodesLower.size > 0) {
      if (getActiveEngine() === 'mysql') {
        try {
          const svcMysql = await queryMysql<any>(
            `SELECT slot_date, fm_email_id, batch_code, actual_center_code, program_name, batch_status, actual_status, form_status, schedule_class_start_time, actual_class_started, schedule_class_end_time, actual_class_ended
             FROM scheduled_vs_conducted
             WHERE batch_code IS NOT NULL AND TRIM(batch_code) != ''
             ORDER BY batch_code ASC, slot_date ASC
             LIMIT 25000`
          );
          rawSlotRows = svcMysql;

          const srMysql = await queryMysql<any>(
            `SELECT emp_code, trainer_name, batch_code, actual_class_date, replacement_class_date, center_code, center_name, request_status, reason
             FROM slot_replacement
             WHERE batch_code IS NOT NULL AND TRIM(batch_code) != ''
             ORDER BY batch_code ASC, actual_class_date ASC
             LIMIT 10000`
          );
          rawReplacementRows = srMysql;
        } catch {
          // Fallback to SQLite below
        }
      }

      if (rawSlotRows.length === 0) {
        const slotStmt = db.prepare(`
          SELECT slot_date, fm_email_id, batch_code, actual_center_code, program_name, batch_status, actual_status, form_status, schedule_class_start_time, actual_class_started, schedule_class_end_time, actual_class_ended
          FROM scheduled_vs_conducted
          WHERE batch_code IS NOT NULL AND TRIM(batch_code) != ''
          ORDER BY batch_code ASC, slot_date ASC
          LIMIT 25000
        `);
        while (slotStmt.step()) {
          rawSlotRows.push(slotStmt.getAsObject());
        }
        slotStmt.free();
      }

      if (rawReplacementRows.length === 0) {
        try {
          const srStmt = db.prepare(`
            SELECT emp_code, trainer_name, batch_code, actual_class_date, replacement_class_date, center_code, center_name, request_status, reason
            FROM slot_replacement
            WHERE batch_code IS NOT NULL AND TRIM(batch_code) != ''
            ORDER BY batch_code ASC, actual_class_date ASC
            LIMIT 10000
          `);
          while (srStmt.step()) {
            rawReplacementRows.push(srStmt.getAsObject());
          }
          srStmt.free();
        } catch {
          // Ignore if table empty
        }
      }
    }

    const filteredSlotExportRows: any[] = [];
    for (const s of rawSlotRows) {
      const bcLower = String(s.batch_code || '').trim().toLowerCase();
      if (!targetBatchCodesLower.has(bcLower)) continue;

      const rawRm = meta.batchToRmMap.get(bcLower) || 'Unassigned';
      const effectiveRm = getEffectiveRmForExport(rawRm, filters.programType);
      const actStatus = String(s.actual_status || '').trim().toLowerCase();
      const frmStatus = String(s.form_status || '').trim().toLowerCase();

      const isNotConducted =
        (actStatus === 'sessions not started in cmis' ||
          actStatus === 'session not ended on cmis' ||
          actStatus === 'sessions not started on cmis' ||
          actStatus === 'session not started in cmis' ||
          actStatus === 'session not ended in cmis' ||
          (actStatus.includes('not started') && actStatus.includes('cmis')) ||
          (actStatus.includes('not ended') && actStatus.includes('cmis'))) &&
        (frmStatus === 'no form filled' ||
          frmStatus === 'no form' ||
          frmStatus === 'not filled' ||
          frmStatus.includes('no form'));

      filteredSlotExportRows.push({
        Effective_RM_Name: effectiveRm,
        Original_RM_Name: rawRm,
        Center_Code: s.actual_center_code || '',
        Batch_Code: s.batch_code || '',
        Program_Name: s.program_name || '',
        Trainer_FM_Email_ID: s.fm_email_id || '',
        Slot_Date: s.slot_date || '',
        Batch_Status: s.batch_status || '',
        Actual_Status: s.actual_status || '',
        Form_Status: s.form_status || '',
        Is_Scheduled_Slot_Flag: s.slot_date ? 1 : 0,
        Is_Conducted_Slot_Flag: isNotConducted ? 0 : 1,
        Is_Not_Conducted_Slot_Flag: isNotConducted ? 1 : 0,
        Schedule_Start_Time: s.schedule_class_start_time || '',
        Actual_Class_Started: s.actual_class_started || '',
        Schedule_End_Time: s.schedule_class_end_time || '',
        Actual_Class_Ended: s.actual_class_ended || '',
      });
    }

    if (filteredSlotExportRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredSlotExportRows), 'Raw_Session_Slots');
    }

    const filteredSrRows: any[] = [];
    for (const sr of rawReplacementRows) {
      const bcLower = String(sr.batch_code || '').trim().toLowerCase();
      if (!targetBatchCodesLower.has(bcLower)) continue;
      const rawRm = meta.batchToRmMap.get(bcLower) || 'Unassigned';
      const effectiveRm = getEffectiveRmForExport(rawRm, filters.programType);
      filteredSrRows.push({
        Effective_RM_Name: effectiveRm,
        Batch_Code: sr.batch_code || '',
        Trainer_Name_Email: sr.trainer_name || '',
        Emp_Code: sr.emp_code || '',
        Actual_Class_Date: sr.actual_class_date || '',
        Replacement_Class_Date: sr.replacement_class_date || '',
        Center_Code: sr.center_code || '',
        Center_Name: sr.center_name || '',
        Request_Status: sr.request_status || '',
        Reason: sr.reason || '',
      });
    }

    if (filteredSrRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredSrRows), 'Raw_Slot_Replacements');
    }
  } else if (mod === 'running_batch') {
    const effectiveFilters: FilterParams = {
      ...filters,
      module: 'running_batch',
      restrictDeepTech: true,
      batchStatus: 'running',
    };
    const { where, params } = buildFilterWhere(effectiveFilters, { restrictDeepTech: true });

    const sql = `SELECT * FROM raw_records WHERE ${where} ORDER BY batch_code ASC, student_code ASC`;
    const stmt = db.prepare(sql);
    stmt.bind(params);

    const allRunningRows: any[] = [];
    const scopedRunningRows: any[] = [];

    while (stmt.step()) {
      const r = stmt.getAsObject() as any;
      const effectiveRm = getEffectiveRmForExport(r.rm_sh_zh, filters.programType);
      const rawRunAtt = r.running_attendance != null ? Number(r.running_attendance) : null;
      const runAttPct = rawRunAtt != null ? Number((rawRunAtt > 2.0 ? rawRunAtt : rawRunAtt * 100).toFixed(1)) : null;
      const rawBenAtt = r.beneficiary_class_attendance != null ? Number(r.beneficiary_class_attendance) : null;
      const benAttPct = rawBenAtt != null ? Number((rawBenAtt > 2.0 ? rawBenAtt : rawBenAtt * 100).toFixed(1)) : null;
      const rawIlt = r.ilt_completion != null ? Number(r.ilt_completion) : null;
      const iltPct = rawIlt != null ? Number((rawIlt > 2.0 ? rawIlt : rawIlt * 100).toFixed(1)) : null;

      const rowObj = {
        Effective_RM_Name: effectiveRm,
        Original_RM_SH_ZH: r.rm_sh_zh || 'Unassigned',
        Center_Code: r.center_code || 'Unknown',
        Program_Name: r.program_name || 'Unknown',
        Batch_Code: r.batch_code || '',
        Student_Code: r.student_code || '',
        Batch_Status: r.batch_status || '',
        Enrollment_Status: r.enrollment_status || '',
        Running_Attendance_Pct: runAttPct,
        Beneficiary_Class_Attendance_Pct: benAttPct,
        ILT_Completion_Pct: iltPct,
        Funder_Name: r.funder_name || '',
        Course_Code: r.course_code || '',
        Assigned_Trainers: r.assigned_trainers || '',
        Assigned_AE: r.assigned_ae || '',
        Batch_Start_Date: r.batch_start_date || '',
        Batch_Planned_End_Date: r.batch_end_date || '',
      };

      allRunningRows.push(rowObj);

      if (chartEntitySet.size > 0) {
        let entityVal = '';
        if (chartType === 'rm') entityVal = effectiveRm.trim().toLowerCase();
        else if (chartType === 'center') entityVal = String(r.center_code || 'Unknown').trim().toLowerCase();
        else if (chartType === 'program') entityVal = String(r.program_name || 'Unknown').trim().toLowerCase();
        if (chartEntitySet.has(entityVal)) {
          scopedRunningRows.push(rowObj);
        }
      }
    }
    stmt.free();

    if (chartEntitySet.size > 0 && scopedRunningRows.length > 0 && scopedRunningRows.length < allRunningRows.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scopedRunningRows), 'Chart_Running_Raw_Data');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allRunningRows), 'All_Running_Raw_Data');
    } else {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(allRunningRows.length > 0 ? allRunningRows : [{ Note: 'No matching running batch records' }]),
        'Chart_Running_Raw_Data'
      );
    }
  } else if (mod === 'closed_batch') {
    const effectiveFilters: FilterParams = {
      ...filters,
      module: 'closed_batch',
      restrictDeepTech: true,
      batchStatus: 'complete',
    };
    const { where, params } = buildFilterWhere(effectiveFilters, { restrictDeepTech: true });

    const sql = `SELECT * FROM raw_records WHERE ${where} ORDER BY batch_code ASC, student_code ASC`;
    const stmt = db.prepare(sql);
    stmt.bind(params);

    const allClosedRows: any[] = [];
    const scopedClosedRows: any[] = [];

    while (stmt.step()) {
      const r = stmt.getAsObject() as any;
      const effectiveRm = getEffectiveRmForExport(r.rm_sh_zh, filters.programType);
      const rawBenAtt = r.beneficiary_class_attendance != null ? Number(r.beneficiary_class_attendance) : null;
      const benAttPct = rawBenAtt != null ? Number((rawBenAtt > 2.0 ? rawBenAtt : rawBenAtt * 100).toFixed(1)) : null;
      const rawRunAtt = r.running_attendance != null ? Number(r.running_attendance) : null;
      const runAttPct = rawRunAtt != null ? Number((rawRunAtt > 2.0 ? rawRunAtt : rawRunAtt * 100).toFixed(1)) : null;
      const rawIlt = r.ilt_completion != null ? Number(r.ilt_completion) : null;
      const iltPct = rawIlt != null ? Number((rawIlt > 2.0 ? rawIlt : rawIlt * 100).toFixed(1)) : null;

      const rowObj = {
        Effective_RM_Name: effectiveRm,
        Original_RM_SH_ZH: r.rm_sh_zh || 'Unassigned',
        Center_Code: r.center_code || 'Unknown',
        Program_Name: r.program_name || 'Unknown',
        Batch_Code: r.batch_code || '',
        Student_Code: r.student_code || '',
        Batch_Status: r.batch_status || '',
        Enrollment_Status: r.enrollment_status || '',
        Beneficiary_Class_Attendance_Pct: benAttPct,
        Running_Attendance_Pct: runAttPct,
        ILT_Completion_Pct: iltPct,
        Funder_Name: r.funder_name || '',
        Course_Code: r.course_code || '',
        Assigned_Trainers: r.assigned_trainers || '',
        Assigned_AE: r.assigned_ae || '',
        Batch_Start_Date: r.batch_start_date || '',
        Batch_Planned_End_Date: r.batch_end_date || '',
        Batch_Actual_End_Date: r.batch_actual_end_date || '',
      };

      allClosedRows.push(rowObj);

      if (chartEntitySet.size > 0) {
        let entityVal = '';
        if (chartType === 'rm') entityVal = effectiveRm.trim().toLowerCase();
        else if (chartType === 'center') entityVal = String(r.center_code || 'Unknown').trim().toLowerCase();
        else if (chartType === 'program') entityVal = String(r.program_name || 'Unknown').trim().toLowerCase();
        if (chartEntitySet.has(entityVal)) {
          scopedClosedRows.push(rowObj);
        }
      }
    }
    stmt.free();

    if (chartEntitySet.size > 0 && scopedClosedRows.length > 0 && scopedClosedRows.length < allClosedRows.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scopedClosedRows), 'Chart_Closed_Raw_Data');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allClosedRows), 'All_Closed_Raw_Data');
    } else {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(allClosedRows.length > 0 ? allClosedRows : [{ Note: 'No matching closed batch records' }]),
        'Chart_Closed_Raw_Data'
      );
    }
  }

  const safeTitle = String(req.chartTitle || `${mod}_${chartType}_raw_data`)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 60);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `${safeTitle || 'Chart_Raw_Data'}_${dateStamp}.xlsx`;

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return { buffer, fileName };
}


