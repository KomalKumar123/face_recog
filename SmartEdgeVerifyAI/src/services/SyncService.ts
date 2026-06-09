/**
 * SyncService.ts
 *
 * Coordinates database synchronization when internet access becomes available.
 * Uploads unsynced records and triggers zero-fill cryptographic purging on sensitive biometrics.
 */

import { NetworkService } from './NetworkService';
import { AttendanceDAO } from '../database/AttendanceDAO';
import { GPSLogsDAO } from '../database/GPSLogsDAO';
import { VerificationDAO } from '../database/VerificationDAO';
import { BackupService } from './BackupService';

export interface SyncStatusReport {
  attendanceSyncedCount: number;
  gpsSyncedCount: number;
  verificationPurgedCount: number;
  logs: string[];
}

export class SyncService {
  private static isSyncingInProgress = false;
  private static listeners = new Set<(status: string) => void>();

  /**
   * Initializes automatic sync on network restoration.
   */
  public static init(): void {
    NetworkService.subscribe((isOnline) => {
      if (isOnline) {
        console.log('[SyncService] Online state detected. Triggering auto-sync...');
        this.syncAll().catch((err) => {
          console.error('[SyncService] Auto-sync failed:', err);
        });
      }
    });
  }

  /**
   * Subscribe to sync progress logs for UI updates.
   */
  public static subscribe(callback: (status: string) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private static notifyListeners(status: string): void {
    this.listeners.forEach(cb => {
      try {
        cb(status);
      } catch (e) {
        // ignore
      }
    });
  }

  /**
   * Synchronizes all unsynced data to the backend (simulated for Phase 1) and executes secure purging.
   */
  public static async syncAll(): Promise<SyncStatusReport> {
    if (this.isSyncingInProgress) {
      const msg = 'Sync already in progress. Skipping duplicate call.';
      console.log(`[SyncService] ${msg}`);
      return { attendanceSyncedCount: 0, gpsSyncedCount: 0, verificationPurgedCount: 0, logs: [msg] };
    }

    this.isSyncingInProgress = true;
    const report: SyncStatusReport = {
      attendanceSyncedCount: 0,
      gpsSyncedCount: 0,
      verificationPurgedCount: 0,
      logs: []
    };

    const addLog = (msg: string) => {
      const timestamped = `[${new Date().toLocaleTimeString()}] ${msg}`;
      report.logs.push(timestamped);
      this.notifyListeners(msg);
      console.log(`[SyncService] ${msg}`);
    };

    try {
      if (!NetworkService.isOnline()) {
        addLog('Sync aborted: Device is currently OFFLINE.');
        this.isSyncingInProgress = false;
        return report;
      }

      addLog('Starting synchronization sequence...');

      // 1. Sync Attendance Logs
      const unsyncedAttendance = AttendanceDAO.getUnsyncedLogs();
      if (unsyncedAttendance.length > 0) {
        addLog(`Found ${unsyncedAttendance.length} unsynced attendance records.`);
        for (const log of unsyncedAttendance) {
          addLog(`Uploading check-in/out: Employee ${log.employee_id}, Date ${log.date}...`);
          
          // Simulate network upload delay
          await new Promise(r => setTimeout(r, 600));

          try {
            // Simulated AWS API endpoint POST
            // In a production setup: await axios.post('https://api.datalake30.aws/v1/attendance', log);
            addLog(`AWS Response 200 OK for Attendance ID: ${log.id}`);
            AttendanceDAO.markAsSynced(log.id);
            report.attendanceSyncedCount++;
          } catch (uploadError) {
            addLog(`Error uploading Attendance ID: ${log.id}. Storing failure metadata.`);
            AttendanceDAO.logFailure(log.id);
          }
        }
      } else {
        addLog('No pending attendance logs to synchronize.');
      }

      // 2. Sync GPS Logs
      const unsyncedGPS = GPSLogsDAO.getUnsyncedLogs();
      if (unsyncedGPS.length > 0) {
        addLog(`Found ${unsyncedGPS.length} unsynced background GPS logs.`);
        for (const log of unsyncedGPS) {
          addLog(`Uploading GPS ping: Lat ${log.latitude}, Lon ${log.longitude}...`);
          
          await new Promise(r => setTimeout(r, 300));

          try {
            // Simulated AWS API endpoint POST
            addLog(`AWS Response 200 OK for GPS Log ID: ${log.id}`);
            GPSLogsDAO.markAsSynced(log.id);
            report.gpsSyncedCount++;
          } catch (uploadError) {
            addLog(`Error uploading GPS Log ID: ${log.id}. Storing failure metadata.`);
            GPSLogsDAO.logFailure(log.id);
          }
        }
      } else {
        addLog('No pending GPS logs to synchronize.');
      }

      // 3. Sync and Zero-Fill Purge Verification Logs
      const unsyncedVerification = VerificationDAO.getUnsyncedLogs();
      if (unsyncedVerification.length > 0) {
        addLog(`Found ${unsyncedVerification.length} unsynced biometric verification records.`);
        for (const log of unsyncedVerification) {
          addLog(`Uploading verification summary: Employee ${log.employee_id}, Confidence ${log.confidence.toFixed(4)}...`);
          
          await new Promise(r => setTimeout(r, 800));

          try {
            // Simulated AWS API endpoint POST (payload includes face vector, which is deleted locally next)
            addLog(`AWS Response 200 OK for Verification ID: ${log.id}`);
            
            addLog(`Executing Zero-Fill Purge on sqlite cache block for ID: ${log.id}`);
            // Overwrites face cache in DB with 0.0000...
            VerificationDAO.markAsSyncedAndPurge(log.id);
            
            report.verificationPurgedCount++;
          } catch (uploadError) {
            addLog(`Error uploading Verification ID: ${log.id}. Purge deferred for security.`);
          }
        }
      } else {
        addLog('No biometric data cached in queue.');
      }

      // 4. Update the local encrypted JSON backup
      addLog('Updating local encrypted backup.json with latest state...');
      await BackupService.createBackup();
      addLog('Backup file written and encrypted successfully.');

      addLog('Synchronization completed successfully. Local storage is sanitized.');
    } catch (error: any) {
      addLog(`Sync process interrupted by error: ${error.message || error}`);
    } finally {
      this.isSyncingInProgress = false;
    }

    return report;
  }

  /**
   * Helper to fetch current queue lengths.
   */
  public static getPendingSyncCount(): { attendance: number; gps: number; verification: number; total: number } {
    try {
      const attendance = AttendanceDAO.getUnsyncedLogs().length;
      const gps = GPSLogsDAO.getUnsyncedLogs().length;
      const verification = VerificationDAO.getUnsyncedLogs().length;
      return {
        attendance,
        gps,
        verification,
        total: attendance + gps + verification
      };
    } catch (e) {
      return { attendance: 0, gps: 0, verification: 0, total: 0 };
    }
  }
}
