/**
 * Volume and Relative Volume (RVOL) utilities for NSE Equities.
 * Provides accurate 3-Month Average Daily Volume (ADV) formatting and time-of-day normalized calculations.
 */

// Format volume with Indian market convention (Crores, Lakhs, Thousands)
export function formatIndianVolume(vol: number): string {
  if (!vol || vol <= 0) return '0';
  if (vol >= 10000000) {
    return `${(vol / 10000000).toFixed(2)} Cr`;
  }
  if (vol >= 100000) {
    return `${(vol / 100000).toFixed(2)} L`;
  }
  if (vol >= 1000) {
    return `${(vol / 1000).toFixed(1)}K`;
  }
  return vol.toLocaleString('en-IN');
}

// Format 3-Month Average Daily Volume (ADV) for compact tags & badges (e.g. "22.7K", "1.45 L", "1.20 Cr")
export function formatAdvShort(adv: number): string {
  if (!adv || adv <= 0) return '--';
  if (adv >= 10000000) {
    return `${(adv / 10000000).toFixed(2)} Cr`;
  }
  if (adv >= 100000) {
    return `${(adv / 100000).toFixed(2)} L`;
  }
  if (adv >= 1000) {
    return `${(adv / 1000).toFixed(1)}K`;
  }
  return adv.toLocaleString('en-IN');
}
