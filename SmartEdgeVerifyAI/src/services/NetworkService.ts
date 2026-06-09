/**
 * NetworkService.ts
 *
 * Real-time network monitoring service using NetInfo.
 * Detects offline-to-online state transitions and triggers synchronization events.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetworkChangeCallback = (isConnected: boolean) => void;

export class NetworkService {
  private static isConnectedToInternet = false;
  private static listeners = new Set<NetworkChangeCallback>();

  /**
   * Initializes connectivity monitoring.
   */
  public static init(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      const isCurrentlyConnected = !!state.isConnected && !!state.isInternetReachable;
      
      const transitionedToOnline = !this.isConnectedToInternet && isCurrentlyConnected;
      this.isConnectedToInternet = isCurrentlyConnected;

      console.log(`[NetworkService] State updated. Connected: ${isCurrentlyConnected}`);

      this.listeners.forEach((callback) => {
        try {
          callback(isCurrentlyConnected);
        } catch (e) {
          console.error('[NetworkService] Callback dispatch failure:', e);
        }
      });
    });
  }

  /**
   * Returns current connection state.
   */
  public static isOnline(): boolean {
    return this.isConnectedToInternet;
  }

  /**
   * Subscribes a listener to network connection updates.
   */
  public static subscribe(callback: NetworkChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}
