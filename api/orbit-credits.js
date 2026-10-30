/*
 * RhymeOrbit credit presentation contract.
 * One successful/reserved AI song = 100 Orbit Credits, regardless of tier.
 * This does not sell credits or grant paid entitlements; quota is enforced
 * atomically by Supabase ro_reserve_song and ro_finish_song.
 */
export const SONG_CREDIT_COST = 100;
export const PLAN_SONG_LIMITS = Object.freeze({free:3,premium:35,pro:75});
export function creditBalance(monthlyLimit,used,reserved){
 const safe=n=>Number.isFinite(n)&&n>=0?Math.floor(n):0;
 const limit=safe(monthlyLimit),consumed=safe(used),held=safe(reserved);
 const songsRemaining=Math.max(0,limit-consumed-held);
 return {
  creditCostPerSong:SONG_CREDIT_COST,
  creditBalance:{
   monthly:limit*SONG_CREDIT_COST,
   used:consumed*SONG_CREDIT_COST,
   reserved:held*SONG_CREDIT_COST,
   remaining:songsRemaining*SONG_CREDIT_COST
  },
  songsRemaining
 };
}
