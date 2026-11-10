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
  /** "How it works", in the order an operator does it. */
  steps: string[];
  faq: { q: string; a: string }[];
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
    steps: [
      "Plug the GoPro into the booth computer by USB. DSLR Snap finds it and shows a green tick on Home.",
      "Create a 360 event: pick the slow-motion style, add the overlay frame and a music track.",
      "Guests step on the platform. Start the spin from the screen, a foot pedal or your phone, and each guest scans a QR code for their video.",
    ],
    faq: [
      { q: "Which GoPro models work for 360 videos?", a: "GoPro HERO9, HERO10, HERO11 and HERO12, connected by USB. There's no pairing and no GoPro app; DSLR Snap finds the camera by itself and reconnects if the cable is unplugged." },
      { q: "Do I need internet for a 360 booth?", a: "No. Recording, slow motion, overlays and music all happen on the booth computer. Internet is only needed to upload videos for QR sharing, and uploads wait until there's a connection." },
      { q: "Is the 360 booth included in the plan?", a: "Yes. Every booth type, including 360, is in the one plan. Try it free first: every feature works in the trial, with a small watermark." },
    ],
  },
  {
    slug: "glam-booth-software",
    name: "Glam booth",
    title: "Glam Booth Software: Hollywood Black and White",
    description:
      "Glam booth software for Windows: Hollywood black and white, adjustable skin smoothing and soft contrast, with Canon or Nikon cameras and colour copies by QR.",
    intro: "The look clients book a glam booth for: soft, bright black and white with smooth skin, straight from your DSLR, on screen and in print.",
    points: [
      { title: "Hollywood B&W", body: "Soft contrast, lifted blacks and a gentle glow, tuned for flattering portraits." },
      { title: "Skin smoothing you control", body: "Off to strong. Eyes, hair and outlines stay sharp." },
      { title: "Guests pose for the look", body: "The live view shows black and white too, so people pose for the final photo." },
      { title: "Colour copy on request", body: "Print in B&W and let guests download both versions from the QR page." },
    ],
    hardware: "A Surface Pro or other Windows touch device, a Canon or Nikon camera, a flash and a DNP dye-sub printer.",
    steps: [
      "Connect a Canon or Nikon camera and a DNP printer by USB.",
      "Create a glam event and choose Hollywood black and white, then set skin smoothing from off to strong.",
      "Guests pose to a black and white live view and get their print in seconds, with a colour copy by QR if you turn it on.",
    ],
    faq: [
      { q: "Can guests get a colour version of a glam photo?", a: "Yes. Print in black and white and let guests download both the black and white and the colour version from their QR page." },
      { q: "Does skin smoothing blur the whole photo?", a: "No. You choose the strength, from off to strong, and eyes, hair and outlines stay sharp." },
      { q: "Which cameras work for a glam booth?", a: "Canon DSLR and mirrorless cameras, and Nikon Z mirrorless cameras (in beta), connected by USB. Add a flash or continuous light for the bright, soft glam look." },
    ],
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
    steps: [
      "Load the client's backgrounds into the event: logos, sponsor walls or scenes.",
      "Choose green screen, blue screen or AI backgrounds with no backdrop at all.",
      "Guests pick a background, see themselves on it live, and get a print and QR code with the background swapped in.",
    ],
    faq: [
      { q: "Can I do green screen photos without a green screen?", a: "Yes. AI backgrounds cut people out with no backdrop at all. A green or blue backdrop still gives the cleanest edges, for hair especially." },
      { q: "Does the AI background removal cost extra per photo?", a: "No. It runs on the booth computer, so there's no per-photo fee and no internet needed." },
      { q: "Can guests choose their own background?", a: "Yes. Add several backgrounds to the event and guests pick their favourite on the start screen, with a live preview before the countdown." },
    ],
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
    steps: [
      "Plug in a USB webcam and microphone, or a GoPro in webcam mode.",
      "Create a video guestbook event with your prompt for guests, such as a message for the couple.",
      "Guests record after a 3-2-1 countdown. Every message is saved as an MP4 and collected on one private page for the hosts.",
    ],
    faq: [
      { q: "How do the couple get all the video messages?", a: "Every message is collected on a private gallery page that the hosts can share with family. Each video is also saved as an MP4 in the event's folder on the booth computer." },
      { q: "What camera do I need for a video guestbook?", a: "Any USB webcam with a microphone, or a GoPro in webcam mode, on a Windows 10 or 11 computer." },
      { q: "Can guests watch their message back?", a: "Yes. Messages play back straight away, and guests can scan a QR code to keep their own copy." },
    ],
  },
  {
    slug: "free-photo-booth-software",
    name: "Free photo booth software",
    title: "Free Photo Booth Software for Windows",
    description:
      "Try DSLR Snap free on Windows with no time limit: DSLR photos, prints, 360, green screen and QR sharing. A small watermark until you choose a plan.",
    intro: "Download DSLR Snap and use every feature for free, for as long as you like. Photos carry a small watermark until you choose a plan, so you can test it at a real event first.",
    points: [
      { title: "Every feature, free", body: "Photo booth, glam, green screen, AI backgrounds, 360, video guestbook, GIFs and QR sharing all work in the free trial." },
      { title: "No time limit", body: "The trial doesn't run out. Set up your templates and practise with your camera and printer at your own pace." },
      { title: "No card to try", body: "Download and install; there's nothing to pay and no card to enter to start using it." },
      { title: "Remove the watermark in a minute", body: "When you're ready, choose a plan and sign in under Account in the app. The watermark goes, and everything you set up stays." },
    ],
    hardware: "A Windows 10 or 11 device (a touch screen works best), plus the camera and printer you already use.",
    steps: [
      "Download DSLR Snap for Windows and run the installer.",
      "Plug in your Canon or Nikon camera and DNP printer, or a webcam or GoPro.",
      "Create an event, pick a template and run a test session. Choose a plan when you want photos without the watermark.",
    ],
    faq: [
      { q: "Is DSLR Snap really free?", a: "The trial is free with no time limit and every feature works. Photos and videos carry a small watermark. Plans start at $14 a month billed yearly and remove the watermark." },
      { q: "What's the catch with the free trial?", a: "Only the watermark. There's no time limit, no feature locked and no card needed, so you can test it properly before paying." },
      { q: "Does the free version work offline?", a: "Yes. Photos, prints and AI backgrounds all work without internet. QR sharing needs a connection to upload, and queues until one is available." },
    ],
  },
  {
    slug: "surface-pro-photo-booth-software",
    name: "Surface Pro booth",
    title: "Surface Pro Photo Booth Software",
    description:
      "Photo booth software made for Surface Pro and Windows touch tablets: big touch screens, kiosk lock, Canon or Nikon DSLR, DNP printing and QR sharing.",
    intro: "A Surface Pro fits neatly in most booth shells. DSLR Snap is designed for touch from the first screen to the last, so guests use it without help.",
    points: [
      { title: "Made for touch", body: "Large buttons, a clear countdown and simple choices for guests, on a Surface Pro, Windows tablet or all-in-one touch PC." },
      { title: "Guests can't wander off", body: "The kiosk lock keeps guests on the booth screen. You control the booth from your phone or a foot pedal." },
      { title: "One cable to the camera", body: "Connect a Canon or Nikon camera, DNP printer and charger through a powered USB-C hub." },
      { title: "Checks itself before the doors open", body: "Home shows a green tick for the camera, printer, paper, storage and licence, and every problem comes with its fix." },
    ],
    hardware: "A Surface Pro (or other Windows 10 or 11 touch device), a powered USB-C hub, a Canon or Nikon camera and a DNP printer.",
    steps: [
      "Install DSLR Snap on the Surface Pro and set Windows to never sleep while plugged in.",
      "Connect the camera, printer and charger through a powered USB-C hub.",
      "Start the booth in kiosk mode and run it from the touch screen, your phone or a foot pedal.",
    ],
    faq: [
      { q: "Which Surface Pro do I need?", a: "Any Surface Pro or Windows tablet running Windows 10 or 11 64-bit. A newer model is faster for AI backgrounds and 360 videos." },
      { q: "Can I use a Windows laptop instead of a Surface?", a: "Yes. A laptop or mini PC works too; a touch monitor makes it easier for guests." },
      { q: "How do I stop the Surface going to sleep at an event?", a: "Set Windows to never sleep while plugged in and turn off USB selective suspend in Power Options. The user guide shows each step." },
    ],
  },
  {
    slug: "dslr-photo-booth-software",
    name: "Canon and Nikon DSLR",
    title: "DSLR Photo Booth Software for Canon and Nikon",
    description:
      "DSLR photo booth software for Windows that controls Canon and Nikon Z cameras over USB, with live view, saved camera settings, DNP prints and QR sharing.",
    intro: "Real DSLR quality, controlled from the booth screen. Plug in a Canon or Nikon camera and DNP printer and DSLR Snap finds both.",
    points: [
      { title: "Official camera SDKs", body: "Canon DSLR and mirrorless cameras through Canon's SDK, and Nikon Z cameras (in beta) through Nikon's." },
      { title: "Live view for guests", body: "Guests see themselves on screen before the countdown, so they pose for the final photo." },
      { title: "Camera settings saved", body: "Save your exposure settings as presets and switch between venues in a tap." },
      { title: "Prints in seconds", body: "4×6 prints and 2×6 strips on DNP dye-sub printers, cut automatically." },
    ],
    hardware: "A Windows 10 or 11 device, a Canon DSLR or mirrorless camera or a Nikon Z camera, a USB cable and a DNP printer.",
    steps: [
      "Set the camera to manual and turn off auto power off, then plug it in by USB.",
      "Close Canon EOS Utility or Nikon software, so DSLR Snap can control the camera.",
      "Check the green tick on Home, set exposure once, save it as a preset and start the booth.",
    ],
    faq: [
      { q: "Which Canon cameras work?", a: "Canon DSLR and mirrorless cameras supported by Canon's official SDK, connected by USB. Check the camera is on and EOS Utility is closed." },
      { q: "Which Nikon cameras work?", a: "Nikon Z-series mirrorless cameras, in beta: Z 30, Z 50, Z fc, Z 5, Z 6, Z 7, Z 8, Z 9, Zf and their II/III versions. Nikon D-series DSLRs are coming next." },
      { q: "Does it work with Sony cameras?", a: "Not yet. Sony is on the roadmap. Canon and Nikon Z cameras work today." },
    ],
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
