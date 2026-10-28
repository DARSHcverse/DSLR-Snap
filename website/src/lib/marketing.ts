import type { IconName } from "@/components/Icon";

// Marketing copy shared by the homepage, /features and the solution pages. Keep it true to the app:
// everything listed here is built.

export const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "camera",
    title: "Real DSLR quality",
    body: "Live view on screen, a countdown, then a proper shot from your Canon or Nikon. Set ISO, aperture, shutter and white balance, take test shots, and save it all per event.",
  },
  {
    icon: "printer",
    title: "Prints in seconds",
    body: "2×6 strips and 4×6 prints on DNP dye-sub printers, found automatically. A paper counter warns you before the roll runs out.",
  },
  {
    icon: "sliders",
    title: "Glam B&W and filters",
    body: "Hollywood black and white with adjustable skin smoothing, plus Classic B&W, Warm and Vintage. Guests can get the colour version too.",
  },
  {
    icon: "images",
    title: "Green screen and AI backgrounds",
    body: "Swap the backdrop for a client's branded background, with a green screen or with AI and no backdrop at all. Guests see it live and pick their favourite.",
  },
  {
    icon: "camera",
    title: "360 booth with GoPro",
    body: "Plug in a GoPro HERO9–12 and it's found automatically. Each spin becomes a slow-motion portrait video with your overlay and music.",
  },
  {
    icon: "qr",
    title: "Video guestbook",
    body: "Guests record a message for the couple with a webcam. Saved as MP4, shared by QR, and collected in one gallery for the host.",
  },
  {
    icon: "images",
    title: "GIFs and boomerangs",
    body: "Every session makes an animated GIF. Add a boomerang per event, saved as MP4 too, ready for Instagram and WhatsApp.",
  },
  {
    icon: "qr",
    title: "QR downloads and host gallery",
    body: "Guests scan for their photos and videos on their phone. The host gets one private page with every photo from the night.",
  },
  {
    icon: "offline",
    title: "Works without Wi-Fi",
    body: "Capture, design and printing all happen on the booth computer. Uploads wait and send when you're back online. Your licence works offline for 14 days.",
  },
  {
    icon: "layout",
    title: "Templates in minutes",
    body: "Start from built-in strip and 4×6 layouts, or import a design from Canva. DSLR Snap finds the photo windows for you.",
  },
  {
    icon: "lock",
    title: "Phone remote, pedal and kiosk lock",
    body: "Check the booth, pause it, reprint and start spins from your phone, or from a foot pedal. Guests can't leave the booth screen.",
  },
  {
    icon: "shield",
    title: "Ready before the doors open",
    body: "One home screen checks camera, printer, paper, storage and licence, and every problem comes with its fix.",
  },
];

export const FAQ = [
  {
    q: "What happens if my subscription lapses at an event?",
    a: "Nothing at the event. DSLR Snap checks your licence when it's online and keeps working offline for 14 days, so a venue without Wi-Fi never stops the booth. Renew within that time and nothing changes.",
  },
  {
    q: "Which cameras does DSLR Snap support?",
    a: "For photos, Canon DSLR and mirrorless cameras through Canon's official SDK, and Nikon Z-series mirrorless cameras (in beta) through Nikon's: Z 30, Z 50, Z fc, Z 5, Z 6, Z 7, Z 8, Z 9, Zf and their II/III versions. Nikon D-series DSLRs are coming next. Plug either in and DSLR Snap finds it. For 360 videos, a GoPro HERO9 to HERO12; for the video guestbook, any USB webcam. Sony is on the roadmap.",
  },
  {
    q: "Which printers work?",
    a: "DSLR Snap is built for DNP dye-sub printers such as the DS-RX1HS, for 4×6 prints and 2×6 strips, and finds the printer automatically. Mitsubishi and Citizen printers are on the roadmap.",
  },
  {
    q: "Do I need internet at the event?",
    a: "No. Taking photos, designing prints, printing and even AI backgrounds all work offline. Internet is only needed for QR downloads, and uploads queue up and send when a connection is available.",
  },
  {
    q: "Can I use a green screen, or do backgrounds without one?",
    a: "Both. Use a green or blue backdrop for the cleanest edges, or AI backgrounds that cut people out with no backdrop at all. Add the client's branded artwork and guests choose their favourite on screen.",
  },
  {
    q: "Does it do 360 videos?",
    a: "Yes. Plug a GoPro HERO9–12 into the booth computer by USB. DSLR Snap finds it, records each spin at 120 or 240 fps and makes a slow-motion portrait video with your overlay frame and music. Start spins from the screen, your phone or a foot pedal.",
  },
  {
    q: "What computer do I need?",
    a: "Any Windows 10 or 11 device, and a touch screen works best. A Surface Pro fits neatly in most booth shells, and Windows tablets, all-in-one touch PCs, or a laptop or mini PC with a touch monitor work just as well.",
  },
  {
    q: "Can I use my own designs?",
    a: "Yes. Make your design in Canva or any design tool, export it as a PNG with see-through photo windows, and import it. DSLR Snap finds the windows, and you can drag them to adjust.",
  },
  {
    q: "How many computers can I use?",
    a: "Each plan covers 2 booth computers. Extra computers are $50 a year each, added from your account.",
  },
];

/** Landing pages for what operators search for. Each maps to features that exist in the app. */
export const SOLUTIONS: {
  slug: string;
  name: string;
  title: string;
  description: string;
  intro: string;
  points: { title: string; body: string }[];
  hardware: string;
}[] = [
  {
    slug: "360-photo-booth-software",
    name: "360 photo booth",
    title: "360 Photo Booth Software for GoPro",
    description:
      "360 photo booth software for Windows: automatic GoPro HERO9–12 connection, 120/240 fps slow motion, speed ramps, overlays, music and QR sharing.",
    intro: "Plug a GoPro into the booth computer, step on the platform, spin. DSLR Snap does the rest: slow motion, your branding, music, and a QR code before the guest steps off.",
    points: [
      { title: "Finds the GoPro by itself", body: "HERO9 to HERO12 over USB, no pairing and no GoPro app. Unplug and replug and it reconnects." },
      { title: "Automatic speed ramp", body: "Normal speed, slow motion, normal again, from 120 or 240 fps clips. Portrait 1080×1920 for stories and reels." },
      { title: "Your overlay and music", body: "Add the event's frame and a track once; every video gets them, with the music fading out at the end." },
      { title: "Start it your way", body: "Tap Start, press a foot pedal, or start the spin from your phone while you work the arm." },
    ],
    hardware: "A Surface Pro or other Windows touch device, a 360 spinner platform and a GoPro HERO9–12 on a USB cable.",
  },
  {
    slug: "glam-booth-software",
    name: "Glam booth",
    title: "Glam Booth Software: Hollywood Black and White",
    description:
      "Glam photo booth software with Hollywood black and white, adjustable skin smoothing and soft contrast. Optional colour copies for guests. For Surface Pro and Windows touch devices, with Canon and Nikon cameras.",
    intro: "The look clients book a glam booth for: soft, bright black and white with smooth skin, straight from your DSLR, on screen and in print.",
    points: [
      { title: "Hollywood B&W", body: "Soft contrast, lifted blacks and a gentle glow, tuned for flattering portraits." },
      { title: "Skin smoothing you control", body: "Off to strong. Eyes, hair and outlines stay sharp." },
      { title: "Guests pose for the look", body: "The live view shows black and white too, so people pose for the final photo." },
      { title: "Colour copy on request", body: "Print in B&W and let guests download both versions from the QR page." },
    ],
    hardware: "A Surface Pro or other Windows touch device, a Canon or Nikon camera, a flash and a DNP dye-sub printer.",
  },
  {
    slug: "green-screen-photo-booth-software",
    name: "Green screen",
    title: "Green Screen Photo Booth Software with Branded Backgrounds",
    description:
      "Green screen and AI background photo booth software for Windows. Use the client's branded backgrounds, live preview, guest background picker, print and QR.",
    intro: "Corporate events want their brand in every photo. Load the client's backgrounds and DSLR Snap swaps them in, with or without a green screen.",
    points: [
      { title: "Green, blue or no backdrop", body: "Clean chroma key with spill removal, or AI that cuts people out with no backdrop at all." },
      { title: "Live preview", body: "Guests see themselves on the background before the countdown, with logos the right way round." },
      { title: "Guests choose", body: "Add several backgrounds and guests pick their favourite on the start screen." },
      { title: "Works offline", body: "The AI runs on the booth computer, so there's no per-photo cost and no internet needed." },
    ],
    hardware: "A Surface Pro or other Windows touch device, a Canon or Nikon camera, a DNP printer, and a green or blue backdrop if you want the cleanest edges.",
  },
  {
    slug: "video-guestbook-software",
    name: "Video guestbook",
    title: "Video Guestbook Software for Weddings and Events",
    description:
      "Video guestbook software for Windows: guests record messages with a webcam, saved as MP4, shared by QR and collected in a private gallery for the couple.",
    intro: "Guests leave a message for the couple in a few taps. Every video is saved, shared by QR and collected on one page for the hosts.",
    points: [
      { title: "Simple for guests", body: "A prompt, a 3-2-1 countdown, a timer and a Stop button. Messages play back straight away." },
      { title: "Phone-ready MP4", body: "Converted to MP4 with sound, up to 1080p, saved in the event's Videos folder." },
      { title: "One gallery for the couple", body: "Every message on a private page the hosts can share with family." },
      { title: "Any webcam", body: "Use any USB webcam and microphone, or a GoPro in webcam mode." },
    ],
    hardware: "A Surface Pro or other Windows touch device with a USB webcam and microphone.",
  },
];

/**
 * Comparison with dslrBooth (LumaBooth for Windows). Only facts checked on their public pricing page;
 * never claim they lack something we haven't verified. Re-check prices before changing `checked`.
 */
export const COMPARISON = {
  checked: "October 2026",
  rows: [
    { label: "Monthly plan", them: "$49.99/month", us: "$30/month" },
    { label: "Yearly plan", them: "$17/month ($204/year)", us: "$14/month ($168/year)" },
    { label: "Computers included", them: "2", us: "2" },
    { label: "Phone remote", them: "Included (Booth Copilot)", us: "Included" },
    { label: "Cloud gallery and QR", them: "Basic plan included", us: "Included, plus a host gallery page" },
    { label: "Free trial", them: "With watermark", us: "With watermark, no time limit" },
  ],
  /** Ours, stated without claims about theirs. */
  extras: [
    "Readiness check on the home screen: camera, printer, paper, storage and licence",
    "Paper counter that warns before the roll runs out",
    "Licence keeps working offline for 14 days",
    "Host gallery page with every photo from the event",
    "Start spins and sessions from a foot pedal",
  ],
};
