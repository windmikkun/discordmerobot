export interface JstDateRange {
  fromIso: string;
  toIso: string;
}

export function getTodayRangeJstIso(now: Date = new Date()): JstDateRange {
  // JSTはUTC+9
  const jstOffset = 9 * 60 * 60 * 1000; // 9時間をミリ秒で
  
  // 現在時刻をJSTに変換
  const jstNow = new Date(now.getTime() + jstOffset);
  
  // JST日の00:00を取得
  const jstTodayStart = new Date(
    jstNow.getFullYear(),
    jstNow.getMonth(),
    jstNow.getDate(),
    0,
    0,
    0,
    0
  );
  
  // JST日の翌日00:00を取得
  const jstTomorrowStart = new Date(jstTodayStart);
  jstTomorrowStart.setDate(jstTomorrowStart.getDate() + 1);
  
  // UTCに戻してISO文字列に変換
  const fromIso = new Date(jstTodayStart.getTime() - jstOffset).toISOString();
  const toIso = new Date(jstTomorrowStart.getTime() - jstOffset).toISOString();
  
  return { fromIso, toIso };
}
