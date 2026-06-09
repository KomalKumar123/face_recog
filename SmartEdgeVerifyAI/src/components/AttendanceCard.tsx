/**
 * AttendanceCard.tsx
 *
 * Renders employee attendance details (IN Time, OUT Time, Working Hours, GPS Tag)
 * in a clear, formatted dashboard panel.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from './GlassCard';

export interface AttendanceCardData {
  date: string;
  inTime: string;
  outTime: string | null;
  workingHours: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface AttendanceCardProps {
  data: AttendanceCardData | null;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({ data }) => {
  if (!data) {
    return (
      <GlassCard style={styles.container}>
        <Text style={styles.placeholderText}>No attendance records for today.</Text>
      </GlassCard>
    );
  }

  const hasCheckedOut = !!data.outTime;

  return (
    <GlassCard style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.dateLabel}>SHIFT LOG - {data.date}</Text>
        <View style={[styles.statusIndicator, hasCheckedOut ? styles.inactiveIndicator : styles.activeIndicator]}>
          <Text style={styles.indicatorText}>{hasCheckedOut ? 'OUT' : 'ACTIVE IN'}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>PUNCH IN</Text>
          <Text style={styles.timeVal}>{data.inTime}</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>PUNCH OUT</Text>
          <Text style={styles.timeVal}>{data.outTime || '--:-- --'}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>TOTAL WORKING HOURS</Text>
          <Text style={[styles.hoursVal, !hasCheckedOut && styles.hoursValActive]}>
            {data.workingHours || (hasCheckedOut ? '0 hr 0 min' : 'Calculating...')}
          </Text>
        </View>
      </View>

      {data.latitude !== null && data.longitude !== null && (
        <>
          <View style={styles.divider} />
          <View style={styles.gpsRow}>
            <Text style={styles.gpsLabel}>GPS GEO-TAG:</Text>
            <Text style={styles.gpsVal}>
              {data.latitude.toFixed(6)}°, {data.longitude.toFixed(6)}°
            </Text>
          </View>
        </>
      )}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 18,
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statusIndicator: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activeIndicator: {
    backgroundColor: '#06B6D4',
  },
  inactiveIndicator: {
    backgroundColor: '#475569',
  },
  indicatorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    flex: 1,
  },
  label: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  timeVal: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  hoursVal: {
    color: '#10B981', // green for finalized hours
    fontSize: 22,
    fontWeight: '800',
  },
  hoursValActive: {
    color: '#06B6D4', // cyan for active/calculating hours
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 6,
  },
  gpsVal: {
    color: '#E2E8F0',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
