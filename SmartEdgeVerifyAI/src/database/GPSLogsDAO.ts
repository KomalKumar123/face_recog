/**
 * GPSLogsDAO.ts
 *
 * Data Access Object for 'gps_logs' table.
 * Manages insertions and retrieval of hourly background GPS points.
 */

import { SQLiteClient } from './SQLiteClient';
import { UUIDGenerator } from '../utils/UUIDGenerator';

export interface GPSLog {
  id: string;
  timestamp: string; // ISO DateTime
  latitude: number;
  longitude: number;
  sync_status: number;
  retry_count: number;
  last_attempt: string | null;
}

export class GPSLogsDAO {
  /**
   * Logs a GPS waypoint coordinates entry.
   */
  public static insertGPSLog(latitude: number, longitude: number): GPSLog {
    const db = SQLiteClient.getDb();
    const uuid = UUIDGenerator.generate();
    const nowStr = new Date().toISOString();

    const log: GPSLog = {
      id: uuid,
      timestamp: nowStr,
      latitude,
      longitude,
      sync_status: 0,
      retry_count: 0,
      last_attempt: null,
    };

    db.runSync(
      `INSERT INTO gps_logs (id, timestamp, latitude, longitude, sync_status) 
       VALUES (?, ?, ?, ?, 0);`,
      [log.id, log.timestamp, log.latitude, log.longitude]
    );

    return log;
  }

  /**
   * Retrieves all background GPS logs that are unsynced.
   */
  public static getUnsyncedLogs(): GPSLog[] {
    const db = SQLiteClient.getDb();
    const rows = db.getAllSync<any>(
      'SELECT * FROM gps_logs WHERE sync_status = 0;'
    );
    return rows.map(r => this.mapRow(r));
  }

  /**
   * Retrieves all background logs.
   */
  public static getAllLogs(): GPSLog[] {
    const db = SQLiteClient.getDb();
    const rows = db.getAllSync<any>(
      'SELECT * FROM gps_logs ORDER BY timestamp DESC;'
    );
    return rows.map(r => this.mapRow(r));
  }

  /**
   * Marks a log record as synced.
   */
  public static markAsSynced(id: string): void {
    const db = SQLiteClient.getDb();
    db.runSync(
      'UPDATE gps_logs SET sync_status = 1 WHERE id = ?;',
      [id]
    );
  }

  /**
   * Logs failure to sync.
   */
  public static logFailure(id: string): void {
    const db = SQLiteClient.getDb();
    const nowStr = new Date().toISOString();
    db.runSync(
      `UPDATE gps_logs 
       SET retry_count = retry_count + 1, last_attempt = ? 
       WHERE id = ?;`,
      [nowStr, id]
    );
  }

  private static mapRow(row: any): GPSLog {
    return {
      id: row.id,
      timestamp: row.timestamp,
      latitude: row.latitude,
      longitude: row.longitude,
      sync_status: row.sync_status,
      retry_count: row.retry_count,
      last_attempt: row.last_attempt,
    };
  }
}
