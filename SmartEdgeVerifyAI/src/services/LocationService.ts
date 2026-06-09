/**
 * LocationService.ts
 *
 * Manages foreground and background location permissions and fetches GPS coordinates.
 * Operates offline-first using satellite-based GPS locks and offers last-known/default fallbacks.
 */

import * as Location from 'expo-location';

export interface GPSCoordinate {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

// Default fallback coordinate (New Delhi / Center of Operations) if GPS is completely unavailable
const DEFAULT_COORDINATE: GPSCoordinate = {
  latitude: 28.6139,
  longitude: 77.2090,
  accuracy: null,
  timestamp: Date.now(),
};

export class LocationService {
  /**
   * Request location permissions from the user.
   */
  public static async requestPermissions(): Promise<boolean> {
    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.warn('[LocationService] Foreground location permission denied.');
        return false;
      }

      // Background permission is required for the hourly background tracking task.
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('[LocationService] Background location permission denied.');
        // We can still proceed if only foreground is granted, but background tasks will fail.
      }

      return fgStatus === 'granted';
    } catch (error) {
      console.error('[LocationService] Failed to request permissions:', error);
      return false;
    }
  }

  /**
   * Checks current permission status.
   */
  public static async checkPermissions(): Promise<boolean> {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      return fg.status === 'granted';
    } catch (e) {
      return false;
    }
  }

  /**
   * Obtains current GPS coordinates.
   * If GPS times out (e.g. deep indoors, offline), attempts to get last known position.
   * If that also fails, returns a default fallback.
   */
  public static async getCurrentLocation(): Promise<GPSCoordinate> {
    try {
      const hasPerm = await this.checkPermissions();
      if (!hasPerm) {
        console.warn('[LocationService] No permission. Returning fallback coordinate.');
        return DEFAULT_COORDINATE;
      }

      // Try fetching current location with high accuracy.
      // Timeout is set to 8 seconds to prevent hanging if indoors without cellular/wifi assist.
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 8000)
      );

      const result = await Promise.race([locationPromise, timeoutPromise]);

      if (result) {
        return {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
          timestamp: result.timestamp,
        };
      }

      console.warn('[LocationService] GPS getCurrentPositionAsync timed out. Falling back to last known.');
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        return {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
          accuracy: lastKnown.coords.accuracy,
          timestamp: lastKnown.timestamp,
        };
      }

      return DEFAULT_COORDINATE;
    } catch (error) {
      console.warn('[LocationService] Location fetch error, using fallback:', error);
      // Fallback
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          return {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            accuracy: lastKnown.coords.accuracy,
            timestamp: lastKnown.timestamp,
          };
        }
      } catch (innerError) {
        // Ignore
      }
      return DEFAULT_COORDINATE;
    }
  }
}
