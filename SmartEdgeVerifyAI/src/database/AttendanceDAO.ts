/**
 * AttendanceDAO.ts
 *
 * Data Access Object for 'attendance_logs' table.
 * Coordinates marking IN/OUT, geo-tagging, duration arithmetic, and queue fetches.
 */

import { SQLiteClient } from './SQLiteClient';
import { WorkingHoursCalculator } from '../utils/WorkingHoursCalculator';
import { UUIDGenerator } from '../utils/UUIDGenerator';

export interface AttendanceLog {
  id: string;
  employee_id: string;
  date: string; // YYYY-MM-DD
  in_time: string; // HH:MM AM/PM
  out_time: string | null; // HH:MM AM/PM
  working_hours: string | null; // e.g. "8 hr 35 min"
  latitude: number;
  longitude: number;
  sync_status: number; // 0 = Pending, 1 = Synced
  retry_count: number;
  last_attempt: string | null;
}

export class AttendanceDAO {
  /**
   * Logs an IN check-in transaction.
   */
  public static markIN(employeeId: string, latitude: number, longitude: number): AttendanceLog {
    const db = SQLiteClient.getDb();
    const uuid = UUIDGenerator.generate();
    
    const now = new Date();
    const dateStr = this.formatDate(now);
    const timeStr = this.formatTime(now);

    const log: AttendanceLog = {
      id: uuid,
      employee_id: employeeId,
      date: dateStr,
      in_time: timeStr,
      out_time: null,
      working_hours: null,
      latitude,
      longitude,
      sync_status: 0,
      retry_count: 0,
      last_attempt: null,
    };

    db.runSync(
      `INSERT INTO attendance_logs (id, employee_id, date, in_time, out_time, working_hours, latitude, longitude, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0);`,
      [
        log.id,
        log.employee_id,
        log.date,
        log.in_time,
        log.out_time,
        log.working_hours,
        log.latitude,
        log.longitude
      ]
    );

    return log;
  }

  /**
   * Logs an OUT check-out transaction.
   * Finds the last active log for the employee that does not have an out_time.
   */
  public static markOUT(employeeId: string, latitude: number, longitude: number): AttendanceLog | null {
    const db = SQLiteClient.getDb();
    
    const lastRecord = db.getFirstSync<any>(
      `SELECT * FROM attendance_logs 
       WHERE employee_id = ? AND out_time IS NULL 
       ORDER BY date DESC, in_time DESC LIMIT 1;`,
      [employeeId]
    );

    if (!lastRecord) {
      console.warn(`No open IN record found for employee: ${employeeId}`);
      return null;
    }

    const now = new Date();
    const outTimeStr = this.formatTime(now);
    const workingHoursStr = WorkingHoursCalculator.calculate(lastRecord.in_time, outTimeStr);

    db.runSync(
      `UPDATE attendance_logs 
       SET out_time = ?, working_hours = ?, latitude = ?, longitude = ?, sync_status = 0 
       WHERE id = ?;`,
      [outTimeStr, workingHoursStr, latitude, longitude, lastRecord.id]
    );

    return {
      id: lastRecord.id,
      employee_id: lastRecord.employee_id,
      date: lastRecord.date,
      in_time: lastRecord.in_time,
      out_time: outTimeStr,
      working_hours: workingHoursStr,
      latitude,
      longitude,
      sync_status: 0,
      retry_count: lastRecord.retry_count,
      last_attempt: lastRecord.last_attempt,
    };
  }

  /**
   * Retrieves the current open attendance record for an employee.
   */
  public static getOpenRecord(employeeId: string): AttendanceLog | null {
    const db = SQLiteClient.getDb();
    const row = db.getFirstSync<any>(
      `SELECT * FROM attendance_logs 
       WHERE employee_id = ? AND out_time IS NULL 
       ORDER BY date DESC, in_time DESC LIMIT 1;`,
      [employeeId]
    );
    return row ? this.mapRow(row) : null;
  }

  /**
   * Retrieves all logs that have not yet been synced to AWS.
   */
  public static getUnsyncedLogs(): AttendanceLog[] {
    const db = SQLiteClient.getDb();
    const rows = db.getAllSync<any>(
      'SELECT * FROM attendance_logs WHERE sync_status = 0;'
    );
    return rows.map(r => this.mapRow(r));
  }

  /**
   * Retrieves all logs.
   */
  public static getAllLogs(): AttendanceLog[] {
    const db = SQLiteClient.getDb();
    const rows = db.getAllSync<any>(
      'SELECT * FROM attendance_logs ORDER BY date DESC, in_time DESC;'
    );
    return rows.map(r => this.mapRow(r));
  }

  /**
   * Marks a record as successfully uploaded.
   */
  public static markAsSynced(id: string): void {
    const db = SQLiteClient.getDb();
    db.runSync(
      'UPDATE attendance_logs SET sync_status = 1 WHERE id = ?;',
      [id]
    );
  }

  /**
   * Increments retry metadata on upload failures.
   */
  public static logFailure(id: string): void {
    const db = SQLiteClient.getDb();
    const nowStr = new Date().toISOString();
    db.runSync(
      `UPDATE attendance_logs 
       SET retry_count = retry_count + 1, last_attempt = ? 
       WHERE id = ?;`,
      [nowStr, id]
    );
  }

  private static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}-${month}-${year}`; // matching user format e.g. "09-06-2026"
  }

  private static formatTime(date: Date): string {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes} ${ampm}`;
  }

  private static mapRow(row: any): AttendanceLog {
    return {
      id: row.id,
      employee_id: row.employee_id,
      date: row.date,
      in_time: row.in_time,
      out_time: row.out_time,
      working_hours: row.working_hours,
      latitude: row.latitude,
      longitude: row.longitude,
      sync_status: row.sync_status,
      retry_count: row.retry_count,
      last_attempt: row.last_attempt,
    };
  }
}
