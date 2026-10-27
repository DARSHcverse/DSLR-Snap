import { layoutFromFinal } from './eventFolders'

// A finished session's other files, found from its final design (works for old and new layouts).
export const thumbPathFor = (compositePath: string) => layoutFromFinal(compositePath).thumb
/** The design in colour, when the event's look is a filter and "keep a colour version" is on. */
export const colourPathFor = (compositePath: string) => layoutFromFinal(compositePath).colour
export const gifPathFor = (compositePath: string) => layoutFromFinal(compositePath).gif
export const boomerangPathFor = (compositePath: string) => layoutFromFinal(compositePath).boomerang
export const boomerangVideoPathFor = (compositePath: string) => layoutFromFinal(compositePath).boomerangVideo
