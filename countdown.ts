// Release-Ziel: 18. Juli, 12:00 lokale Gerätezeit.
// Berechnet die nächste zukünftige Instanz dieses Datums.

export function getReleaseDate(now: Date = new Date()): Date {
  const y = now.getFullYear();
  const candidate = new Date(y, 6, 18, 12, 0, 0, 0); // Monat 6 = Juli
  if (candidate.getTime() <= now.getTime()) {
    return new Date(y + 1, 6, 18, 12, 0, 0, 0);
  }
  return candidate;
}

export interface CountdownParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

export function getCountdown(target: Date, now: Date = new Date()): CountdownParts {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const s = Math.floor(diff / 1000);
  return {
    totalMs: diff,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: false,
  };
}
