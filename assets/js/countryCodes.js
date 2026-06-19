/**
 * COUNTRY CALLING CODES
 * ---------------------------------------------------------------------
 * Used to populate the country-code dropdown next to Phone / WhatsApp
 * fields on the Members page. Sri Lanka (+94) is first in the list and
 * is the default selection, but admins can pick any other country.
 *
 * To add or remove a country, just edit this array — every other part
 * of the app (the dropdown, phone formatting, and parsing existing
 * numbers back into "code + number" when editing a member) reads from
 * this single list automatically.
 */
const COUNTRY_CODES = [
  { code: '+94', iso: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+1', iso: 'US', name: 'United States / Canada', flag: '🇺🇸' },
  { code: '+44', iso: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+91', iso: 'IN', name: 'India', flag: '🇮🇳' },
  { code: '+61', iso: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: '+971', iso: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+966', iso: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+974', iso: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: '+965', iso: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: '+973', iso: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: '+968', iso: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: '+852', iso: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: '+65', iso: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: '+60', iso: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+886', iso: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: '+82', iso: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: '+81', iso: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: '+86', iso: 'CN', name: 'China', flag: '🇨🇳' },
  { code: '+92', iso: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: '+880', iso: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: '+977', iso: 'NP', name: 'Nepal', flag: '🇳🇵' },
  { code: '+960', iso: 'MV', name: 'Maldives', flag: '🇲🇻' },
  { code: '+95', iso: 'MM', name: 'Myanmar', flag: '🇲🇲' },
  { code: '+66', iso: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: '+84', iso: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: '+63', iso: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: '+62', iso: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: '+64', iso: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: '+27', iso: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: '+254', iso: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: '+234', iso: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: '+20', iso: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: '+33', iso: 'FR', name: 'France', flag: '🇫🇷' },
  { code: '+49', iso: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: '+39', iso: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: '+34', iso: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: '+351', iso: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: '+31', iso: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+32', iso: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: '+41', iso: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+43', iso: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: '+46', iso: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: '+47', iso: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: '+45', iso: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: '+358', iso: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: '+353', iso: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: '+48', iso: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: '+30', iso: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: '+90', iso: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: '+7', iso: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: '+972', iso: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: '+55', iso: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: '+52', iso: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: '+54', iso: 'AR', name: 'Argentina', flag: '🇦🇷' }
];

/**
 * Returns the COUNTRY_CODES list sorted so the longest dial codes come
 * first. This makes "longest prefix wins" matching correct — e.g. so a
 * number starting with +971 matches the UAE entry rather than being
 * mistaken by a shorter, unrelated code.
 */
function getCountryCodesByLengthDesc() {
  return [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
}

/**
 * Splits a stored E.164-style number (e.g. "+447911123456") into its
 * country calling code and the remaining local digits, using the
 * longest matching code in COUNTRY_CODES. Falls back to the default
 * Sri Lankan code if nothing matches or the number is empty.
 */
function splitPhoneByCountryCode(value, defaultCode = '+94') {
  const str = String(value || '').trim();
  if (!str) return { code: defaultCode, number: '' };
  for (const entry of getCountryCodesByLengthDesc()) {
    if (str.indexOf(entry.code) === 0) {
      return { code: entry.code, number: str.substring(entry.code.length).replace(/[^\d]/g, '') };
    }
  }
  // No known prefix matched — strip a leading "+" and any non-digits
  // and just treat the whole thing as the local number.
  return { code: defaultCode, number: str.replace(/[^\d]/g, '') };
}

/** Populates a <select> element with every entry in COUNTRY_CODES. */
function populateCountryCodeSelect(selectEl, selectedCode = '+94') {
  if (!selectEl) return;
  selectEl.innerHTML = COUNTRY_CODES
    .map(c => `<option value="${c.code}" ${c.code === selectedCode ? 'selected' : ''}>${c.flag} ${c.code} ${c.name}</option>`)
    .join('');
  selectEl.value = selectedCode;
}
