/**
 * BackgroundGPS.ts
 *
 * Configures and registers the background location tracking task using expo-task-manager and expo-location.
 * Runs in the background (even when the app is closed) to capture GPS coordinates.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { GPSLogsDAO } from '../database/GPSLogsDAO';

export const BACKGROUND_GPS_TASK_NAME = 'BACKGROUND_GPS_TRACKING_TASK';

// Define the background task at top-level
TaskManager.defineTask(BACKGROUND_GPS_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error(`[BackgroundGPS] Task error: ${error.message}`);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const location = locations[0];
      const { latitude, longitude } = location.coords;
      console.log(`[BackgroundGPS] Captured location: Lat ${latitude}, Lon ${longitude}`);
      
      try {
        // Save to database
        GPSLogsDAO.insertGPSLog(latitude, longitude);
      } catch (dbError) {
        console.error('[BackgroundGPS] Failed to write background GPS coordinates to db:', dbError);
      }
    }
  }
});

export class BackgroundGPS {
  /**
   * Starts background location capture at periodic intervals.
   * Runs hourly (timeInterval = 3600000 ms) or on significant location changes.
   */
  public static async startTracking(): Promise<boolean> {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_GPS_TASK_NAME);
      if (hasStarted) {
        console.log('[BackgroundGPS] Tracking is already active.');
        return true;
      }

      // Verify permission
      const { status } = await Location.getBackgroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[BackgroundGPS] Background location permission is not granted. Cannot start tracking.');
        return false;
      }

      await Location.startLocationUpdatesAsync(BACKGROUND_GPS_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        // Update hourly. Expo limits background battery usage, so this represents the desired frequency.
        timeInterval: 3600000, 
        distanceInterval: 50, // update if user moves 50 meters
        deferredUpdatesInterval: 3600000,
        foregroundService: {
          notificationTitle: 'SmartEdge GPS Active',
          notificationBody: 'Datalake 3.0 secure background location capture is running.',
          notificationColor: '#1A1D24',
        },
      });

      console.log('[BackgroundGPS] Background tracking task successfully started.');
      return true;
    } catch (error) {
      console.error('[BackgroundGPS] Failed to start background tracking:', error);
      return false;
    }
  }

  /**
   * Stops background location tracking.
   */
  public static async stopTracking(): Promise<void> {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_GPS_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_GPS_TASK_NAME);
        console.log('[BackgroundGPS] Background tracking task stopped.');
      }
    } catch (error) {
      console.error('[BackgroundGPS] Failed to stop background tracking:', error);
    }
  }

  /**
   * Returns tracking status.
   */
  public static async isTracking(): Promise<boolean> {
    try {
      return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_GPS_TASK_NAME);
    } catch (e) {
      return false;
    }
  }
}
