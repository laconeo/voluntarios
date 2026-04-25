
/**
 * Utility functions for consistent formatting across the application
 */

/**
 * Formats a date string into a short localized version: "lun 27-04"
 */
export const formatShiftDate = (dateStr: string): string => {
  if (!dateStr || dateStr === '-') return 'N/A';
  const date = new Date(dateStr + 'T12:00:00');
  const day = date.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  const dayNum = date.getDate().toString().padStart(2, '0');
  const monthNum = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day} ${dayNum}-${monthNum}`;
};

/**
 * Generates a consistent shift summary string for UI and WhatsApp
 * Format: "- [día] [fecha] [horario] - [Rol] ([cantidad] lugar/es)"
 */
export const formatShiftSummary = (
  dateStr: string, 
  timeSlot: string, 
  roleName: string, 
  vacancies?: number
): string => {
  const formattedDate = formatShiftDate(dateStr);
  const base = `- ${formattedDate} ${timeSlot} - ${roleName}`;
  
  if (vacancies !== undefined) {
    const label = vacancies === 1 ? 'lugar' : 'lugares';
    return `${base} (${vacancies} ${label})`;
  }
  
  return base;
};

/**
 * Formats a Date object or ISO string to YYYY-MM-DD in LOCAL timezone
 * Critical for regions like Argentina (UTC-3) to avoid "future day" issues
 * when using toISOString() which always uses UTC.
 */
export const toLocalDateStr = (dateInput: string | Date): string => {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  // Use local offset to shift the time so toISOString returns the local date
  const offsetMs = d.getTimezoneOffset() * 60_000;
  const localDate = new Date(d.getTime() - offsetMs);
  return localDate.toISOString().split('T')[0];
};

/**
 * Robust date parser for cross-browser compatibility (especially iOS Safari)
 * Handles Postgres timestamp strings with spaces and missing T/Z separators.
 */
export const parseSafeDate = (dateInput: string | null | undefined | Date): Date => {
  if (!dateInput) return new Date();
  
  // If it's already a Date object, return it
  if (dateInput instanceof Date) return dateInput;

  // Clean up: replace space with T for ISO compliance
  let s = String(dateInput).trim().replace(' ', 'T');
  
  // Safari can be picky about the milliseconds and timezone
  // If it has a space before the offset, remove it: "2024-01-01T12:00:00 +00" -> "2024-01-01T12:00:00+00"
  s = s.replace(/T(\d{2}:\d{2}:\d{2})\s+([\+\-])/, 'T$1$2');

  // Ensure Z if it looks like UTC but lacks it (Safari requirement)
  // Only add Z if there's no other timezone indicator (+ or -)
  if (!s.includes('Z') && !s.includes('+') && !/T.*[\+\-]\d{2}/.test(s) && s.length > 10) {
    s += 'Z';
  }
  
  const d = new Date(s);
  
  // Fallback for malformed strings
  if (isNaN(d.getTime())) {
    // Attempt manual extraction for YYYY-MM-DD HH:mm:ss format
    // Handles both T and space separators
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      const [_, y, m, dNum, hh, mm, ss] = match;
      // We assume UTC if it comes from the DB (standard behavior for this app)
      return new Date(Date.UTC(
        parseInt(y), 
        parseInt(m) - 1, 
        parseInt(dNum), 
        parseInt(hh), 
        parseInt(mm), 
        parseInt(ss)
      ));
    }
    return new Date();
  }
  
  return d;
};
