/**
 * StatusBadge.tsx
 *
 * Displays the current connectivity status (ONLINE / OFFLINE)
 * and the number of queued attendance/GPS logs waiting for synchronizations.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StatusBadgeProps {
  isOnline: boolean;
  pendingCount: number;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ isOnline, pendingCount }) => {
  return (
    <View style={styles.container}>
      {/* Network Badge */}
      <View style={[styles.badge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
        <View style={[styles.dot, isOnline ? styles.onlineDot : styles.offlineDot]} />
        <Text style={[styles.text, isOnline ? styles.onlineText : styles.offlineText]}>
          {isOnline ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
        </Text>
      </View>

      {/* Sync Queue Badge */}
      {pendingCount > 0 ? (
        <View style={[styles.badge, styles.queueBadge]}>
          <Text style={styles.queueText}>
            {pendingCount} {pendingCount === 1 ? 'Log' : 'Logs'} Pending Sync
          </Text>
        </View>
      ) : (
        <View style={[styles.badge, styles.syncedBadge]}>
          <Text style={styles.syncedText}>Synced</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  onlineBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  onlineDot: {
    backgroundColor: '#06B6D4',
  },
  onlineText: {
    color: '#06B6D4',
  },
  offlineBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  offlineDot: {
    backgroundColor: '#EF4444',
  },
  offlineText: {
    color: '#EF4444',
  },
  queueBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  queueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  syncedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  syncedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
});
