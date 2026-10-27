import { PortraitMatter } from './portraitMatte'

/** The app's one AI cut-out model, set at start-up (main) or by tests. Absent = AI backgrounds unavailable. */
let matter: PortraitMatter | undefined

export function setPortraitModel(modelPath: string): PortraitMatter {
  matter = new PortraitMatter(modelPath)
  return matter
}

export function portraitMatter(): PortraitMatter | undefined {
  return matter?.available ? matter : undefined
}
