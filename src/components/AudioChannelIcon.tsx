import type { AudioChannelId } from '../core/audioSettings'

const bird = 'M5 16c-2-2-2-6 1-8 2-2 5-1 6 1l5 1-3 3c1 3-2 6-5 6H3l2-3Zm3-4 3 2M8 19v2m3-2v2'
const paths: Record<AudioChannelId, string> = {
  thunder: 'M5 12a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4 4 0 0 1 2 9M13 10l-5 7h4l-2 6 7-9h-5l1-4',
  wind: 'M3 8h12c4 0 4-5 1-5-2 0-3 1-3 2M3 12h16c4 0 4 5 1 5-2 0-3-1-3-2M3 16h7c3 0 3 5 0 5',
  rain: 'M5 12a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4 4 0 0 1 2 9H5Zm1 4-1 3m7-3-1 4m7-4-1 3',
  blackbird: bird, tit: bird, chaffinch: bird, sparrow: bird,
  cow: 'M6 7 3 3v5l3 2m12-3 3-4v5l-3 2M7 7h10l2 9-3 5H8l-3-5 2-9Zm1 9h8v4H8v-4M9 11h.01M15 11h.01',
  cat: 'M5 10V3l6 4h2l6-4v7a7 7 0 1 1-14 0Zm3 2h.01M16 12h.01m-5 3 1 1 1-1M2 14l5 1m-5 3 5-1m15-3-5 1m5 3-5-1',
  dog: 'M7 7c-2-5-5-3-5 1v5c0 3 3 3 4 0m11-6c2-5 5-3 5 1v5c0 3-3 3-4 0M7 7h10v10c0 6-10 6-10 0V7Zm2 5h.01M15 12h.01m-4 4 1 1 1-1',
  hen: 'M8 9c-2-2-2-4 0-5l2 2c0-5 3-5 3 0 3-3 5-1 3 2m0 0 5 3-5 2c1 4-2 8-6 8-5 0-8-5-5-9l3-3Zm1 3h.01m1 8v2m3-2v2',
  rooster: 'M8 8 5 4l4 1 1-3 3 3 3-1-1 5m0 0 6 3-6 2c1 5-2 8-6 8-5 0-7-5-4-9l3-4Zm1 3h.01m1 10v1m3-1v1',
  sheep: 'M6 8C2 8 2 3 6 3c1-3 4-3 6-1 2-2 5-2 6 1 4 0 4 5 0 5M7 8h10l1 7-3 6H9l-3-6 1-7Zm2 4h.01M15 12h.01m-4 4 1 1 1-1',
  goat: 'M8 7C4 7 4 2 6 2m10 5c4 0 4-5 2-5M7 8l-4 2 4 3m10-5 4 2-4 3M7 8h10v7l-5 5-5-5V8Zm3 11 2 3 2-3M9 12h.01M15 12h.01',
  horse: 'M8 8V2l4 5h5l3 9-3 5H8l-3-5 3-8Zm0 0-4 3-1 8M16 3l1 4M10 11h.01M16 16h.01m-7 2h6',
  donkey: 'M7 8 5 2c-1-3 3-3 4 0l2 6m2 0 2-6c1-3 5-3 4 0l-2 6M7 8h10l2 9-3 4H8l-3-4 2-9Zm2 4h.01M15 12h.01M8 17h8',
  duck: 'M13 8c-4-4-9 0-7 4l2 2c-5-1-6 1-5 4 2 5 13 5 16-1l-6-4 1-2 7-1-8-2Zm-5 1h.01m1 7 4 2',
  pig: 'M7 7 3 4l1 6m13-3 4-3-1 6M6 8c3-3 9-3 12 0 7 7 1 14-6 14S-1 15 6 8Zm2 7h8v5H8v-5m3 2h.01M13 17h.01M8 11h.01M16 11h.01',
}

export function AudioChannelIcon({ id }: { id: AudioChannelId }) {
  return <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[id]} /></svg>
}
