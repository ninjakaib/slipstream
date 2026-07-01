/**
 * A focused set of countries for the phone-number step, each with its dialing
 * code, flag, and the allowed national-number length range used for light
 * "country numbering rules" validation (no full libphonenumber dependency).
 */
export interface Country {
  /** ISO 3166-1 alpha-2 code. */
  code: string;
  name: string;
  dial: string;
  flag: string;
  /** [min, max] national significant number digit count. */
  nsn: [number, number];
}

export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸", nsn: [10, 10] },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦", nsn: [10, 10] },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧", nsn: [9, 10] },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺", nsn: [9, 9] },
  { code: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪", nsn: [7, 9] },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪", nsn: [10, 11] },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷", nsn: [9, 9] },
  { code: "ES", name: "Spain", dial: "+34", flag: "🇪🇸", nsn: [9, 9] },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹", nsn: [9, 10] },
  { code: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱", nsn: [9, 9] },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹", nsn: [9, 9] },
  { code: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪", nsn: [7, 9] },
  { code: "NO", name: "Norway", dial: "+47", flag: "🇳🇴", nsn: [8, 8] },
  { code: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭", nsn: [9, 9] },
  { code: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽", nsn: [10, 10] },
  { code: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷", nsn: [10, 11] },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷", nsn: [10, 11] },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳", nsn: [10, 10] },
  { code: "JP", name: "Japan", dial: "+81", flag: "🇯🇵", nsn: [10, 10] },
  { code: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷", nsn: [9, 10] },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳", nsn: [11, 11] },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬", nsn: [8, 8] },
  { code: "AE", name: "UAE", dial: "+971", flag: "🇦🇪", nsn: [9, 9] },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦", nsn: [9, 9] },
  { code: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿", nsn: [8, 10] },
];

/** Count just the digits in a free-form national number string. */
export function digitCount(national: string): number {
  return national.replace(/[^\d]/g, "").length;
}

/** True when the entered national number fits the country's length rules. */
export function isValidPhone(country: Country, national: string): boolean {
  const n = digitCount(national);
  return n >= country.nsn[0] && n <= country.nsn[1];
}
