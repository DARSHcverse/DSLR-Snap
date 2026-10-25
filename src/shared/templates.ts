import { canvasSize, stackedSlots } from './layout'
import type { Template } from './types'

const strip = canvasSize('2x6', 'portrait')
const portrait = canvasSize('4x6', 'portrait')
const landscape = canvasSize('4x6', 'landscape')

/** Templates that ship with the app. Operators can duplicate and edit them. */
export const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: 'classic-strip-3',
    name: 'Classic strip · 3 photos (2×6)',
    format: '2x6',
    orientation: 'portrait',
    background: '#ffffff',
    slots: stackedSlots(3, strip, { margin: 44, gap: 24, footer: 330 }),
    texts: [
      { text: '{event}', x: strip.w / 2, y: strip.h - 250, size: 46, color: '#1d1d1f', weight: 'bold', align: 'middle', fontFamily: 'Georgia, serif' },
      { text: '{date}', x: strip.w / 2, y: strip.h - 185, size: 28, color: '#6e6e73', align: 'middle' }
    ]
  },
  {
    id: 'strip-4-dark',
    name: 'Night strip · 4 photos (2×6)',
    format: '2x6',
    orientation: 'portrait',
    background: '#111111',
    slots: stackedSlots(4, strip, { margin: 40, gap: 18, footer: 240 }),
    texts: [
      { text: '{event}', x: strip.w / 2, y: strip.h - 150, size: 40, color: '#f5f5f7', weight: 'bold', align: 'middle' },
      { text: '{date}', x: strip.w / 2, y: strip.h - 98, size: 24, color: '#a1a1a6', align: 'middle' }
    ]
  },
  {
    id: 'portrait-single',
    name: 'Single portrait (4×6)',
    format: '4x6',
    orientation: 'portrait',
    background: '#ffffff',
    slots: [{ x: 60, y: 60, w: portrait.w - 120, h: portrait.h - 360 }],
    texts: [
      { text: '{event}', x: portrait.w / 2, y: portrait.h - 190, size: 64, color: '#1d1d1f', weight: 'bold', align: 'middle', fontFamily: 'Georgia, serif' },
      { text: '{date}', x: portrait.w / 2, y: portrait.h - 115, size: 34, color: '#6e6e73', align: 'middle' }
    ]
  },
  {
    id: 'portrait-grid-4',
    name: 'Grid · 4 photos (4×6 portrait)',
    format: '4x6',
    orientation: 'portrait',
    background: '#f7f3ee',
    slots: [
      { x: 60, y: 60, w: 549, h: 690 },
      { x: 639, y: 60, w: 549, h: 690 },
      { x: 60, y: 780, w: 549, h: 690 },
      { x: 639, y: 780, w: 549, h: 690 }
    ],
    texts: [
      { text: '{event}', x: portrait.w / 2, y: portrait.h - 230, size: 60, color: '#3a2f28', weight: 'bold', align: 'middle', fontFamily: 'Georgia, serif' },
      { text: '{date}', x: portrait.w / 2, y: portrait.h - 160, size: 32, color: '#8a7a6d', align: 'middle' }
    ]
  },
  {
    id: 'landscape-hero-3',
    name: 'Hero + 2 (4×6 landscape)',
    format: '4x6',
    orientation: 'landscape',
    background: '#ffffff',
    slots: [
      { x: 60, y: 60, w: 1140, h: 980 },
      { x: 1230, y: 60, w: 554, h: 475 },
      { x: 1230, y: 565, w: 554, h: 475 }
    ],
    texts: [
      { text: '{event}  ·  {date}', x: landscape.w / 2, y: landscape.h - 90, size: 46, color: '#1d1d1f', weight: 'bold', align: 'middle' }
    ]
  }
]
