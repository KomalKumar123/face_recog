/**
 * SyncScreen.tsx
 *
 * Provides a status dashboard for database sync queues.
 * Allows manually triggering synchronization, viewing audit log streams,
 * verifying zero-fill cryptographical purges, and running encrypted backups.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { StatusBadge } from '../components/StatusBadge';

import { NetworkService } from '../services/NetworkService';
import { SyncService } from '../services/SyncService';
import { BackupService } from '../services/BackupService';

type SyncScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Sync'>;

interface Props {
  navigation: SyncScreenNavigationProp;
}

export const SyncScreen: React.FC<Props> = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(NetworkService.isOnline());
  const [queueStatus, setQueueStatus] = useState({ attendance: 0, gps: 0, verification: 0, total: 0 });
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Backup details state
  const [backupExists, setBackupExists] = useState(false);
  const [backupSize, setBackupSize] = useState<number | undefined>(undefined);

  useEffect(() => {
    // Initial fetch
    setIsOnline(NetworkService.isOnline());
    updateQueueDetails();
    checkBackupStatus();

    // Subscribe to updates
    const unsubNetwork = NetworkService.subscribe((online) => {
      setIsOnline(online);
    });

    const unsubSync = SyncService.subscribe((progressMsg) => {
      setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${progressMsg}`]);
      updateQueueDetails();
    });

    return () => {
      unsubNetwork();
      unsubSync();
    };
  }, []);

  const updateQueueDetails = () => {
    setQueueStatus(SyncService.getPendingSyncCount());
  };

  const checkBackupStatus = async () => {
    const info = await BackupService.getBackupInfo();
    setBackupExists(info.exists);
    setBackupSize(info.size);
  };

  const triggerManualSync = async () => {
    if (!isOnline) {
      Alert.alert('Device Offline', 'Please connect to the internet before synchronizing.');
      return;
    }

    setSyncing(true);
    setSyncLogs([`[${new Date().toLocaleTimeString()}] Starting manual sync...`]);
    
    try {
      const report = await SyncService.syncAll();
      setSyncLogs(report.logs);
      
      Alert.alert(
        'Synchronization Successful',
        `Attendance: ${report.attendanceSyncedCount} uploaded\nGPS Pings: ${report.gpsSyncedCount} uploaded\nEmbeddings Purged: ${report.verificationPurgedCount}`
      );
      
      updateQueueDetails();
      checkBackupStatus();
    } catch (e: any) {
      console.error(e);
      setSyncLogs(prev => [...prev, `[Error] ${e.message || e}`]);
      Alert.alert('Sync Interrupted', 'An error occurred during synchronization.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const path = await BackupService.createBackup();
      await checkBackupStatus();
      Alert.alert('Backup Created', `Encrypted backup saved to disk:\n${path.split('/').pop()}`);
    } catch (e) {
      Alert.alert('Backup Failed', 'Could not generate backup file.');
    }
  };

  const handleRestoreBackup = async () => {
    Alert.alert(
      'Confirm Restore',
      'This will import records from the encrypted backup file and merge them. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              const success = await BackupService.restoreBackup();
              if (success) {
                updateQueueDetails();
                Alert.alert('Restore Complete', 'Database entries updated from backup file.');
              } else {
                Alert.alert('No Backup Found', 'Create a backup first before restoring.');
              }
            } catch (e) {
              Alert.alert('Restore Failed', 'Failed to decrypt or parse backup.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Sync Control Center</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Connection status badge */}
        <StatusBadge isOnline={isOnline} pendingCount={queueStatus.total} />

        {/* Queues Breakdown Card */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardHeader}>PENDING DATA QUEUES</Text>
          
          <View style={styles.queueRow}>
            <Text style={styles.queueLabel}>Attendance Clock Logs</Text>
            <Text style={[styles.queueCount, queueStatus.attendance > 0 && styles.pendingColor]}>
              {queueStatus.attendance}
            </Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.queueRow}>
            <Text style={styles.queueLabel}>Background GPS Trackers</Text>
            <Text style={[styles.queueCount, queueStatus.gps > 0 && styles.pendingColor]}>
              {queueStatus.gps}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.queueRow}>
            <Text style={styles.queueLabel}>Biometric Embeddings Cache</Text>
            <Text style={[styles.queueCount, queueStatus.verification > 0 && styles.pendingColor]}>
              {queueStatus.verification}
            </Text>
          </View>
        </GlassCard>

        {/* Sync Trigger button */}
        <GradientButton
          title={syncing ? 'SYNCHRONIZING...' : 'SYNC ALL LOGS TO AWS'}
          onPress={triggerManualSync}
          disabled={syncing || queueStatus.total === 0}
          style={styles.syncBtn}
        />

        {/* Logs Console */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SYNC TERMINAL CONSOLE</Text>
        </View>

        <View style={styles.consoleWrapper}>
          <ScrollView
            style={styles.consoleScroll}
            nestedScrollEnabled={true}
            ref={(ref) => ref?.scrollToEnd({ animated: true })}
          >
            {syncLogs.length === 0 ? (
              <Text style={styles.consolePlaceholder}>Terminal idle. Awaiting sync trigger...</Text>
            ) : (
              syncLogs.map((log, index) => (
                <Text key={index} style={styles.consoleLog}>
                  {log}
                </Text>
              ))
            )}
          </ScrollView>
        </View>

        {/* Local Backup Card */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CRYPTOGRAPHIC OFFLINE BACKUPS</Text>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.backupHeader}>
            <Text style={styles.backupLabel}>Encrypted Backup (backup.enc):</Text>
            <Text style={[styles.backupStatus, backupExists ? styles.backupStatusActive : null]}>
              {backupExists ? 'AVAILABLE' : 'NOT FOUND'}
            </Text>
          </View>
          {backupExists && backupSize && (
            <Text style={styles.backupSize}>Size: {(backupSize / 1024).toFixed(2)} KB</Text>
          )}

          <View style={styles.backupRow}>
            <TouchableOpacity style={styles.backupBtn} onPress={handleCreateBackup}>
              <Text style={styles.backupBtnText}>Export Backup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backupBtn, !backupExists && styles.backupBtnDisabled]}
              onPress={handleRestoreBackup}
              disabled={!backupExists}
            >
              <Text style={[styles.backupBtnText, !backupExists && styles.backupBtnTextDisabled]}>
                Restore DB
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        <View style={styles.extraSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backButtonText: {
    color: '#6366F1',
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  spacer: {
    width: 60,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    width: '100%',
    marginBottom: 20,
  },
  cardHeader: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  queueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  queueLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  queueCount: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '800',
  },
  pendingColor: {
    color: '#F59E0B',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 10,
  },
  syncBtn: {
    width: '100%',
    marginBottom: 16,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  consoleWrapper: {
    height: 160,
    backgroundColor: '#050B14',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  consoleScroll: {
    flex: 1,
  },
  consolePlaceholder: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
  },
  consoleLog: {
    color: '#06B6D4', // cyan console text
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  backupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  backupLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  backupStatus: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  backupStatusActive: {
    color: '#10B981',
  },
  backupSize: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  backupRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  backupBtn: {
    flex: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  backupBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  backupBtnText: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '700',
  },
  backupBtnTextDisabled: {
    color: '#475569',
  },
  extraSpacing: {
    height: 40,
  },
});
