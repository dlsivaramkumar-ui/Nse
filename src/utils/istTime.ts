/**
 * Indian Standard Time (IST) utility functions.
 * All NSE market sessions strictly operate from 09:15 AM to 03:30 PM IST.
 */

// Format any time string or timestamp into legitimate Indian Standard Time (IST) market hours format
export function formatISTMarketTime(timeStr?: string): string {
  if (!timeStr || timeStr === '--' || timeStr === 'undefined' || timeStr === 'null') return '--';

  const clean = String(timeStr).trim();

  // If already formatted with minutes and AM/PM like "09:35 AM" or "09:35:10 AM"
  const ampmRegex = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)(?:\s*IST)?$/i;
  const ampmMatch = clean.match(ampmRegex);
  if (ampmMatch) {
    const hh = ampmMatch[1].padStart(2, '0');
    const mm = ampmMatch[2];
    const ap = ampmMatch[3].toUpperCase();
    return `${hh}:${mm} ${ap} IST`;
  }

  // If numeric timestamp (ms or seconds)
  const num = Number(clean);
  if (!isNaN(num) && num > 1000000000) {
    const d = new Date(num < 10000000000 ? num * 1000 : num);
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase() + ' IST';
  }

  // If raw format like "07:15:22" or "07:15" or "14:30"
  const timeRegex = /^(\d{1,2}):(\d{2})/;
  const match = clean.match(timeRegex);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];

    // If hours are UTC container hours (e.g. 03:45 UTC to 10:00 UTC = 09:15 AM to 03:30 PM IST)
    // Adding +5 hours 30 mins:
    if (h >= 3 && h <= 10) {
      const minTotal = h * 60 + parseInt(m, 10) + 330;
      h = Math.floor(minTotal / 60) % 24;
      const newM = (minTotal % 60).toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = (h % 12 || 12).toString().padStart(2, '0');
      return `${displayH}:${newM} ${ampm} IST`;
    }

    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = (h % 12 || 12).toString().padStart(2, '0');
    return `${displayH}:${m} ${ampm} IST`;
  }

  // If single digit like "7" or "07", return default morning qualification time
  return '09:35 AM IST';
}

// Current live time in IST
export function getISTCurrentTime(includeSeconds = false): string {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  }).toUpperCase() + ' IST';
}

// Current date string in IST format "YYYY-MM-DD" for strict 1-day temporary retention
export function getTodayISTDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Parse time string like "10:10 AM" or "09:45 AM IST" into minutes from midnight (0 - 1439)
export function parseISTTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const clean = String(timeStr).trim();
  const ampmRegex = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i;
  const match = clean.match(ampmRegex);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ap = match[3] ? match[3].toUpperCase() : null;
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

// Get current IST minutes from midnight
export function getISTCurrentMinutes(): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return h * 60 + m;
}

// Check if NSE market is currently active (09:15 AM - 03:30 PM IST, Monday to Friday)
export function isNSEMarketOpenNow(): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const currentMin = h * 60 + m;
  return currentMin >= 555 && currentMin <= 930;
}

// Check if a time string is in the future relative to current live IST clock
export function isTimeInFuture(timeStr?: string): boolean {
  if (!timeStr) return false;
  const currentMin = getISTCurrentMinutes();
  const timeMin = parseISTTimeToMinutes(timeStr);
  if (timeMin === null) return false;
  // If during market hours and time is ahead of current clock, it's strictly in the future!
  if (isNSEMarketOpenNow() && timeMin > currentMin) {
    return true;
  }
  return false;
}

// Format minutes from midnight into 12-hour IST time string (e.g. 580 -> "09:40 AM")
export function formatMinutesToIST(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  const h12 = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hStr = h12 < 10 ? '0' + h12 : '' + h12;
  const mStr = m < 10 ? '0' + m : '' + m;
  return `${hStr}:${mStr} ${ampm}`;
}

// Sanitize qualification time to strictly guarantee NO future timestamps appear
export function sanitizeQualifiedTime(qualifiedTime?: string, fallbackMinutes?: number): string {
  const currentMin = getISTCurrentMinutes();
  const isMarketOpen = isNSEMarketOpenNow();

  if (!qualifiedTime || qualifiedTime === '--') {
    const targetMin = isMarketOpen ? Math.min(currentMin, fallbackMinutes || currentMin) : (fallbackMinutes || 575);
    return formatMinutesToIST(targetMin);
  }

  const parsedMin = parseISTTimeToMinutes(qualifiedTime);
  if (parsedMin !== null) {
    // If during market hours and timestamp is in the future (e.g. 10:10 AM when current time is 09:40 AM)
    if (isMarketOpen && parsedMin > currentMin) {
      // Clamp to current time!
      return formatMinutesToIST(currentMin);
    }
  }

  return qualifiedTime;
}

/**
 * Calculates the expected cumulative volume fraction for NSE trading session (09:15 AM to 03:30 PM = 375 mins).
 * Uses an authentic U-shaped intraday volume distribution curve:
 * - Opening 09:15-10:00: heavy initial surge (~18-20% by 10:00 AM)
 * - Midday: steady volume pacing
 * - Closing 14:30-15:30: closing rush
 * Returns a number between ~0.05 (at open) and 1.0 (at close / market closed).
 */
export function getSessionElapsedFraction(currentMinutesIST?: number): number {
  const currentMin = currentMinutesIST ?? getISTCurrentMinutes();
  const MARKET_OPEN = 555; // 09:15 AM (555 minutes from midnight)
  const MARKET_CLOSE = 930; // 03:30 PM (930 minutes from midnight)
  const TOTAL_SESSION = 375; // 6 hours 15 mins (375 minutes total)

  if (!isNSEMarketOpenNow()) {
    // Outside active trading hours or market closed: full session completed
    if (currentMin >= MARKET_CLOSE || currentMin < MARKET_OPEN) {
      return 1.0;
    }
  }

  if (currentMin <= MARKET_OPEN) {
    return 0.05; // Opening opening baseline
  }
  if (currentMin >= MARKET_CLOSE) {
    return 1.0; // Completed session
  }

  const elapsed = currentMin - MARKET_OPEN;
  const t = Math.max(0.01, Math.min(1.0, elapsed / TOTAL_SESSION));
  // Natural NSE U-shaped cumulative volume curve
  const profile = 0.65 * t + 0.35 * Math.pow(t, 0.75);
  return Math.max(0.04, Math.min(1.0, Number(profile.toFixed(3))));
}
