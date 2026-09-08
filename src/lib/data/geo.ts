// Country / state / dial-code data, backed by `country-state-city`.
//
// Values are lowercased ISO codes so they stay compatible with the previously
// hand-rolled lists in src/lib/data/countries.ts and the per-page STATES maps,
// and with the `country` (max 4) / `state` (max 10) caps in
// src/lib/validation/profile.ts. Longest real subdivision code is 5 chars.
import { Country, State } from "country-state-city";

export type GeoOption = { value: string; label: string };

/**
 * The legacy country list shipped "uk" for the United Kingdom, but ISO 3166-1
 * (and this library) use "gb". Existing rows may hold either, so both directions
 * are mapped rather than migrating the data.
 */
const LEGACY_TO_ISO: Record<string, string> = { uk: "gb" };

/** Normalize a stored country value to the library's ISO alpha-2 code. */
export function toIsoCountry(value: string): string {
  const lower = value.trim().toLowerCase();
  return (LEGACY_TO_ISO[lower] ?? lower).toUpperCase();
}

export const COUNTRY_OPTIONS: GeoOption[] = Country.getAllCountries()
  .map((c) => ({ value: c.isoCode.toLowerCase(), label: c.name }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** Subdivisions for a country, or [] when the country has none / isn't selected. */
export function getStateOptions(country: string): GeoOption[] {
  if (!country) return [];
  return State.getStatesOfCountry(toIsoCountry(country))
    .map((s) => ({ value: s.isoCode.toLowerCase(), label: s.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Dial code for a country, e.g. "pk" -> "+92". Null when unknown. */
export function getDialCode(country: string): string | null {
  if (!country) return null;
  const found = Country.getCountryByCode(toIsoCountry(country));
  if (!found?.phonecode) return null;
  const code = found.phonecode.startsWith("+")
    ? found.phonecode
    : `+${found.phonecode}`;
  return code;
}

/** Emoji flag for a country, for the phone-code trigger. */
export function getFlag(country: string): string | null {
  if (!country) return null;
  return Country.getCountryByCode(toIsoCountry(country))?.flag ?? null;
}

/**
 * Every country as a dial-code choice. Several countries share a dial code
 * (+1 covers US/CA and the Caribbean), so entries are keyed by country ISO
 * rather than by dial code to keep Radix Select values unique.
 */
export type DialOption = {
  /** Country ISO alpha-2, lowercased — unique select value. */
  country: string;
  dialCode: string;
  flag: string;
  label: string;
};

export const DIAL_OPTIONS: DialOption[] = Country.getAllCountries()
  .filter((c) => Boolean(c.phonecode))
  .map((c) => {
    const dialCode = c.phonecode.startsWith("+") ? c.phonecode : `+${c.phonecode}`;
    return {
      country: c.isoCode.toLowerCase(),
      dialCode,
      flag: c.flag,
      label: `${c.name} ${dialCode}`,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));
