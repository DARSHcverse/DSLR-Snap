/**
 * Sample guest photos (Pexels, free to use) for the site's print mock-ups and backgrounds.
 * Each "session" is one group in front of the booth, so a strip or grid shows the same guests
 * across its frames, like a real print. `focus` keeps faces in frame when a photo is cropped.
 */
export interface SamplePhoto {
  src: string;
  focus: string;
}

const photo = (name: string, focus: string): SamplePhoto => ({ src: `/photos/${name}.webp`, focus });

export const SAMPLE_SESSIONS: SamplePhoto[][] = [
  [photo("friends-polaroid", "50% 30%"), photo("friends-polaroid-laugh", "55% 35%")],
  [photo("couple-heart-glasses", "55% 25%")],
  [photo("baby-shower-props", "50% 30%")],
  [photo("trio-vintage-cameras", "50% 35%")],
  [photo("friends-gold-backdrop", "40% 35%")],
];

/** Frame `i` of session `s`: alternates the session's photos and zooms in a little each frame, like a burst. */
export function sessionFrame(s: number, i: number): SamplePhoto & { zoom: number } {
  const set = SAMPLE_SESSIONS[((s % SAMPLE_SESSIONS.length) + SAMPLE_SESSIONS.length) % SAMPLE_SESSIONS.length];
  return { ...set[i % set.length], zoom: [1, 1.12, 1.25, 1.06][i % 4] };
}
