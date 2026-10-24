/* LRC line-level caption timing used equally for preview and downloaded video. */
(function (root) {
  'use strict';
  function rows(value) {
    return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const match = /^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/.exec(line);
      if (!match || Number(match[2]) > 59 || !match[4].trim()) return { text: line, start: null };
      const decimals = match[3] ? Number('0.' + match[3]) : 0;
      return { text: match[4].trim(), start: Number(match[1]) * 60 + Number(match[2]) + decimals };
    });
  }
  function format(seconds) {
    const hundredths = Math.round(Math.max(0, seconds) * 100);
    return '[' + String(Math.floor(hundredths / 6000)).padStart(2,'0') + ':' +
      String(Math.floor(hundredths / 100)%60).padStart(2,'0') + '.' + String(hundredths%100).padStart(2,'0') + ']';
  }
  function isTimed(lines) {
    return lines.length > 0 && lines.every(line => Number.isFinite(line.start)) &&
      lines.every((line,index)=>index===0 || line.start>=lines[index-1].start);
  }
  function at(value,seconds,duration,delay=0,fallback='RhymeOrbit') {
    const lines = rows(value);
    if(!lines.length)return fallback;
    const localTime = seconds - delay;
    if (localTime<0)return fallback;
    if (isTimed(lines)) {
      if (localTime<lines[0].start)return fallback;
      for(let i=lines.length-1;i>=0;i--)if(localTime>=lines[i].start)return lines[i].text;
    }
    const ratio=Math.min(.999999,Math.max(0,localTime/Math.max(1,duration-delay)));
    return lines[Math.floor(ratio*lines.length)].text;
  }
  root.roLyricSync = { rows, isTimed, at, format };
})(window);
