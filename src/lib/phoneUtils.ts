/**
 * Utility functions for international phone number formatting and WhatsApp URL generation.
 */

// Map of common country names (in Spanish/English) to WhatsApp calling prefixes.
export const COUNTRY_PREFIX_MAP: Record<string, string> = {
  // Latin America & North America
  'argentina': '549', // WhatsApp requirement for Argentina is 549 + area code + local number
  'chile': '56',
  'mexico': '52',
  'méxico': '52',
  'colombia': '57',
  'peru': '51',
  'perú': '51',
  'uruguay': '598',
  'paraguay': '595',
  'bolivia': '591',
  'ecuador': '593',
  'venezuela': '58',
  'costa rica': '506',
  'panama': '507',
  'panamá': '507',
  'guatemala': '502',
  'el salvador': '503',
  'honduras': '504',
  'nicaragua': '505',
  'dominicana': '1',
  'república dominicana': '1',
  'puerto rico': '1',
  'estados unidos': '1',
  'eeuu': '1',
  'usa': '1',
  'canada': '1',
  'canadá': '1',

  // Europe & Others
  'espana': '34',
  'españa': '34',
  'brasil': '55',
  'brazil': '55',
};

/**
 * Gets default fallback country prefix from env or default ('549' for Argentina fallback if unspecified).
 */
export const getDefaultCountryPrefix = (): string => {
  const envDefault = (import.meta as any).env?.VITE_DEFAULT_COUNTRY_CODE;
  if (envDefault) return String(envDefault).replace(/\D/g, '');
  return '549';
};

/**
 * Resolves a country name or code string to a numeric phone prefix string.
 */
export const resolveCountryPrefix = (countryOrPrefix?: string): string => {
  if (!countryOrPrefix) return getDefaultCountryPrefix();
  
  const clean = countryOrPrefix.trim().toLowerCase();
  
  // If it's already numeric (e.g., "56", "52", "549"), return it
  if (/^\d+$/.test(clean)) {
    return clean;
  }
  
  // Direct lookup in map
  if (COUNTRY_PREFIX_MAP[clean]) {
    return COUNTRY_PREFIX_MAP[clean];
  }

  // Partial match in map
  for (const [key, prefix] of Object.entries(COUNTRY_PREFIX_MAP)) {
    if (clean.includes(key) || key.includes(clean)) {
      return prefix;
    }
  }

  return getDefaultCountryPrefix();
};

/**
 * Formats a raw phone string into a clean digit string suitable for WhatsApp URLs.
 * 
 * Rules:
 * 1. If phone explicitly starts with '+', keeps international code digits.
 * 2. If phone is already long (>= 12 digits), keeps as-is.
 * 3. If phone is a local number (e.g. 10 digits or starts with '0'):
 *    - Strips leading '0' if present.
 *    - Resolves countryOrPrefix (e.g. event country or passed prefix) to attach the country code.
 *    - For Argentina ('549' or '54'), ensures '549' mobile prefix.
 */
export const cleanAndFormatWhatsAppPhone = (phoneInput?: string, countryOrPrefix?: string): string => {
  if (!phoneInput) return '';

  const trimmed = phoneInput.trim();
  const startsWithPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (!digits) return '';

  // Case 1: Phone explicitly started with '+'
  if (startsWithPlus) {
    return digits;
  }

  // Case 2: Phone already has 12 or more digits
  if (digits.length >= 12) {
    return digits;
  }

  const resolvedPrefix = resolveCountryPrefix(countryOrPrefix);

  // If local number starts with '0', remove leading '0'
  if (digits.startsWith('0') && digits.length >= 9) {
    digits = digits.substring(1);
  }

  // Check if digits already start with the resolved prefix
  if (digits.startsWith(resolvedPrefix) && digits.length >= resolvedPrefix.length + 8) {
    return digits;
  }

  // For Argentina specifically: WhatsApp requires 549 + area code + number
  if (resolvedPrefix === '549' || resolvedPrefix === '54') {
    if (digits.startsWith('549')) return digits;
    if (digits.startsWith('54')) return '549' + digits.substring(2);
    return '549' + digits;
  }

  // For other countries (e.g., Chile '56', Mexico '52', Colombia '57', USA '1')
  if (digits.startsWith(resolvedPrefix)) {
    return digits;
  }

  return resolvedPrefix + digits;
};

/**
 * Builds a valid WhatsApp URL (https://wa.me/...)
 */
export const getWhatsAppUrl = (phoneInput?: string, messageText?: string, countryOrPrefix?: string): string => {
  const formattedPhone = cleanAndFormatWhatsAppPhone(phoneInput, countryOrPrefix);
  const encodedText = messageText ? encodeURIComponent(messageText) : '';

  if (formattedPhone && formattedPhone.length >= 7) {
    return encodedText 
      ? `https://wa.me/${formattedPhone}?text=${encodedText}` 
      : `https://wa.me/${formattedPhone}`;
  }

  return encodedText 
    ? `https://wa.me/?text=${encodedText}` 
    : `https://wa.me/`;
};
