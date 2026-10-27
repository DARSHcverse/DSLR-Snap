/** Green/blue screen keying, shared by the print pipeline and the live-view preview so they match. */
export type KeyColour = 'green' | 'blue'

export const KEY_SOFT = 18 // lean below this: fully the person
export const KEY_HARD = 60 // lean above this: fully the backdrop

/** 1 = person, 0 = backdrop. "Lean" is how much the key channel beats the other two. */
export function keyAlpha(r: number, g: number, b: number, key: KeyColour): number {
  const lean = key === 'green' ? g - Math.max(r, b) : b - Math.max(r, g)
  if (lean <= KEY_SOFT) return 1
  if (lean >= KEY_HARD) return 0
  return 1 - (lean - KEY_SOFT) / (KEY_HARD - KEY_SOFT)
}
