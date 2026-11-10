import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ContentPage, Prose } from "@/components/ContentPage";
import { Icon } from "@/components/Icon";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "User Guide: Photo Booth Setup, Cameras and Printing",
  description:
    "How to set up DSLR Snap: install, connect a Canon or Nikon camera, flash settings, DNP printing with 2×6 cutting, templates, QR sharing, 360 and fixes.",
  path: "/guide",
});

/** Made from this page by scripts/make-guide-pdf.mjs; run it again after changing the guide. */
const GUIDE_PDF = "/dslr-snap-user-guide.pdf";

function Tip({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${warn ? "border-busy/40 bg-busy/10" : "border-accent/30 bg-accent/5"}`}>
      <strong>{warn ? "Watch out: " : "Tip: "}</strong>
      {children}
    </div>
  );
}

const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: "install",
    title: "1. Install and first start",
    body: (
      <>
        <ol className="ml-5 list-decimal space-y-2">
          <li>Download DSLR Snap from <Link href="/download">dslrsnap.com/download</Link> and run the installer. If Windows says &quot;Windows protected your PC&quot;, choose <strong>More info → Run anyway</strong>.</li>
          <li>On first start, choose <strong>where photos are saved</strong>. Each event gets its own folder there, with Photos, Prints, GIFs and Boomerangs inside, ready to hand to the client.</li>
          <li>Open the <strong>operator menu</strong>: tap the top-left corner of the booth screen five times quickly, or press <strong>Ctrl+Shift+A</strong>.</li>
          <li>Under <strong>Printer &amp; devices → Operator PIN</strong>, set a 4 to 8 digit PIN so guests can&apos;t leave the booth screen.</li>
          <li>Under <strong>Account</strong>, press Sign in to connect your plan (this removes the watermark) and the cloud gallery for QR downloads.</li>
        </ol>
        <Tip>On a Surface or laptop, set Windows to never sleep while plugged in and turn off USB selective suspend (Control Panel → Power Options → Advanced). Use a powered USB-C hub for the camera, printer and charger.</Tip>
      </>
    ),
  },
  {
    id: "camera",
    title: "2. Connect your camera",
    body: (
      <>
        <p>DSLR Snap controls Canon cameras (and Nikon in beta) over USB. Before you plug in, set the camera like this:</p>
        <ul>
          <li>Mode dial on <strong>M</strong> (manual), so DSLR Snap can set the exposure.</li>
          <li>Image quality <strong>JPEG only</strong> (no RAW): it&apos;s much faster.</li>
          <li><strong>Auto power off: disabled</strong>, and ideally a mains dummy battery: batteries die mid-event.</li>
          <li>Autofocus on, with the lens switch on AF.</li>
          <li>Close Canon EOS Utility or Nikon software: they hold on to the camera.</li>
        </ul>
        <p>Plug the camera into the computer by USB and switch it on. The <strong>Camera</strong> dot in the operator menu turns green and live view appears. If you unplug it, it reconnects by itself when you plug it back in.</p>
      </>
    ),
  },
  {
    id: "exposure",
    title: "3. Camera and flash settings",
    body: (
      <>
        <p>Open <strong>Camera</strong> in the operator menu (or the Camera step when setting up an event). Your flash sets most of the brightness; the camera settings decide how much room light you keep.</p>
        <ol className="ml-5 list-decimal space-y-2">
          <li>Start from a built-in setting: <strong>Standard</strong> (most indoor events), <strong>Bright room</strong>, <strong>Dark venue</strong> or <strong>Outdoors</strong>.</li>
          <li>Press <strong>Take test shot</strong>. The histogram and the message say whether it&apos;s too dark, too bright or good. Tap the photo to check focus.</li>
          <li>Adjust with the ◀ ▶ arrows: <strong>ISO</strong> brighter or darker; <strong>Aperture</strong> f/5.6–8 keeps a whole group sharp; <strong>Shutter</strong> slower keeps more room light.</li>
          <li>Happy with it? Press <strong>＋ Save current settings as mine</strong> and give it a name, like &quot;Speedlite ¼ power, ballroom&quot;. It appears under <strong>My settings</strong> for every future event. Signed in under Account, your saved settings also appear on your other booth computers. Saving the same name again updates it; × deletes it.</li>
        </ol>
        <p>Settings are saved with the event and put back on the camera when the event starts and whenever the camera reconnects.</p>
        <Tip warn>Shutter speeds faster than the flash can sync (about 1/200) aren&apos;t offered: they&apos;d leave a dark band across the photo. With flash, live view can&apos;t show the final brightness, so always take a test shot.</Tip>
      </>
    ),
  },
  {
    id: "printer",
    title: "4. Printer setup (DNP) and 2×6 strips",
    body: (
      <>
        <ol className="ml-5 list-decimal space-y-2">
          <li>Install DNP&apos;s official Windows driver for your printer (for example the DS-RX1HS), then plug the printer in by USB and switch it on.</li>
          <li>DSLR Snap finds it by itself, whatever Windows named it. <strong>Printer &amp; devices → Printer</strong> shows which printer it uses.</li>
          <li>Press <strong>Test print 4×6</strong>. The red border should be just trimmed and the blue dashed box fully visible: that means correct size, no white edges.</li>
        </ol>
        <h3>Cutting 2×6 strips</h3>
        <p>Strips are printed two to a 4×6 sheet and cut by the printer. Windows can&apos;t switch the DNP cut on and off per print, so DSLR Snap uses a second printer entry with the cut always on. You set it up once:</p>
        <ol className="ml-5 list-decimal space-y-2">
          <li>Go to <strong>Printer &amp; devices → Printer → Set up automatic 2×6 cutting</strong> (the same button appears in an event&apos;s Print step). Allow the Windows prompt if it appears.</li>
          <li>If it says <strong>Done</strong>, you&apos;re set. If DNP&apos;s Printing Preferences open instead, set <strong>2inch cut</strong> to ON (under Advanced or Options), press OK, and DSLR Snap comes back.</li>
          <li>Press <strong>Test print 2×6</strong>: it should come out cut into two strips, exactly on the line. 4×6 prints stay uncut.</li>
        </ol>
        <p>When you set up an event, the <strong>Print &amp; share</strong> step lets you choose <strong>4×6 postcard</strong> (uncut) or <strong>2×6 strips</strong> (cut). Choosing a size switches to a template of that size.</p>
        <h3>Paper and the print queue</h3>
        <ul>
          <li>Set how many prints the roll has left under <strong>Printer &amp; devices → Paper</strong>; the booth warns you before it runs out. Signed in, you also get an <strong>email at 50 and 15 prints left</strong>, so it reaches your phone.</li>
          <li>If the printer runs out of paper or the door is open, the job shows <strong>Failed</strong>. Fix the printer, then press <strong>Retry</strong> in the <strong>Print queue</strong>. Nothing is printed twice.</li>
        </ul>
        <Tip>Strips coming out uncut? The event is using the plain entry: run Set up automatic 2×6 cutting again, or check that 2inch cut is ON in the &quot;(2x6 cut)&quot; printer&apos;s preferences.</Tip>
      </>
    ),
  },
  {
    id: "events",
    title: "5. Create an event",
    body: (
      <>
        <p>Go to <strong>Events → + New event</strong>. Six steps, each saved as you go:</p>
        <ol className="ml-5 list-decimal space-y-2">
          <li><strong>Event</strong>: name, date and booth type (photo booth, 360 booth or video guestbook), number of photos and countdown.</li>
          <li><strong>Template</strong>: the print design, 4×6 or 2×6.</li>
          <li><strong>Look</strong>: Colour, Glam (with skin smoothing), Classic B&amp;W, Warm or Vintage. Optionally a colour copy as well.</li>
          <li><strong>Camera</strong>: settings and test shots for this venue (see section 3).</li>
          <li><strong>Print &amp; share</strong>: print size, copies per session, automatic printing, QR downloads and the on-screen gallery.</li>
          <li><strong>Test &amp; launch</strong>: a checklist of camera, printer and QR. Fix anything red, then launch.</li>
        </ol>
        <Tip>Doing a similar event next week? Duplicate an existing event instead of starting again.</Tip>
      </>
    ),
  },
  {
    id: "templates",
    title: "6. Templates (design in Canva)",
    body: (
      <>
        <ol className="ml-5 list-decimal space-y-2">
          <li>Design your print in Canva (or any design app) at 4×6 or 2×6, and leave <strong>see-through windows</strong> where the photos go.</li>
          <li>Download it as a <strong>PNG with a transparent background</strong>.</li>
          <li>In <strong>Templates</strong>, drop the PNG in. DSLR Snap finds each photo window automatically; drag to fine-tune. The preview matches the print.</li>
        </ol>
        <h3>Changing a template later</h3>
        <ul>
          <li>Press <strong>Edit</strong> on any template, in Templates or in the event&apos;s Template step. Built-in templates have <strong>Duplicate &amp; edit</strong>: your changes are saved as your own copy.</li>
          <li>Add <strong>text</strong> (Event name, Date, Time or a #Hashtag), drag it into place and choose its font, colour and size.</li>
          <li>Tick <strong>Print each guest&apos;s QR code</strong> to put a scannable link to their photos on the print (QR downloads must be on for the event).</li>
          <li><strong>Centre</strong>, <strong>Space evenly</strong> and <strong>Make all same size</strong> tidy the photos; the dashed <strong>safe area</strong> shows where the printer may trim. Undo with Ctrl+Z.</li>
          <li>If other events use the template, the editor says so; <strong>Save as a copy</strong> leaves them unchanged.</li>
        </ul>
      </>
    ),
  },
  {
    id: "running",
    title: "7. Running the booth",
    body: (
      <ul>
        <li>Press <strong>▶ Start booth</strong>. With <strong>Booth lock</strong> on, the booth covers the taskbar and ignores close shortcuts; leave through the operator menu and its PIN.</li>
        <li>Guests tap <strong>Start</strong>, get a countdown for each photo, then see their print and (if on) a QR code.</li>
        <li><strong>Ending a session early</strong>: guests can press <strong>✕ End</strong> (bottom-left) during their photos; nothing prints. You can also hold the foot pedal down for a second and a half or press End on the phone remote. For walk-aways, turn on <strong>Only print when the guest taps Print</strong> in the event&apos;s Print &amp; share step.</li>
        <li><strong>Foot pedal or clicker</strong>: under Printer &amp; devices, press <strong>Learn key</strong> and press your pedal once.</li>
        <li><strong>Phone remote</strong>: tick &quot;Control the booth from my phone&quot; and scan the QR. Allow the Windows firewall prompt on private networks.</li>
        <li><strong>Photos &amp; stats</strong> shows every session (and how many ended early); the event folder holds the full-size files to give the client.</li>
        <li><strong>Two booths?</strong> On the first computer, open <strong>Account → Save this computer&apos;s setup</strong>; on the second, <strong>Copy setup to this computer</strong>. Templates, booth lock, pedal key and (if you choose) the PIN come across.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "8. QR downloads and the cloud gallery",
    body: (
      <>
        <p>Signed in under Account with QR downloads on, each guest gets a QR code to download their photos. If the venue has no internet, the booth keeps a queue and uploads later; the QR links work once the photos are up.</p>
        <p>At <Link href="/account/events">dslrsnap.com/account/events</Link> you see every event: share the whole gallery with the client, add a password, change the design, see views and downloads, run a live slideshow on a TV, or download everything as a zip. Galleries are kept for one year.</p>
      </>
    ),
  },
  {
    id: "more",
    title: "9. 360, video guestbook and effects",
    body: (
      <ul>
        <li><strong>360 booth</strong>: plug a GoPro HERO9–12 in by USB and switch it on; it&apos;s found within seconds. Choose booth type 360 and the spin time; DSLR Snap makes the slow-motion video with your overlay and music.</li>
        <li><strong>Video guestbook</strong>: choose your webcam and microphone under Printer &amp; devices → Video guestbook.</li>
        <li><strong>Green screen and AI backgrounds</strong>: choose a background in the event; test with your real lighting first.</li>
        <li><strong>GIFs and boomerangs</strong>: a GIF is made from each session&apos;s photos; tick <strong>Boomerang</strong> in the event for a looping clip too.</li>
      </ul>
    ),
  },
  {
    id: "checklist",
    title: "10. Before every event",
    body: (
      <ul>
        <li>Camera charged or on a dummy battery, dial on M, JPEG only, auto power off disabled.</li>
        <li>Enough paper and ribbon; one test print of the event&apos;s size.</li>
        <li>A test shot at the venue, saved to the event (or applied from My settings).</li>
        <li>Operator PIN set, Booth lock on, computer plugged in and set never to sleep.</li>
        <li>The Test &amp; launch checklist all green.</li>
      </ul>
    ),
  },
  {
    id: "troubleshooting",
    title: "11. Troubleshooting",
    body: (
      <ul>
        <li><strong>Camera not found</strong>: check the USB cable and that the camera is on; close EOS Utility; press Reconnect camera. Some cameras need the screen on.</li>
        <li><strong>Controls locked on the Camera screen</strong>: the mode dial isn&apos;t on M.</li>
        <li><strong>Dark band across photos</strong>: the shutter is faster than the flash can sync; choose 1/125 or slower.</li>
        <li><strong>Print has white edges or is scaled</strong>: use DNP&apos;s own driver and print a test 4×6; send us a photo of it if it&apos;s still wrong.</li>
        <li><strong>Strips not cut</strong>: see section 4.</li>
        <li><strong>No QR code</strong>: sign in under Account, and turn on QR downloads in the event&apos;s Print &amp; share step.</li>
        <li>Still stuck? In the app, <strong>Printer &amp; devices → App</strong> shows your version and the log file: attach it when you <Link href="/account/support">chat with us</Link> or email {site.supportEmail}.</li>
      </ul>
    ),
  },
];

export default function GuidePage() {
  return (
    <ContentPage eyebrow="Help" title="DSLR Snap user guide" intro="Everything from installing to your first event: camera and flash settings, DNP printing and 2×6 cutting, templates, QR sharing and troubleshooting." narrow>
      <div className="guide-actions mb-10 flex flex-wrap gap-3">
        <a href={GUIDE_PDF} download className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink">
          <Icon name="arrow" className="size-4 rotate-90" /> Download as PDF
        </a>
        <Link href="/support" className="inline-flex items-center rounded-full border border-line px-6 py-3 font-semibold hover:bg-surface-2">More help</Link>
      </div>
      <nav aria-label="Contents" className="guide-toc mb-12 rounded-2xl border border-line bg-surface p-5">
        <p className="font-semibold">Contents</p>
        <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
          {SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-muted hover:text-accent">{s.title}</a></li>)}
        </ol>
      </nav>
      <Prose>
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="space-y-4">
            <h2>{s.title}</h2>
            {s.body}
          </section>
        ))}
      </Prose>
    </ContentPage>
  );
}
