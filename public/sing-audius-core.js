// Pure functions shared by the browser singing stage and its unit tests.
export function parseSingAlongLyrics(input) {
  const text = typeof input === 'string' ? input.slice(0, 8000) : '';
  const rows = text.split(/\r?\n/).map(row => row.trim()).filter(Boolean).slice(0, 120);
  const timed = rows.map(row => {
    const match = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.+)$/.exec(row);
    if (!match || Number(match[2]) >= 60) return null;
    const fraction = match[3] ? Number(match[3]) / (10 ** match[3].length) : 0;
    return { at: Number(match[1]) * 60 + Number(match[2]) + fraction, text: match[4].slice(0, 220) };
  });
  if (rows.length && timed.every(Boolean)) {
    return { timed: true, lines: timed.sort((a, b) => a.at - b.at) };
  }
  return {
    timed: false,
    lines: rows.map(row => ({ at: null, text: row.replace(/^\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*/, '').slice(0, 220) }))
  };
}

export function activeLyricIndex(parsed, seconds, duration, offset = 0) {
  const count = parsed?.lines?.length || 0;
  if (!count) return -1;
  const time = Math.max(0, Number(seconds) + Number(offset || 0));
  if (parsed.timed) {
    let result = -1;
    for (let i = 0; i < count; i++) {
      if (parsed.lines[i].at > time) break;
      result = i;
    }
    return result;
  }
  const length = Number(duration);
  if (!Number.isFinite(length) || length <= 0) return 0;
  return Math.min(count - 1, Math.floor(time / length * count));
}

export function duckTargetVolume(level, sensitivity, normalVolume, duckPercent) {
  const baseline = Math.max(0, Math.min(1, Number(normalVolume) || 0));
  const ratio = Math.max(0.1, Math.min(0.8, Number(duckPercent) / 100 || 0.3));
  return Number(level) >= Number(sensitivity) ? baseline * ratio : baseline;
}
