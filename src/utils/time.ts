const formatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function formatTime(value: string | null | undefined) { return value ? formatter.format(new Date(value)) : '未取得'; }
