
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
  // Use local offset to shift the time so toISOString returns the local date
  const offsetMs = d.getTimezoneOffset() * 60_000;
  const localDate = new Date(d.getTime() - offsetMs);
  return localDate.toISOString().split('T')[0];
};
