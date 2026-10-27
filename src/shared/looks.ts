import type { Look } from './types'

/** The looks an event can use. `liveView` is a cheap CSS approximation so guests pose for the look. */
export const LOOKS: { id: Look; label: string; description: string; liveView?: string }[] = [
  { id: 'colour', label: 'Colour', description: 'Natural colour, straight from the camera.' },
  {
    id: 'glam',
    label: 'Glam B&W',
    description: 'Hollywood black and white: smooth skin, soft contrast, bright highlights.',
    liveView: 'grayscale(1) contrast(0.92) brightness(1.08)'
  },
  { id: 'bw', label: 'Classic B&W', description: 'Crisp black and white with punchy contrast.', liveView: 'grayscale(1) contrast(1.15)' },
  { id: 'warm', label: 'Warm', description: 'Golden, flattering skin tones.', liveView: 'sepia(0.18) saturate(1.1)' },
  { id: 'vintage', label: 'Vintage', description: 'Faded film with soft blacks.', liveView: 'sepia(0.45) contrast(0.9) brightness(1.05)' }
]

export const lookInfo = (id: Look) => LOOKS.find((l) => l.id === id) ?? LOOKS[0]
