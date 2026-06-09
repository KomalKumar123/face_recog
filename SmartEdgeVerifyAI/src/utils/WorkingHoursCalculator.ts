/**
 * WorkingHoursCalculator.ts
 *
 * Utility class to parse and calculate duration between check-in and check-out timestamps.
 * Returns durations formatted as "X hr Y min" to satisfy NHAI constraints.
 */

export class WorkingHoursCalculator {
  /**
   * Calculates hours and minutes between check-in and check-out.
   *
   * @param inTimeStr - e.g. "09:05 AM" or "09:05"
   * @param outTimeStr - e.g. "05:40 PM" or "17:40"
   * @returns Formatted duration string e.g. "8 hr 35 min"
   */
  public static calculate(inTimeStr: string, outTimeStr: string): string {
    try {
      const inMinutes = this.timeToMinutes(inTimeStr);
      const outMinutes = this.timeToMinutes(outTimeStr);

      let diff = outMinutes - inMinutes;
      if (diff < 0) {
        // Handle night shifts crossing midnight (24h loop)
        diff += 1440;
      }

      const hours = Math.floor(diff / 60);
      const minutes = diff % 60;

      return `${hours} hr ${minutes} min`;
    } catch (error) {
      console.warn('Error calculating working hours:', error);
      return '--';
    }
  }

  /**
   * Helper: Converts time strings (12h AM/PM or 24h formats) to minutes from midnight.
   */
  private static timeToMinutes(timeStr: string): number {
    const trimmed = timeStr.trim();
    
    // Check if time is 12h AM/PM format
    const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = parseInt(ampmMatch[2], 10);
      const period = ampmMatch[3].toUpperCase();

      if (period === 'PM' && hours < 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }

      return hours * 60 + minutes;
    }

    // Check if time is 24h format
    const militaryMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (militaryMatch) {
      const hours = parseInt(militaryMatch[1], 10);
      const minutes = parseInt(militaryMatch[2], 10);

      return hours * 60 + minutes;
    }

    throw new Error(`Invalid time format: ${timeStr}`);
  }
}
