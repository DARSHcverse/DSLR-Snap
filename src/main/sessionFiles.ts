import { dirname, join } from 'node:path'

// Files a finished session leaves next to its final design (final.jpg).
export const thumbPathFor = (compositePath: string) => join(dirname(compositePath), 'thumb.jpg')
/** The design in colour, when the event's look is a filter and "keep a colour version" is on. */
export const colourPathFor = (compositePath: string) => join(dirname(compositePath), 'final-colour.jpg')
export const gifPathFor = (compositePath: string) => join(dirname(compositePath), 'animation.gif')
export const boomerangPathFor = (compositePath: string) => join(dirname(compositePath), 'boomerang.gif')
