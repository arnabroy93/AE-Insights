import { getDb } from './db.ts';

export async function saveExceptionApprovalReport(report: any) {
  const db = await getDb();
  return db.run(`
    INSERT INTO Exception_App_Rpt (
      date, batch_code, student_code, student_name, center_code, center_name,
      reason, remarks, status, created_by, created_by_email, cm_name, cm_email,
      approval_remarks, approved_by, approved_by_email, approved_date,
      exception_remove_status, exception_remove_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    report.date, report.batch_code, report.student_code, report.student_name,
    report.center_code, report.center_name, report.reason, report.remarks,
    report.status, report.created_by, report.created_by_email, report.cm_name,
    report.cm_email, report.approval_remarks, report.approved_by,
    report.approved_by_email, report.approved_date,
    report.exception_remove_status, report.exception_remove_date
  ]);
}

export async function getExceptionApprovalReports() {
  const db = await getDb();
  return db.exec(`
    SELECT DISTINCT e.*
    FROM Exception_App_Rpt e
    INNER JOIN raw_records r ON LOWER(TRIM(COALESCE(e.student_code, ''))) = LOWER(TRIM(COALESCE(r.student_code, '')))
    ORDER BY e.id DESC
  `);
}
