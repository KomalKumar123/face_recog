/**
 * DashboardScreen.tsx
 *
 * Core attendance punch card dashboard.
 * Fetches GPS coordinates upon Mark IN / Mark OUT.
 * Computes shift lengths and lists local database log records.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';

import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { StatusBadge } from '../components/StatusBadge';
import { AttendanceCard, AttendanceCardData } from '../components/AttendanceCard';

import { EmployeeDAO, Employee } from '../database/EmployeeDAO';
import { AttendanceDAO, AttendanceLog } from '../database/AttendanceDAO';
import { GPSLogsDAO, GPSLog } from '../database/GPSLogsDAO';
import { LocationService } from '../services/LocationService';
import { NetworkService } from '../services/NetworkService';
import { SyncService } from '../services/SyncService';

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Dashboard'>;
type DashboardScreenRouteProp = RouteProp<RootStackParamList, 'Dashboard'>;

interface Props {
  navigation: DashboardScreenNavigationProp;
  route: DashboardScreenRouteProp;
}

export const DashboardScreen: React.FC<Props> = ({ navigation, route }) => {
  const { employeeId } = route.params;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeRecord, setActiveRecord] = useState<AttendanceLog | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceLog[]>([]);
  const [recentGps, setRecentGps] = useState<GPSLog[]>([]);

  // Services state
  const [isOnline, setIsOnline] = useState(NetworkService.isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingLocation, setLoadingLocation] = useState(false);

  useEffect(() => {
    // Load employee profile
    const emp = EmployeeDAO.getEmployeeById(employeeId);
    setEmployee(emp);

    // Initial database pull
    refreshDatabaseLogs();

    // Subscribe to Network / Sync status changes
    const unsubNetwork = NetworkService.subscribe((online) => {
      setIsOnline(online);
    });

    const unsubSync = SyncService.subscribe(() => {
      refreshDatabaseLogs();
    });

    const interval = setInterval(() => {
      refreshDatabaseLogs();
    }, 4000);

    return () => {
      unsubNetwork();
      unsubSync();
      clearInterval(interval);
    };
  }, [employeeId]);

  const refreshDatabaseLogs = () => {
    try {
      const openRec = AttendanceDAO.getOpenRecord(employeeId);
      setActiveRecord(openRec);

      const allAttendance = AttendanceDAO.getAllLogs();
      setRecentAttendance(allAttendance.slice(0, 5)); // show top 5

      const allGps = GPSLogsDAO.getAllLogs();
      setRecentGps(allGps.slice(0, 5)); // show top 5

      setPendingCount(SyncService.getPendingSyncCount().total);
    } catch (e) {
      console.error('Error refreshing dashboard logs:', e);
    }
  };

  const handlePunchAction = async () => {
    setLoadingLocation(true);
    try {
      // 1. Request GPS Lock
      await LocationService.requestPermissions();
      const coords = await LocationService.getCurrentLocation();

      if (activeRecord) {
        // Mark OUT
        const updated = AttendanceDAO.markOUT(employeeId, coords.latitude, coords.longitude);
        if (updated) {
          Alert.alert(
            'Check-Out Registered',
            `Logged out at ${updated.out_time}.\nTotal hours: ${updated.working_hours}.`
          );
        }
      } else {
        // Mark IN
        const created = AttendanceDAO.markIN(employeeId, coords.latitude, coords.longitude);
        Alert.alert(
          'Check-In Registered',
          `Logged in at ${created.in_time}.\nSatellite Geotag: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
        );
      }

      // 2. Trigger auto sync in background if online
      if (NetworkService.isOnline()) {
        SyncService.syncAll().catch(err => console.log('Auto sync error:', err));
      }

      refreshDatabaseLogs();
    } catch (error) {
      console.error('Punch action failed:', error);
      Alert.alert('System Error', 'Could not record attendance. Please try again.');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleLogout = () => {
    navigation.replace('Login');
  };

  // Map SQLite log record format to Card rendering props
  const cardData: AttendanceCardData | null = activeRecord
    ? {
        date: activeRecord.date,
        inTime: activeRecord.in_time,
        outTime: activeRecord.out_time,
        workingHours: activeRecord.working_hours,
        latitude: activeRecord.latitude,
        longitude: activeRecord.longitude,
      }
    : recentAttendance.length > 0
    ? {
        date: recentAttendance[0].date,
        inTime: recentAttendance[0].in_time,
        outTime: recentAttendance[0].out_time,
        workingHours: recentAttendance[0].working_hours,
        latitude: recentAttendance[0].latitude,
        longitude: recentAttendance[0].longitude,
      }
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Main Container */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>WELCOME,</Text>
          <Text style={styles.empName}>{employee ? employee.name : 'Field Operator'}</Text>
        </View>
        <GradientButton
          title="Logout"
          onPress={handleLogout}
          colors={['#EF4444', '#DC2626']} // Red gradient for Logout
          style={styles.logoutBtn}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Network & Queue Indicator */}
        <StatusBadge isOnline={isOnline} pendingCount={pendingCount} />

        {/* Card containing current state or last checkout log */}
        <AttendanceCard data={cardData} />

        {/* Big Interactive Punch IN/OUT Button */}
        <GlassCard style={styles.punchSection}>
          {loadingLocation ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator size="large" color="#06B6D4" />
              <Text style={styles.loadingText}>LOCKING GPS SATELLITES...</Text>
            </View>
          ) : (
            <GradientButton
              title={activeRecord ? 'MARK SHIFT OUT' : 'MARK SHIFT IN'}
              onPress={handlePunchAction}
              colors={activeRecord ? (['#EF4444', '#F59E0B'] as const) : (['#06B6D4', '#3B82F6'] as const)}
              style={styles.punchBtn}
            />
          )}
          <Text style={styles.coordinatesHint}>
            Location tag will be appended automatically.
          </Text>
        </GlassCard>

        {/* Logs Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT PUNCH LOGS</Text>
        </View>

        {recentAttendance.length === 0 ? (
          <Text style={styles.emptyText}>No local logs saved on device.</Text>
        ) : (
          recentAttendance.map((log) => (
            <GlassCard key={log.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <Text style={styles.logDate}>{log.date}</Text>
                <View style={[styles.syncIndicator, log.sync_status === 1 ? styles.synced : styles.pending]}>
                  <Text style={styles.syncIndicatorText}>
                    {log.sync_status === 1 ? 'Synced' : 'Offline Pending'}
                  </Text>
                </View>
              </View>
              <Text style={styles.logTimes}>
                Punch: {log.in_time} → {log.out_time || 'Active'}
              </Text>
              {log.working_hours && (
                <Text style={styles.logHours}>Shift Duration: {log.working_hours}</Text>
              )}
            </GlassCard>
          ))
        )}

        {/* GPS Background Logs Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>BACKGROUND POSITION LOGS (1HR)</Text>
        </View>

        {recentGps.length === 0 ? (
          <Text style={styles.emptyText}>No background location history.</Text>
        ) : (
          recentGps.map((log) => (
            <GlassCard key={log.id} style={styles.gpsLogCard}>
              <Text style={styles.gpsTimestamp}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </Text>
              <Text style={styles.gpsCoords}>
                Lat: {log.latitude.toFixed(5)}, Lon: {log.longitude.toFixed(5)}
              </Text>
            </GlassCard>
          ))
        )}

        <View style={styles.extraSpacing} />
      </ScrollView>

      {/* Sync Control Center Float button */}
      <View style={styles.floatWrapper}>
        <GradientButton
          title="Open Sync Dashboard"
          onPress={() => navigation.navigate('Sync')}
          colors={['#6366F1', '#4F46E5']}
          style={styles.floatBtn}
        />
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  welcome: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  empName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  logoutBtn: {
    borderRadius: 8,
    minHeight: 32,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // space for floating sync button
  },
  punchSection: {
    alignItems: 'center',
    marginVertical: 20,
    padding: 20,
  },
  punchBtn: {
    width: '100%',
  },
  loadingWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  loadingText: {
    color: '#06B6D4',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 12,
  },
  coordinatesHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  emptyText: {
    color: '#475569',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 10,
  },
  logCard: {
    marginBottom: 10,
    padding: 14,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logDate: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  syncIndicator: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  synced: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  pending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  syncIndicatorText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  logTimes: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
  },
  logHours: {
    color: '#10B981',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
  },
  gpsLogCard: {
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gpsTimestamp: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  gpsCoords: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  extraSpacing: {
    height: 40,
  },
  floatWrapper: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  floatBtn: {
    width: '100%',
  },
});
