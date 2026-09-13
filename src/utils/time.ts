const formatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function formatTime(value: string | null | undefined) { return value ? formatter.format(new Date(value)) : '未取得'; }

const clockFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
/** Wall clock in Japan Standard Time, down to the second. */
export function formatClock(value: number) { return clockFormatter.format(new Date(value)); }
