/**
 * UUIDGenerator.ts
 *
 * Implements a pure TypeScript RFC-4122 version 4 compliant UUID generator.
 * Provides unique identifiers for database records to prevent collisions, duplicate syncs,
 * and data loss during offline-to-online transactions.
 */

export class UUIDGenerator {
  /**
   * Generates a random RFC4122 v4 UUID string.
   */
  public static generate(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = (Math.random() * 16) | 0;
      const value = char === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }
}
