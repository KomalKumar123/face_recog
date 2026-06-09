/**
 * BackupService.ts
 *
 * Provides functions to export local SQLite data as an encrypted JSON backup file,
 * and restore it. Uses expo-file-system/legacy and EncryptionUtil.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { SQLiteClient } from '../database/SQLiteClient';
import { EncryptionUtil } from '../utils/EncryptionUtil';

const BACKUP_FILE_NAME = 'backup.enc';
const BACKUP_PATH = FileSystem.documentDirectory + BACKUP_FILE_NAME;

export interface BackupPayload {
  attendance_logs: any[];
  gps_logs: any[];
  verification_logs: any[];
  timestamp: string;
}

export class BackupService {
  /**
   * Generates a backup, encrypts it, and writes to local disk.
   */
  public static async createBackup(): Promise<string> {
    try {
      const db = SQLiteClient.getDb();

      // Retrieve all records from each table
      const attendance = db.getAllSync('SELECT * FROM attendance_logs;');
      const gps = db.getAllSync('SELECT * FROM gps_logs;');
      const verifications = db.getAllSync('SELECT * FROM verification_logs;');

      const payload: BackupPayload = {
        attendance_logs: attendance,
        gps_logs: gps,
        verification_logs: verifications.map((row: any) => {
          // BLOB needs to be handled carefully if serialized. We can store it as hex or base64.
          // In SQLite, verification_logs.face_embedding_cache is BLOB.
          // expo-sqlite returns Uint8Array or similar for BLOB in newer versions, or null.
          let hexEmbedding: string | null = null;
          if (row.face_embedding_cache) {
            const arr = new Uint8Array(row.face_embedding_cache);
            hexEmbedding = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
          }
          return {
            ...row,
            face_embedding_cache: hexEmbedding
          };
        }),
        timestamp: new Date().toISOString()
      };

      const plainText = JSON.stringify(payload);
      const encryptedText = await EncryptionUtil.encrypt(plainText);

      await FileSystem.writeAsStringAsync(BACKUP_PATH, encryptedText);
      console.log(`[BackupService] Backup successfully created at: ${BACKUP_PATH}`);
      return BACKUP_PATH;
    } catch (error) {
      console.error('[BackupService] Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Decrypts and restores backup file back into SQLite.
   */
  public static async restoreBackup(): Promise<boolean> {
    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(BACKUP_PATH);
      if (!fileInfo.exists) {
        console.warn(`[BackupService] No backup file found at: ${BACKUP_PATH}`);
        return false;
      }

      const encryptedText = await FileSystem.readAsStringAsync(BACKUP_PATH);
      const plainText = await EncryptionUtil.decrypt(encryptedText);
      const payload: BackupPayload = JSON.parse(plainText);

      const db = SQLiteClient.getDb();

      // We wrap the restore operations in a transaction for safety
      db.execSync('BEGIN TRANSACTION;');

      try {
        // Restore attendance_logs
        for (const log of payload.attendance_logs) {
          db.runSync(
            `INSERT OR REPLACE INTO attendance_logs (id, employee_id, date, in_time, out_time, working_hours, latitude, longitude, sync_status, retry_count, last_attempt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              log.id,
              log.employee_id,
              log.date,
              log.in_time,
              log.out_time,
              log.working_hours,
              log.latitude,
              log.longitude,
              log.sync_status,
              log.retry_count,
              log.last_attempt
            ]
          );
        }

        // Restore gps_logs
        for (const log of payload.gps_logs) {
          db.runSync(
            `INSERT OR REPLACE INTO gps_logs (id, timestamp, latitude, longitude, sync_status, retry_count, last_attempt)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [
              log.id,
              log.timestamp,
              log.latitude,
              log.longitude,
              log.sync_status,
              log.retry_count,
              log.last_attempt
            ]
          );
        }

        // Restore verification_logs
        for (const log of payload.verification_logs) {
          let embeddingBlob: Uint8Array | null = null;
          if (log.face_embedding_cache) {
            const hex = log.face_embedding_cache;
            const bytes = new Uint8Array(hex.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)));
            embeddingBlob = bytes;
          }
          db.runSync(
            `INSERT OR REPLACE INTO verification_logs (id, employee_id, confidence, liveness_pass, timestamp, synced, face_embedding_cache)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [
              log.id,
              log.employee_id,
              log.confidence,
              log.liveness_pass,
              log.timestamp,
              log.synced,
              embeddingBlob
            ]
          );
        }

        db.execSync('COMMIT;');
        console.log('[BackupService] Restore from backup completed successfully.');
        return true;
      } catch (innerError) {
        db.execSync('ROLLBACK;');
        console.error('[BackupService] Failed during SQL restore transactions:', innerError);
        throw innerError;
      }
    } catch (error) {
      console.error('[BackupService] Failed to restore backup:', error);
      throw error;
    }
  }

  /**
   * Returns backup metadata if a backup exists.
   */
  public static async getBackupInfo(): Promise<{ exists: boolean; size?: number; uri?: string }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(BACKUP_PATH);
      if (fileInfo.exists) {
        return {
          exists: true,
          size: fileInfo.size,
          uri: BACKUP_PATH
        };
      }
      return { exists: false };
    } catch (e) {
      return { exists: false };
    }
  }
}
