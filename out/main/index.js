// \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
let electron = require("electron");
let node_crypto = require("node:crypto");
let node_fs = require("node:fs");
let node_fs_promises = require("node:fs/promises");
let node_path = require("node:path");
let sharp = require("sharp");
sharp = __toESM(sharp);
let qrcode = require("qrcode");
qrcode = __toESM(qrcode);
let node_child_process = require("node:child_process");
let node_events = require("node:events");
let node_readline = require("node:readline");
let better_sqlite3 = require("better-sqlite3");
better_sqlite3 = __toESM(better_sqlite3);
let node_util = require("node:util");
// src/shared/exposure.ts
/**
* Fastest shutter speed that still syncs with the flash. Faster than this, part of the frame
* misses the flash and comes out as a dark band. 1/200 s is Canon's published X-sync for the
* EOS R100 — confirm with a test shot on the real camera + flash and adjust here if needed.
*/
var FLASH_SYNC_SECONDS = 1 / 200;
/** "1/125" → 0.008, '0.5"' → 0.5, '30"' → 30. NaN for anything else (e.g. "Bulb"). */
function shutterSeconds(label) {
	const frac = label.match(/^1\/(\d+)$/);
	if (frac) return 1 / Number(frac[1]);
	const secs = label.match(/^(\d+(?:\.\d+)?)"$/);
	return secs ? Number(secs[1]) : NaN;
}
/** The booth always shoots with flash, so faster shutter speeds are never offered. */
function flashSafe(shutters) {
	return shutters.filter((s) => shutterSeconds(s) >= FLASH_SYNC_SECONDS * .98);
}
function numeric(key, label) {
	if (key === "shutter") return shutterSeconds(label);
	return Number(label);
}
/** Closest value the camera offers, compared in stops (log scale). White balance must match exactly. */
function nearestOption(key, options, target) {
	if (options.includes(target)) return target;
	if (key === "whiteBalance") return void 0;
	const t = numeric(key, target);
	if (!Number.isFinite(t)) return void 0;
	let best;
	let bestDist = Infinity;
	for (const o of options) {
		const v = numeric(key, o);
		if (!Number.isFinite(v)) continue;
		const d = Math.abs(Math.log2(v / t));
		if (d < bestDist) best = o, bestDist = d;
	}
	return best;
}
// src/shared/layout.ts
var SHEET = {
	w: 1248,
	h: 1844
};
/** Size of the canvas a template is designed on. */
function canvasSize(format, orientation) {
	if (format === "2x6") return {
		w: SHEET.w / 2,
		h: SHEET.h
	};
	return orientation === "portrait" ? {
		w: SHEET.w,
		h: SHEET.h
	} : {
		w: SHEET.h,
		h: SHEET.w
	};
}
function inside(r, c) {
	return r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= c.w && r.y + r.h <= c.h;
}
function overlaps(a, b) {
	return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
/** Validates a template before it can be used at an event. */
function validateTemplate(t) {
	const issues = [];
	if (t.format === "2x6" && t.orientation !== "portrait") issues.push({
		level: "error",
		message: "2x6 strips must be portrait."
	});
	if (t.slots.length === 0) issues.push({
		level: "error",
		message: "Template needs at least one photo slot."
	});
	const c = canvasSize(t.format, t.orientation);
	t.slots.forEach((s, i) => {
		if (!inside(s, c)) issues.push({
			level: "error",
			message: `Slot ${i + 1} is outside the ${c.w}×${c.h} canvas.`
		});
		else if (s.x < 18 || s.y < 18 || s.x + s.w > c.w - 18 || s.y + s.h > c.h - 18) issues.push({
			level: "warning",
			message: `Slot ${i + 1} is close to the edge and may be trimmed.`
		});
		t.slots.forEach((o, j) => {
			if (j > i && overlaps(s, o)) issues.push({
				level: "warning",
				message: `Slots ${i + 1} and ${j + 1} overlap.`
			});
		});
	});
	return issues;
}
/** Replace {event} {date} {time} tokens in template text. */
function fillTokens(text, vars) {
	const date = vars.date.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric"
	});
	const time = vars.date.toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit"
	});
	return text.replaceAll("{event}", vars.event).replaceAll("{date}", date).replaceAll("{time}", time);
}
/** Evenly stacked slots for a strip/sheet, leaving room at the bottom for branding. */
function stackedSlots(count, canvas, opts) {
	const w = canvas.w - opts.margin * 2;
	const h = Math.floor((canvas.h - opts.margin * 2 - opts.footer - opts.gap * (count - 1)) / count);
	return Array.from({ length: count }, (_, i) => ({
		x: opts.margin,
		y: opts.margin + i * (h + opts.gap),
		w,
		h
	}));
}
// src/main/compose/composer.ts
function escapeXml(s) {
	return s.replace(/[<>&'"]/g, (c) => ({
		"<": "&lt;",
		">": "&gt;",
		"&": "&amp;",
		"'": "&apos;",
		"\"": "&quot;"
	})[c]);
}
function textSvg(items, w, h, vars) {
	const nodes = items.map((t) => {
		const family = escapeXml(t.fontFamily ?? "Helvetica, Arial, sans-serif");
		return `<text x="${t.x}" y="${t.y}" font-size="${t.size}" fill="${escapeXml(t.color)}" font-family="${family}" font-weight="${t.weight ?? "normal"}" text-anchor="${t.align ?? "start"}">${escapeXml(fillTokens(t.text, vars))}</text>`;
	}).join("");
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${nodes}</svg>`);
}
/**
* Renders photos into a template. Photos are centre-cropped to fill each slot ("cover"),
* which is what guests expect from a booth print. EXIF rotation is applied first.
*/
async function compose(input) {
	const { template, photoPaths } = input;
	if (photoPaths.length < template.slots.length) throw new Error(`Template "${template.name}" needs ${template.slots.length} photos, got ${photoPaths.length}.`);
	const size = canvasSize(template.format, template.orientation);
	const vars = {
		event: input.eventName,
		date: input.date ?? /* @__PURE__ */ new Date()
	};
	const layers = [];
	if (template.backgroundPath) {
		const background = await (0, sharp.default)(template.backgroundPath).resize(size.w, size.h, { fit: "fill" }).png().toBuffer();
		layers.push({
			input: background,
			left: 0,
			top: 0
		});
	}
	for (let i = 0; i < template.slots.length; i++) {
		const s = template.slots[i];
		const photo = await (0, sharp.default)(photoPaths[i]).rotate().resize(Math.round(s.w), Math.round(s.h), {
			fit: "cover",
			position: "centre"
		}).toBuffer();
		layers.push({
			input: photo,
			left: Math.round(s.x),
			top: Math.round(s.y)
		});
	}
	if (template.overlayPath) {
		const overlay = await (0, sharp.default)(template.overlayPath).resize(size.w, size.h, { fit: "fill" }).png().toBuffer();
		layers.push({
			input: overlay,
			left: 0,
			top: 0
		});
	}
	if (template.logo) {
		const l = template.logo;
		const logo = await (0, sharp.default)(l.path).resize(Math.round(l.w), Math.round(l.h), {
			fit: "contain",
			background: {
				r: 0,
				g: 0,
				b: 0,
				alpha: 0
			}
		}).png().toBuffer();
		layers.push({
			input: logo,
			left: Math.round(l.x),
			top: Math.round(l.y)
		});
	}
	if (template.texts.length) layers.push({
		input: textSvg(template.texts, size.w, size.h, vars),
		left: 0,
		top: 0
	});
	const composite = await (0, sharp.default)({ create: {
		width: size.w,
		height: size.h,
		channels: 3,
		background: template.background
	} }).composite(layers).jpeg({
		quality: 95,
		chromaSubsampling: "4:4:4"
	}).withMetadata({ density: 300 }).toBuffer();
	let printSheet;
	if (template.format === "2x6") printSheet = await (0, sharp.default)({ create: {
		width: SHEET.w,
		height: SHEET.h,
		channels: 3,
		background: template.background
	} }).composite([{
		input: composite,
		left: 0,
		top: 0
	}, {
		input: composite,
		left: SHEET.w / 2,
		top: 0
	}]).jpeg({
		quality: 95,
		chromaSubsampling: "4:4:4"
	}).withMetadata({ density: 300 }).toBuffer();
	else if (template.orientation === "landscape") printSheet = await (0, sharp.default)(composite).rotate(90).jpeg({
		quality: 95,
		chromaSubsampling: "4:4:4"
	}).withMetadata({ density: 300 }).toBuffer();
	else printSheet = composite;
	return {
		composite,
		printSheet
	};
}
async function previewDataUrl(input, width = 480) {
	return `data:image/jpeg;base64,${(await (0, sharp.default)(input).rotate().resize({
		width,
		withoutEnlargement: true
	}).jpeg({ quality: 75 }).toBuffer()).toString("base64")}`;
}
// src/main/BoothService.ts
var GIF_FRAME = {
	w: 720,
	h: 480
};
var GIF_FRAME_MS = 700;
var GALLERY_LIMIT = 60;
/** Looping GIF of the session's photos, one frame each. */
async function makeGif(photoPaths, out) {
	const frames = await Promise.all(photoPaths.map((p) => (0, sharp.default)(p).rotate().resize(GIF_FRAME.w, GIF_FRAME.h, { fit: "cover" }).png().toBuffer()));
	await (0, sharp.default)(frames, { join: { animated: true } }).gif({
		loop: 0,
		delay: frames.map(() => GIF_FRAME_MS)
	}).toFile(out);
}
var thumbPathFor = (compositePath) => (0, node_path.join)((0, node_path.dirname)(compositePath), "thumb.jpg");
async function writeThumb(composite, out) {
	await (0, sharp.default)(composite).resize({
		height: 480,
		withoutEnlargement: true
	}).jpeg({ quality: 80 }).toFile(out);
}
function withTimeout(p, ms) {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(/* @__PURE__ */ new Error("timeout")), ms);
		p.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)));
	});
}
/** Folder-safe version of an event name. */
function safeName(s) {
	return s.replace(/[^a-z0-9-_ ]/gi, "").trim().slice(0, 60) || "event";
}
/**
* Orchestrates a guest session: capture → compose → print → (optional) upload.
* Contains no Electron imports so it can be tested in plain Node.
*/
var BoothService = class {
	deps;
	constructor(deps) {
		this.deps = deps;
	}
	activeEvent() {
		const { db } = this.deps;
		const id = db.getActiveEventId();
		const ev = id ? db.getEvent(id) : void 0;
		if (!ev) throw new Error("No active event. Open Admin and create or select an event.");
		return ev;
	}
	sessionDir(ev, sessionId) {
		return (0, node_path.join)(this.deps.dataDir, "events", `${ev.date}-${safeName(ev.name)}-${ev.id.slice(0, 8)}`, sessionId);
	}
	startSession() {
		const ev = this.activeEvent();
		return {
			sessionId: this.deps.db.createSession(ev.id).id,
			event: ev
		};
	}
	async capture(sessionId) {
		const { db } = this.deps;
		const session = db.getSession(sessionId);
		if (!session) throw new Error("Session not found");
		const ev = db.getEvent(session.eventId);
		const path = await this.deps.camera().capture((0, node_path.join)(this.sessionDir(ev, sessionId), "originals"));
		db.updateSession(sessionId, { photoPaths: [...session.photoPaths, path] });
		return {
			path,
			preview: await previewDataUrl(path, 640)
		};
	}
	/**
	* @param photoPaths the guest's final selection, in order (after any retakes)
	* @param requestKey unique per "finish" press; repeats return the existing print job
	*/
	async finish(sessionId, photoPaths, requestKey) {
		const { db, printQueue, uploadQueue, gallery } = this.deps;
		const session = db.getSession(sessionId);
		if (!session) throw new Error("Session not found");
		const known = new Set(session.photoPaths);
		if (!photoPaths.every((p) => known.has(p))) throw new Error("Photo does not belong to this session");
		const ev = db.getEvent(session.eventId);
		const template = db.getTemplate(ev.templateId);
		if (!template) throw new Error("Event template is missing");
		const dir = this.sessionDir(ev, sessionId);
		await (0, node_fs_promises.mkdir)(dir, { recursive: true });
		const { composite, printSheet } = await compose({
			template,
			photoPaths,
			eventName: ev.name
		});
		const compositePath = (0, node_path.join)(dir, "final.jpg");
		const printPath = (0, node_path.join)(dir, "print-sheet.jpg");
		const gifPath = (0, node_path.join)(dir, "animation.gif");
		await (0, node_fs_promises.writeFile)(compositePath, composite);
		await (0, node_fs_promises.writeFile)(printPath, printSheet);
		const gifOk = await Promise.all([makeGif(photoPaths, gifPath), writeThumb(composite, thumbPathFor(compositePath))]).then(() => true, (e) => (this.deps.log?.("warn", `gif/thumbnail for session ${sessionId}: ${e instanceof Error ? e.message : e}`), false));
		db.updateSession(sessionId, {
			status: "composed",
			photoPaths,
			compositePath,
			printPath,
			...gifOk ? { gifPath } : {}
		});
		let printJobId;
		if (ev.autoPrint && ev.printCopies > 0) printJobId = printQueue.enqueue(sessionId, `auto:${requestKey}`, printPath, template.format, ev.printCopies).id;
		let qrDataUrl;
		if (ev.galleryEnabled && gallery.enabled) {
			uploadQueue.enqueue(sessionId, compositePath);
			const url = await this.waitForGalleryUrl(sessionId);
			if (url) qrDataUrl = await qrcode.default.toDataURL(url, {
				margin: 1,
				width: 512,
				errorCorrectionLevel: "M"
			});
		}
		db.updateSession(sessionId, { status: "complete" });
		return {
			session: db.getSession(sessionId),
			printPreview: await previewDataUrl(composite, 700),
			qrDataUrl,
			printJobId
		};
	}
	async waitForGalleryUrl(sessionId) {
		const wait = this.deps.qrWaitMs ?? 8e3;
		const started = Date.now();
		while (Date.now() - started < wait) {
			const url = this.deps.db.getSession(sessionId)?.galleryUrl;
			if (url) return url;
			await withTimeout(this.deps.uploadQueue.tick(), 2e3).catch(() => void 0);
			await new Promise((r) => setTimeout(r, 250));
		}
		return this.deps.db.getSession(sessionId)?.galleryUrl;
	}
	/** Operator/guest reprint from history. */
	reprint(sessionId, requestKey, copies) {
		const { db, printQueue } = this.deps;
		const s = db.getSession(sessionId);
		if (!s?.printPath) throw new Error("This session has no print file yet");
		const ev = db.getEvent(s.eventId);
		const template = db.getTemplate(ev.templateId);
		return printQueue.enqueue(sessionId, `reprint:${requestKey}`, s.printPath, template.format, Math.max(1, Math.min(10, copies))).id;
	}
	/** Finished sessions of the active event for the guest gallery, newest first. Empty when the event hides it. */
	async galleryList() {
		const ev = this.activeEventOrNull();
		if (!ev?.showGallery) return [];
		const sessions = this.deps.db.listSessions(ev.id, 120).filter((s) => s.status === "complete" && s.compositePath && (0, node_fs.existsSync)(s.compositePath));
		const out = [];
		for (const s of sessions.slice(0, GALLERY_LIMIT)) {
			const thumb = thumbPathFor(s.compositePath);
			if (!(0, node_fs.existsSync)(thumb)) await writeThumb(s.compositePath, thumb);
			out.push({
				id: s.id,
				createdAt: s.createdAt,
				thumb: `data:image/jpeg;base64,${(await (0, node_fs_promises.readFile)(thumb)).toString("base64")}`,
				hasGif: !!s.gifPath && (0, node_fs.existsSync)(s.gifPath)
			});
		}
		return out;
	}
	/** One gallery entry at viewing size. Only finished sessions of the active event are ever returned to guests. */
	async galleryItem(sessionId) {
		const ev = this.activeEventOrNull();
		const s = this.deps.db.getSession(sessionId);
		if (!ev?.showGallery || !s || s.eventId !== ev.id || s.status !== "complete" || !s.compositePath || !(0, node_fs.existsSync)(s.compositePath)) throw new Error("This photo is not available.");
		const gif = s.gifPath && (0, node_fs.existsSync)(s.gifPath) ? `data:image/gif;base64,${(await (0, node_fs_promises.readFile)(s.gifPath)).toString("base64")}` : void 0;
		return {
			image: await previewDataUrl(s.compositePath, 1e3),
			gif
		};
	}
	activeEventOrNull() {
		const id = this.deps.db.getActiveEventId();
		return id ? this.deps.db.getEvent(id) : void 0;
	}
};
// src/main/exportEvent.ts
/**
* Copies an event's finished designs (and optionally the original camera files) into
* `<dest>/<date> <event name>/`, e.g. onto a USB stick for the client. Re-exporting overwrites,
* so running it again after more sessions just adds the new ones.
*/
async function exportEventPhotos(db, eventId, dest, opts) {
	const ev = db.getEvent(eventId);
	if (!ev) throw new Error("Unknown event");
	const folder = (0, node_path.join)(dest, `${ev.date} ${safeName(ev.name)}`);
	const sessions = db.listSessions(eventId, 1e5).filter((s) => s.status === "complete");
	let prints = 0;
	let originals = 0;
	let missing = 0;
	const copy = async (from, to) => {
		if (!(0, node_fs.existsSync)(from)) return missing++, false;
		await (0, node_fs_promises.copyFile)(from, to);
		return true;
	};
	for (const s of sessions) {
		const stamp = `${s.createdAt.replace(/[:.]/g, "-").slice(0, 19)}_${s.id.slice(0, 8)}`;
		if (s.compositePath) {
			await (0, node_fs_promises.mkdir)((0, node_path.join)(folder, "prints"), { recursive: true });
			if (await copy(s.compositePath, (0, node_path.join)(folder, "prints", `${stamp}.jpg`))) prints++;
		}
		if (opts.originals && s.photoPaths.length) {
			const dir = (0, node_path.join)(folder, "originals", stamp);
			await (0, node_fs_promises.mkdir)(dir, { recursive: true });
			for (const p of s.photoPaths) if (await copy(p, (0, node_path.join)(dir, (0, node_path.basename)(p)))) originals++;
		}
	}
	return {
		folder,
		prints,
		originals,
		missing
	};
}
// src/main/security/PinLock.ts
var KEY = "operator_pin";
var MAX_TRIES = 5;
var LOCK_MS = 3e4;
/**
* Operator PIN that keeps guests out of the admin screens. Stored as a salted scrypt hash.
* Wrong-attempt counting lives in memory: it only has to slow down a guest poking at the screen.
*/
var PinLock = class {
	db;
	now;
	failures = 0;
	lockedUntil = 0;
	constructor(db, now = Date.now) {
		this.db = db;
		this.now = now;
	}
	hasPin() {
		return this.db.getSetting(KEY) !== void 0;
	}
	verify(pin) {
		const stored = this.db.getSetting(KEY);
		if (!stored) return { ok: true };
		const wait = this.lockedUntil - this.now();
		if (wait > 0) return {
			ok: false,
			lockedForSeconds: Math.ceil(wait / 1e3)
		};
		if (matches(stored, pin)) {
			this.failures = 0;
			return { ok: true };
		}
		if (++this.failures >= MAX_TRIES) {
			this.failures = 0;
			this.lockedUntil = this.now() + LOCK_MS;
			return {
				ok: false,
				lockedForSeconds: LOCK_MS / 1e3
			};
		}
		return { ok: false };
	}
	/** Set, change (`next`) or remove (`next` = null) the PIN. Needs the current PIN once one exists. */
	setPin(current, next) {
		const stored = this.db.getSetting(KEY);
		if (stored && !matches(stored, current ?? "")) throw new Error("The current PIN is wrong.");
		if (next === null) return this.db.setSetting(KEY, null);
		if (!/^\d{4,8}$/.test(next)) throw new Error("The PIN must be 4 to 8 digits.");
		const salt = (0, node_crypto.randomBytes)(16).toString("hex");
		this.db.setSetting(KEY, `${salt}:${(0, node_crypto.scryptSync)(next, salt, 32).toString("hex")}`);
	}
};
function matches(stored, pin) {
	const [salt, hash] = stored.split(":");
	const expected = Buffer.from(hash, "hex");
	return (0, node_crypto.timingSafeEqual)((0, node_crypto.scryptSync)(pin, salt, expected.length), expected);
}
// src/main/camera/analyzeShot.ts
/**
* Brightness check for a test shot. Works on a downscaled greyscale copy, so it is fast even
* for 24 MP originals. The histogram covers the whole frame; the verdict only looks at the
* centre, where the guests stand, because booth backdrops are often white and blown out on purpose.
*/
async function analyzeShot(path) {
	const { data, info } = await (0, sharp.default)(path).rotate().resize(320, 320, { fit: "inside" }).greyscale().raw().toBuffer({ resolveWithObject: true });
	const { width: w, height: h } = info;
	const bins = new Array(64).fill(0);
	for (const v of data) bins[v >> 2]++;
	const x0 = Math.floor(w * .25);
	const x1 = Math.ceil(w * .75);
	const y0 = Math.floor(h * .2);
	const y1 = Math.ceil(h * .8);
	let sum = 0;
	let clipped = 0;
	for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
		const v = data[y * w + x];
		sum += v;
		if (v >= 250) clipped++;
	}
	const n = (x1 - x0) * (y1 - y0);
	const brightness = sum / n;
	const verdict = clipped / n > .15 || brightness > 200 ? "bright" : brightness < 70 ? "dark" : "good";
	return {
		histogram: bins.map((b) => b / data.length),
		brightness,
		verdict
	};
}
// src/main/camera/applyExposure.ts
/** Camera state with shutter speeds the flash can't sync at removed. */
async function readExposure(camera) {
	return withFlashSafeShutters(await camera.getExposure());
}
function withFlashSafeShutters(s) {
	return {
		...s,
		options: {
			...s.options,
			shutter: flashSafe(s.options.shutter)
		}
	};
}
/**
* Applies saved settings, each snapped to the nearest value the camera currently allows
* (the lens and zoom limit the aperture). Settings the camera won't take in its current mode
* are skipped rather than failing, so a wrong mode dial never blocks the booth.
*/
async function applyExposure(camera, wanted) {
	let state = await readExposure(camera);
	const skipped = [];
	for (const key of Object.keys(wanted)) {
		const target = wanted[key];
		if (!target) continue;
		const value = nearestOption(key, state.options[key], target);
		if (!value) {
			skipped.push(key);
			continue;
		}
		if (value === state.current[key]) continue;
		try {
			state = withFlashSafeShutters(await camera.setExposure(key, value));
		} catch {
			skipped.push(key);
		}
	}
	return {
		state,
		skipped
	};
}
// src/main/camera/canonCodes.ts
/**
* Canon EDSDK exposure property codes ↔ the labels the camera shows.
* The bridge only passes raw codes; all naming lives here so it is unit tested on any OS.
* Tables follow the EDSDK API reference (kEdsPropID_Av / _Tv / _ISOSpeed / _WhiteBalance / _AEMode).
* EDSDK codes step by 8 per full stop (+3 / +5 = thirds, +4 = half stop), which the formula fallbacks use.
*/
var AV = {
	8: "1",
	11: "1.1",
	12: "1.2",
	13: "1.2",
	16: "1.4",
	19: "1.6",
	20: "1.8",
	21: "1.8",
	24: "2",
	27: "2.2",
	28: "2.5",
	29: "2.5",
	32: "2.8",
	35: "3.2",
	133: "3.4",
	36: "3.5",
	37: "3.5",
	40: "4",
	43: "4.5",
	44: "4.5",
	45: "5",
	48: "5.6",
	51: "6.3",
	52: "6.7",
	53: "7.1",
	56: "8",
	59: "9",
	60: "9.5",
	61: "10",
	64: "11",
	67: "13",
	68: "13",
	69: "14",
	72: "16",
	75: "18",
	76: "19",
	77: "20",
	80: "22",
	83: "25",
	84: "27",
	85: "29",
	88: "32",
	91: "36",
	92: "38",
	93: "40",
	96: "45",
	99: "51",
	100: "54",
	101: "57",
	104: "64",
	107: "72",
	108: "76",
	109: "80",
	112: "91"
};
var TV = {
	12: "Bulb",
	16: "30\"",
	19: "25\"",
	20: "20\"",
	21: "20\"",
	24: "15\"",
	27: "13\"",
	28: "10\"",
	29: "10\"",
	32: "8\"",
	35: "6\"",
	36: "6\"",
	37: "5\"",
	40: "4\"",
	43: "3.2\"",
	44: "3\"",
	45: "2.5\"",
	48: "2\"",
	51: "1.6\"",
	52: "1.5\"",
	53: "1.3\"",
	56: "1\"",
	59: "0.8\"",
	60: "0.7\"",
	61: "0.6\"",
	64: "0.5\"",
	67: "0.4\"",
	68: "0.3\"",
	69: "0.3\"",
	72: "1/4",
	75: "1/5",
	76: "1/6",
	77: "1/6",
	80: "1/8",
	83: "1/10",
	84: "1/10",
	85: "1/13",
	88: "1/15",
	91: "1/20",
	92: "1/20",
	93: "1/25",
	96: "1/30",
	99: "1/40",
	100: "1/45",
	101: "1/50",
	104: "1/60",
	107: "1/80",
	108: "1/90",
	109: "1/100",
	112: "1/125",
	115: "1/160",
	116: "1/180",
	117: "1/200",
	120: "1/250",
	123: "1/320",
	124: "1/350",
	125: "1/400",
	128: "1/500",
	131: "1/640",
	132: "1/750",
	133: "1/800",
	136: "1/1000",
	139: "1/1250",
	140: "1/1500",
	141: "1/1600",
	144: "1/2000",
	147: "1/2500",
	148: "1/3000",
	149: "1/3200",
	152: "1/4000",
	155: "1/5000",
	156: "1/6000",
	157: "1/6400",
	160: "1/8000"
};
var WB = {
	0: "Auto",
	23: "Auto (white)",
	1: "Daylight",
	8: "Shade",
	2: "Cloudy",
	3: "Tungsten",
	4: "Fluorescent",
	5: "Flash",
	6: "Custom",
	9: "Colour temp."
};
var MODES = {
	0: "P",
	1: "Tv",
	2: "Av",
	3: "M",
	4: "Bulb",
	9: "Auto",
	22: "Auto",
	19: "Creative Auto",
	11: "Sports",
	12: "Portrait",
	13: "Landscape",
	14: "Close-up",
	15: "Flash off",
	25: "Scene"
};
var ISO_NOMINAL = [
	6,
	12,
	25,
	50,
	64,
	80,
	100,
	125,
	160,
	200,
	250,
	320,
	400,
	500,
	640,
	800,
	1e3,
	1250,
	1600,
	2e3,
	2500,
	3200,
	4e3,
	5e3,
	6400,
	8e3,
	1e4,
	12800,
	16e3,
	2e4,
	25600,
	32e3,
	4e4,
	51200,
	64e3,
	8e4,
	102400
];
var AV_NOMINAL = [...new Set(Object.values(AV))].map(Number);
function nearest(values, v) {
	return values.reduce((a, b) => Math.abs(Math.log(b / v)) < Math.abs(Math.log(a / v)) ? b : a);
}
function isoLabel(code) {
	if (code === 0) return "Auto";
	return String(nearest(ISO_NOMINAL, 100 * 2 ** ((code - 72) / 8)));
}
function avLabel(code) {
	return AV[code] ?? String(nearest(AV_NOMINAL, 2 ** ((code - 8) / 16)));
}
function tvLabel(code) {
	if (TV[code]) return TV[code];
	const seconds = 2 ** (-(code - 56) / 8);
	return seconds >= .3 ? `${Math.round(seconds * 10) / 10}"` : `1/${Math.round(1 / seconds)}`;
}
/** null for values the booth shouldn't offer (e.g. Canon's "click" or "pasted" white balance). */
function wbLabel(code) {
	return WB[code] ?? null;
}
var LABEL = {
	iso: isoLabel,
	aperture: avLabel,
	shutter: tvLabel,
	whiteBalance: wbLabel
};
var BRIDGE_PROP = {
	iso: "iso",
	aperture: "av",
	shutter: "tv",
	whiteBalance: "wb"
};
function labels(key, codes) {
	const out = [];
	for (const c of codes) {
		const l = LABEL[key](c);
		if (l !== null && !out.includes(l)) out.push(l);
	}
	return out;
}
function decodeExposure(raw) {
	const keys = Object.keys(BRIDGE_PROP);
	const current = {};
	const options = {};
	for (const key of keys) {
		const p = raw[BRIDGE_PROP[key]];
		const label = p.value === null ? null : LABEL[key](p.value);
		if (label !== null) current[key] = label;
		options[key] = labels(key, p.allowed);
	}
	return {
		mode: MODES[raw.mode] ?? (raw.mode < 0 ? "" : "Other"),
		manual: raw.mode === 3,
		current,
		options
	};
}
/** The code to send for a label, chosen from what the camera currently offers. */
function encodeOption(key, allowed, label) {
	const code = allowed.find((c) => LABEL[key](c) === label);
	if (code === void 0) throw new Error(`${label} is not available on the camera right now.`);
	return code;
}
// src/main/camera/CanonBridgeCamera.ts
/**
* Talks to native/CanonBridge (a small .NET program wrapping Canon EDSDK) over stdin/stdout.
*
* Protocol: one JSON object per line.
*   → {"id":1,"cmd":"capture","args":{"dir":"C:\\..."}}
*   ← {"id":1,"ok":true,"data":{"path":"C:\\...\\IMG_0001.JPG"}}
*   ← {"id":1,"ok":false,"error":"Camera busy"}
*   ← {"event":"disconnected"}                 (unsolicited)
*   ← {"event":"exposure_changed"}             (unsolicited: dial turned, lens zoomed, or our own set)
*
* Running the SDK out-of-process means a Canon SDK crash can't take the booth UI down;
* we simply restart the bridge and reconnect.
*/
var CanonBridgeCamera = class extends node_events.EventEmitter {
	exePath;
	args;
	timeouts;
	driver = "canon-edsdk";
	proc;
	nextId = 1;
	pending = /* @__PURE__ */ new Map();
	status = {
		driver: "canon-edsdk",
		state: "disconnected",
		liveViewSupported: false
	};
	wantConnected = false;
	reconnectTimer;
	constructor(exePath, args = [], timeouts = {
		default: 1e4,
		capture: 2e4
	}) {
		super();
		this.exePath = exePath;
		this.args = args;
		this.timeouts = timeouts;
	}
	getStatus() {
		return this.status;
	}
	setStatus(p) {
		this.status = {
			...this.status,
			...p
		};
		this.emit("status", this.status);
	}
	ensureProcess() {
		if (this.proc && this.proc.exitCode === null) return this.proc;
		const proc = (0, node_child_process.spawn)(this.exePath, this.args, {
			stdio: [
				"pipe",
				"pipe",
				"pipe"
			],
			windowsHide: true
		});
		this.proc = proc;
		(0, node_readline.createInterface)({ input: proc.stdout }).on("line", (line) => this.onLine(line));
		proc.stderr.on("data", (d) => this.emit("log", String(d)));
		proc.on("error", (err) => this.onExit(`Could not start camera bridge: ${err.message}`));
		proc.on("exit", (code) => this.onExit(`Camera bridge exited (code ${code})`));
		return proc;
	}
	onExit(message) {
		this.proc = void 0;
		for (const [, p] of this.pending) {
			clearTimeout(p.timer);
			p.reject(new Error(message));
		}
		this.pending.clear();
		this.setStatus(this.wantConnected ? {
			state: "error",
			message
		} : {
			state: "disconnected",
			message: void 0
		});
		this.scheduleReconnect();
	}
	onLine(line) {
		let msg;
		try {
			msg = JSON.parse(line);
		} catch {
			this.emit("log", `bridge: ${line}`);
			return;
		}
		if (msg.event) {
			if (msg.event === "disconnected") {
				this.setStatus({
					state: "disconnected",
					message: "Camera disconnected — check USB cable and power"
				});
				this.scheduleReconnect();
			}
			if (msg.event === "exposure_changed") this.emit("exposure");
			this.emit("bridgeEvent", msg);
			return;
		}
		const p = this.pending.get(msg.id);
		if (!p) return;
		this.pending.delete(msg.id);
		clearTimeout(p.timer);
		msg.ok ? p.resolve(msg.data) : p.reject(new Error(msg.error || "Camera error"));
	}
	send(cmd, args = {}, timeoutMs = this.timeouts.default) {
		const proc = this.ensureProcess();
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(/* @__PURE__ */ new Error(`Camera did not respond to "${cmd}" within ${timeoutMs / 1e3}s`));
			}, timeoutMs);
			this.pending.set(id, {
				resolve,
				reject,
				timer
			});
			proc.stdin.write(JSON.stringify({
				id,
				cmd,
				args
			}) + "\n");
		});
	}
	scheduleReconnect() {
		if (!this.wantConnected || this.reconnectTimer) return;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = void 0;
			this.connect().catch(() => this.scheduleReconnect());
		}, 3e3);
	}
	async connect() {
		this.wantConnected = true;
		this.setStatus({
			state: "connecting",
			message: void 0
		});
		try {
			const info = await this.send("connect");
			this.setStatus({
				state: "ready",
				model: info.model,
				liveViewSupported: !!info.liveView
			});
		} catch (e) {
			this.setStatus({
				state: "error",
				message: e instanceof Error ? e.message : String(e)
			});
			this.scheduleReconnect();
			throw e;
		}
	}
	async disconnect() {
		this.wantConnected = false;
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		this.reconnectTimer = void 0;
		if (this.proc) {
			await this.send("disconnect").catch(() => void 0);
			this.proc.kill();
		}
		this.setStatus({ state: "disconnected" });
	}
	async capture(dir) {
		if (this.status.state !== "ready") throw new Error(this.status.message || "Camera not ready");
		this.setStatus({ state: "busy" });
		try {
			return (await this.send("capture", { dir }, this.timeouts.capture)).path;
		} finally {
			if (this.getStatus().state === "busy") this.setStatus({ state: "ready" });
		}
	}
	async startLiveView() {
		if (!this.status.liveViewSupported) return false;
		try {
			await this.send("liveview_start");
			return true;
		} catch {
			return false;
		}
	}
	async getLiveViewFrame() {
		try {
			const res = await this.send("liveview_frame", {}, 2e3);
			return res.jpeg ? Buffer.from(res.jpeg, "base64") : null;
		} catch {
			return null;
		}
	}
	async stopLiveView() {
		await this.send("liveview_stop").catch(() => void 0);
	}
	async getExposure() {
		return decodeExposure(await this.send("get_exposure"));
	}
	async setExposure(key, value) {
		const raw = await this.send("get_exposure");
		const prop = BRIDGE_PROP[key];
		const code = encodeOption(key, raw[prop].allowed, value);
		return decodeExposure(await this.send("set_exposure", {
			prop,
			code
		}));
	}
};
// src/main/camera/MockCamera.ts
var PALETTE = [
	"#ff6b6b",
	"#4ecdc4",
	"#ffd166",
	"#6a4c93",
	"#06d6a0",
	"#118ab2",
	"#ef476f",
	"#f78c6b"
];
var MOCK_OPTIONS = {
	iso: [
		"Auto",
		"100",
		"125",
		"160",
		"200",
		"250",
		"320",
		"400",
		"500",
		"640",
		"800",
		"1000",
		"1250",
		"1600",
		"2000",
		"2500",
		"3200",
		"4000",
		"5000",
		"6400"
	],
	aperture: [
		"4.5",
		"5",
		"5.6",
		"6.3",
		"7.1",
		"8",
		"9",
		"10",
		"11",
		"13",
		"14",
		"16",
		"18",
		"20",
		"22"
	],
	shutter: [
		"1\"",
		"0.5\"",
		"1/4",
		"1/8",
		"1/15",
		"1/30",
		"1/40",
		"1/50",
		"1/60",
		"1/80",
		"1/100",
		"1/125",
		"1/160",
		"1/200",
		"1/250",
		"1/320",
		"1/400",
		"1/500",
		"1/1000",
		"1/2000",
		"1/4000"
	],
	whiteBalance: [
		"Auto",
		"Daylight",
		"Shade",
		"Cloudy",
		"Tungsten",
		"Fluorescent",
		"Flash"
	]
};
/**
* Development camera so the whole booth runs on a Mac or any PC without the Canon attached.
* Generates 6000×4000 (R100-sized, 3:2) JPEGs with a numbered "subject".
*/
var MockCamera = class extends node_events.EventEmitter {
	size;
	driver = "mock";
	status = {
		driver: "mock",
		state: "disconnected",
		liveViewSupported: true
	};
	shots = 0;
	frame = 0;
	exposure = {
		iso: "400",
		aperture: "5.6",
		shutter: "1/125",
		whiteBalance: "Flash"
	};
	failNext = false;
	/** Mode dial position; tests set this to simulate the dial not being on M. */
	mode = "M";
	lensMaxAperture = MOCK_OPTIONS.aperture[0];
	/** Defaults to R100-sized frames; previews pass something small for speed. */
	constructor(size = {
		w: 6e3,
		h: 4e3
	}) {
		super();
		this.size = size;
	}
	async connect() {
		this.setStatus({
			state: "ready",
			model: `Mock camera (${this.size.w}×${this.size.h})`
		});
	}
	async disconnect() {
		this.setStatus({
			state: "disconnected",
			model: void 0
		});
	}
	getStatus() {
		return this.status;
	}
	setStatus(p) {
		this.status = {
			...this.status,
			...p
		};
		this.emit("status", this.status);
	}
	svg(w, h, label, hue) {
		return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hue}"/><stop offset="1" stop-color="#1b1b2f"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${w / 2}" cy="${h * .4}" r="${h * .16}" fill="#fff" fill-opacity="0.85"/>
      <rect x="${w / 2 - h * .22}" y="${h * .58}" width="${h * .44}" height="${h * .5}" rx="${h * .15}" fill="#fff" fill-opacity="0.85"/>
      <text x="${w * .04}" y="${h * .12}" font-size="${h * .07}" font-family="Helvetica, Arial" fill="#fff" font-weight="bold">${label}</text>
    </svg>`);
	}
	async capture(dir) {
		if (this.status.state !== "ready") throw new Error("Camera not connected");
		this.setStatus({ state: "busy" });
		try {
			if (this.size.w >= 3e3) await new Promise((r) => setTimeout(r, 400));
			if (this.failNext) {
				this.failNext = false;
				throw new Error("Mock camera: simulated focus failure");
			}
			this.shots++;
			await (0, node_fs_promises.mkdir)(dir, { recursive: true });
			const file = (0, node_path.join)(dir, `IMG_${String(this.shots).padStart(4, "0")}_${Date.now()}.jpg`);
			await (0, sharp.default)(this.svg(this.size.w, this.size.h, `MOCK SHOT ${this.shots}`, PALETTE[this.shots % PALETTE.length])).linear(this.gain(), 0).jpeg({ quality: 90 }).toFile(file);
			return file;
		} finally {
			this.setStatus({ state: "ready" });
		}
	}
	async startLiveView() {
		return true;
	}
	async getLiveViewFrame() {
		this.frame++;
		return (0, sharp.default)(this.svg(960, 640, `LIVE ${(/* @__PURE__ */ new Date()).toLocaleTimeString("en-GB")}`, PALETTE[Math.floor(this.frame / 10) % PALETTE.length])).linear(this.gain(), 0).jpeg({ quality: 60 }).toBuffer();
	}
	async stopLiveView() {}
	/**
	* Fake exposure so test shots respond on a Mac: stops relative to ISO 400, f/5.6, 1/125.
	* With flash, shutter speed barely changes the subject's brightness, so it only counts a little.
	*/
	gain() {
		const e = this.exposure;
		const iso = Number(e.iso) || 400;
		const f = Number(e.aperture) || 5.6;
		const t = shutterSeconds(e.shutter ?? "1/125") || 1 / 125;
		return 2 ** (Math.log2(iso / 400) + 2 * Math.log2(5.6 / f) + .3 * Math.log2(t * 125));
	}
	async getExposure() {
		if (this.status.state === "disconnected") throw new Error("Camera not connected");
		const manual = this.mode === "M";
		const options = manual ? structuredClone(MOCK_OPTIONS) : {
			iso: [],
			aperture: [],
			shutter: [],
			whiteBalance: []
		};
		return {
			mode: this.mode,
			manual,
			current: { ...this.exposure },
			options
		};
	}
	async setExposure(key, value) {
		const { options } = await this.getExposure();
		if (!options[key].includes(value)) throw new Error(`${value} is not available on the camera right now.`);
		this.exposure = {
			...this.exposure,
			[key]: value
		};
		return this.getExposure();
	}
};
// src/main/cloud/CloudGallery.ts
var DisabledGallery = class {
	enabled = false;
	async upload() {
		throw new Error("Cloud gallery is not configured");
	}
};
/**
* Supabase Storage implementation: private bucket + long-lived signed URL, so links can't be
* enumerated. Fine for the operator's own booths. Before selling to other operators, put a small
* API in front (per-device tokens, licence checks) instead of shipping any storage key.
*/
var SupabaseGallery = class {
	cfg;
	enabled = true;
	constructor(cfg) {
		this.cfg = cfg;
	}
	async upload(sessionId, eventId, filePath) {
		const { createClient } = await import("@supabase/supabase-js");
		const client = createClient(this.cfg.url, this.cfg.key, { auth: { persistSession: false } });
		const objectPath = `${eventId}/${sessionId}/${(0, node_path.basename)(filePath)}`;
		const body = await (0, node_fs_promises.readFile)(filePath);
		const up = await client.storage.from(this.cfg.bucket).upload(objectPath, body, {
			contentType: "image/jpeg",
			upsert: true
		});
		if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
		const signed = await client.storage.from(this.cfg.bucket).createSignedUrl(objectPath, this.cfg.linkDays * 86400, { download: false });
		if (signed.error || !signed.data) throw new Error(`Could not create link: ${signed.error?.message}`);
		return signed.data.signedUrl;
	}
};
function galleryFromEnv(env) {
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return new DisabledGallery();
	return new SupabaseGallery({
		url: env.SUPABASE_URL,
		key: env.SUPABASE_SERVICE_KEY,
		bucket: env.SUPABASE_BUCKET || "booth-sessions",
		linkDays: Number(env.GALLERY_LINK_DAYS) || 30
	});
}
// src/shared/templates.ts
var strip = canvasSize("2x6", "portrait");
var portrait = canvasSize("4x6", "portrait");
var landscape = canvasSize("4x6", "landscape");
/** Templates that ship with the app. Operators can duplicate and edit them. */
var BUILT_IN_TEMPLATES = [
	{
		id: "classic-strip-3",
		name: "Classic strip · 3 photos (2×6)",
		format: "2x6",
		orientation: "portrait",
		background: "#ffffff",
		slots: stackedSlots(3, strip, {
			margin: 44,
			gap: 24,
			footer: 330
		}),
		texts: [{
			text: "{event}",
			x: strip.w / 2,
			y: strip.h - 250,
			size: 46,
			color: "#1d1d1f",
			weight: "bold",
			align: "middle",
			fontFamily: "Georgia, serif"
		}, {
			text: "{date}",
			x: strip.w / 2,
			y: strip.h - 185,
			size: 28,
			color: "#6e6e73",
			align: "middle"
		}]
	},
	{
		id: "strip-4-dark",
		name: "Night strip · 4 photos (2×6)",
		format: "2x6",
		orientation: "portrait",
		background: "#111111",
		slots: stackedSlots(4, strip, {
			margin: 40,
			gap: 18,
			footer: 240
		}),
		texts: [{
			text: "{event}",
			x: strip.w / 2,
			y: strip.h - 150,
			size: 40,
			color: "#f5f5f7",
			weight: "bold",
			align: "middle"
		}, {
			text: "{date}",
			x: strip.w / 2,
			y: strip.h - 98,
			size: 24,
			color: "#a1a1a6",
			align: "middle"
		}]
	},
	{
		id: "portrait-single",
		name: "Single portrait (4×6)",
		format: "4x6",
		orientation: "portrait",
		background: "#ffffff",
		slots: [{
			x: 60,
			y: 60,
			w: portrait.w - 120,
			h: portrait.h - 360
		}],
		texts: [{
			text: "{event}",
			x: portrait.w / 2,
			y: portrait.h - 190,
			size: 64,
			color: "#1d1d1f",
			weight: "bold",
			align: "middle",
			fontFamily: "Georgia, serif"
		}, {
			text: "{date}",
			x: portrait.w / 2,
			y: portrait.h - 115,
			size: 34,
			color: "#6e6e73",
			align: "middle"
		}]
	},
	{
		id: "portrait-grid-4",
		name: "Grid · 4 photos (4×6 portrait)",
		format: "4x6",
		orientation: "portrait",
		background: "#f7f3ee",
		slots: [
			{
				x: 60,
				y: 60,
				w: 549,
				h: 690
			},
			{
				x: 639,
				y: 60,
				w: 549,
				h: 690
			},
			{
				x: 60,
				y: 780,
				w: 549,
				h: 690
			},
			{
				x: 639,
				y: 780,
				w: 549,
				h: 690
			}
		],
		texts: [{
			text: "{event}",
			x: portrait.w / 2,
			y: portrait.h - 230,
			size: 60,
			color: "#3a2f28",
			weight: "bold",
			align: "middle",
			fontFamily: "Georgia, serif"
		}, {
			text: "{date}",
			x: portrait.w / 2,
			y: portrait.h - 160,
			size: 32,
			color: "#8a7a6d",
			align: "middle"
		}]
	},
	{
		id: "landscape-hero-3",
		name: "Hero + 2 (4×6 landscape)",
		format: "4x6",
		orientation: "landscape",
		background: "#ffffff",
		slots: [
			{
				x: 60,
				y: 60,
				w: 1140,
				h: 980
			},
			{
				x: 1230,
				y: 60,
				w: 554,
				h: 475
			},
			{
				x: 1230,
				y: 565,
				w: 554,
				h: 475
			}
		],
		texts: [{
			text: "{event}  ·  {date}",
			x: landscape.w / 2,
			y: landscape.h - 90,
			size: 46,
			color: "#1d1d1f",
			weight: "bold",
			align: "middle"
		}]
	}
];
// src/main/compose/templateImport.ts
var LAYOUTS = [
	{
		format: "2x6",
		orientation: "portrait"
	},
	{
		format: "4x6",
		orientation: "portrait"
	},
	{
		format: "4x6",
		orientation: "landscape"
	}
];
var ratio = (l) => {
	const c = canvasSize(l.format, l.orientation);
	return c.h / c.w;
};
/** Nearest print layout by shape. Compared in log space so 2:1 and 1:2 are equally far from 1:1. */
function guessLayout(w, h) {
	const r = Math.log(h / w);
	return LAYOUTS.reduce((best, l) => Math.abs(Math.log(ratio(l)) - r) < Math.abs(Math.log(ratio(best)) - r) ? l : best);
}
/** Starting photo boxes when none were found in the design: the matching built-in layout's slots. */
function defaultSlots(layout) {
	return (BUILT_IN_TEMPLATES.find((b) => b.format === layout.format && b.orientation === layout.orientation && b.slots.length > 1)?.slots ?? []).map((s) => ({ ...s }));
}
/** Stretch when the shape is already close (the distortion is invisible), otherwise fit without cropping. */
function suggestFit(w, h, layout) {
	return Math.abs(Math.log(h / w / ratio(layout))) < .06 ? "stretch" : "fit";
}
/** Returns an RGBA PNG exactly the size of the layout's design canvas. */
async function normalizeArtwork(src, layout, fit) {
	const size = canvasSize(layout.format, layout.orientation);
	try {
		const corner = await (0, sharp.default)(src).rotate().resize(8, 8, { fit: "fill" }).ensureAlpha().raw().toBuffer();
		const background = corner[3] < 128 ? {
			r: 255,
			g: 255,
			b: 255,
			alpha: 1
		} : {
			r: corner[0],
			g: corner[1],
			b: corner[2],
			alpha: 1
		};
		const resizeFit = fit === "stretch" ? "fill" : fit === "fill" ? "cover" : "contain";
		return await (0, sharp.default)(src).rotate().resize(size.w, size.h, {
			fit: resizeFit,
			position: "centre",
			background
		}).ensureAlpha().png().toBuffer();
	} catch {
		throw new Error("Couldn't read that file. Export your design as a PNG or JPG and try again.");
	}
}
/**
* Labels 4-connected regions. `seedOk` decides which pixels can start a region, `joins(seed, p)`
* whether pixel p belongs to the region grown from `seed`.
*/
function regions(w, h, seedOk, joins) {
	const seen = new Uint8Array(w * h);
	const queue = new Int32Array(w * h);
	const out = [];
	for (let start = 0; start < w * h; start++) {
		if (seen[start] || !seedOk(start)) continue;
		const r = {
			area: 0,
			x0: w,
			y0: h,
			x1: 0,
			y1: 0
		};
		let head = 0;
		let tail = 0;
		queue[tail++] = start;
		seen[start] = 1;
		while (head < tail) {
			const p = queue[head++];
			const x = p % w;
			const y = (p - x) / w;
			r.area++;
			if (x < r.x0) r.x0 = x;
			if (x > r.x1) r.x1 = x;
			if (y < r.y0) r.y0 = y;
			if (y > r.y1) r.y1 = y;
			const neighbours = [
				x > 0 ? p - 1 : -1,
				x < w - 1 ? p + 1 : -1,
				y > 0 ? p - w : -1,
				y < h - 1 ? p + w : -1
			];
			for (const n of neighbours) if (n >= 0 && !seen[n] && joins(start, n)) {
				seen[n] = 1;
				queue[tail++] = n;
			}
		}
		out.push(r);
	}
	return out;
}
var boxArea = (r) => (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
/** Reading order: rows top to bottom (boxes whose centres are within half a box height share a row), then left to right. */
function readingOrder(slots) {
	const sorted = [...slots].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
	const rows = [];
	for (const s of sorted) {
		const row = rows[rows.length - 1];
		if (row && Math.abs(s.y + s.h / 2 - (row[0].y + row[0].h / 2)) < Math.min(s.h, row[0].h) / 2) row.push(s);
		else rows.push([s]);
	}
	return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
}
var MAX_SLOTS = 8;
/**
* Finds where photos go in normalized artwork.
* 1. See-through holes (Canva "transparent background" exports): design goes on top of photos.
* 2. Otherwise, flat rectangular placeholder boxes not touching the edge (typical ChatGPT designs):
*    design goes behind photos. These are suggestions; the operator confirms them in the editor.
*/
async function detectSlots(png) {
	const { data, info } = await (0, sharp.default)(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const { width: w, height: h } = info;
	const total = w * h;
	const alpha = (p) => data[p * 4 + 3];
	let seeThrough = 0;
	for (let p = 0; p < total; p++) if (alpha(p) < 250) seeThrough++;
	if (seeThrough / total > .005) {
		const holes = regions(w, h, (p) => alpha(p) < 128, (_s, p) => alpha(p) < 128).filter((r) => r.area >= total * .015 && r.area / boxArea(r) >= .7).slice(0, MAX_SLOTS);
		const pad = 2;
		const slots = holes.map((r) => {
			const x = Math.max(0, r.x0 - pad);
			const y = Math.max(0, r.y0 - pad);
			return {
				x,
				y,
				w: Math.min(w - 1, r.x1 + pad) - x + 1,
				h: Math.min(h - 1, r.y1 + pad) - y + 1
			};
		});
		return {
			slots: readingOrder(slots),
			method: slots.length ? "transparent" : "none",
			layer: "over"
		};
	}
	const tol = 18;
	const close = (a, b) => Math.abs(data[a * 4] - data[b * 4]) <= tol && Math.abs(data[a * 4 + 1] - data[b * 4 + 1]) <= tol && Math.abs(data[a * 4 + 2] - data[b * 4 + 2]) <= tol;
	const boxes = regions(w, h, () => true, close).filter((r) => {
		const bw = r.x1 - r.x0 + 1;
		const bh = r.y1 - r.y0 + 1;
		return !(r.x0 === 0 || r.y0 === 0 || r.x1 === w - 1 || r.y1 === h - 1) && boxArea(r) >= total * .02 && boxArea(r) <= total * .6 && r.area / boxArea(r) >= .8 && bw / bh >= 1 / 3 && bw / bh <= 3;
	}).slice(0, MAX_SLOTS).map((r) => ({
		x: r.x0,
		y: r.y0,
		w: r.x1 - r.x0 + 1,
		h: r.y1 - r.y0 + 1
	}));
	return boxes.length ? {
		slots: readingOrder(boxes),
		method: "placeholder",
		layer: "under"
	} : {
		slots: [],
		method: "none",
		layer: "under"
	};
}
// src/shared/dates.ts
/** Today as YYYY-MM-DD in the computer's own time zone (toISOString() would give the UTC day). */
function todayIso(now = /* @__PURE__ */ new Date()) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
// src/main/db/database.ts
var MIGRATIONS = [
	`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE templates (id TEXT PRIMARY KEY, json TEXT NOT NULL, built_in INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE events (
     id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, template_id TEXT NOT NULL,
     photos_per_session INTEGER NOT NULL, countdown_seconds INTEGER NOT NULL, retakes_allowed INTEGER NOT NULL,
     print_copies INTEGER NOT NULL, auto_print INTEGER NOT NULL, gallery_enabled INTEGER NOT NULL, created_at TEXT NOT NULL);
   CREATE TABLE sessions (
     id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, status TEXT NOT NULL,
     photo_paths TEXT NOT NULL, composite_path TEXT, print_path TEXT, gallery_url TEXT, created_at TEXT NOT NULL);
   CREATE INDEX sessions_event ON sessions(event_id, created_at);
   CREATE TABLE print_jobs (
     id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
     request_key TEXT NOT NULL, file_path TEXT NOT NULL, format TEXT NOT NULL, copies INTEGER NOT NULL,
     status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
     created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(session_id, request_key));
   CREATE TABLE uploads (
     id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
     file_path TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
     next_attempt_at TEXT NOT NULL, url TEXT, last_error TEXT);`,
	`ALTER TABLE events ADD COLUMN exposure TEXT;`,
	`ALTER TABLE events ADD COLUMN shot_interval_seconds INTEGER NOT NULL DEFAULT 3;
   ALTER TABLE events ADD COLUMN photo_review_seconds INTEGER NOT NULL DEFAULT 3;
   ALTER TABLE events ADD COLUMN done_screen_seconds INTEGER NOT NULL DEFAULT 20;
   ALTER TABLE events ADD COLUMN show_gallery INTEGER NOT NULL DEFAULT 1;
   UPDATE events SET shot_interval_seconds = countdown_seconds;
   ALTER TABLE sessions ADD COLUMN gif_path TEXT;`
];
var clamp = (v, min, max) => Math.min(max, Math.max(min, Math.round(v)));
var DEFAULT_DEVICE_SETTINGS = {
	cameraDriver: "mock",
	printerDriver: "mock",
	printerName4x6: "DP-DS-RX1HS",
	printerName2x6: "DP-DS-RX1HS (2x6 cut)"
};
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var BoothDatabase = class {
	db;
	constructor(file) {
		this.db = new better_sqlite3.default(file);
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("foreign_keys = ON");
		this.migrate();
		this.seedTemplates();
	}
	migrate() {
		const version = this.db.pragma("user_version", { simple: true });
		for (let v = version; v < MIGRATIONS.length; v++) this.db.transaction(() => {
			this.db.exec(MIGRATIONS[v]);
			this.db.pragma(`user_version = ${v + 1}`);
		})();
	}
	seedTemplates() {
		const upsert = this.db.prepare("INSERT INTO templates (id, json, built_in) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE SET json = excluded.json WHERE built_in = 1");
		for (const t of BUILT_IN_TEMPLATES) upsert.run(t.id, JSON.stringify(t));
	}
	close() {
		this.db.close();
	}
	getDeviceSettings() {
		const row = this.db.prepare("SELECT value FROM settings WHERE key = 'devices'").get();
		return {
			...DEFAULT_DEVICE_SETTINGS,
			...row ? JSON.parse(row.value) : {}
		};
	}
	saveDeviceSettings(s) {
		this.db.prepare("INSERT INTO settings (key, value) VALUES ('devices', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(s));
	}
	getSetting(key) {
		return this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value;
	}
	/** null removes the setting. */
	setSetting(key, value) {
		if (value === null) this.db.prepare("DELETE FROM settings WHERE key = ?").run(key);
		else this.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
	}
	getActiveEventId() {
		return this.db.prepare("SELECT value FROM settings WHERE key = 'active_event'").get()?.value;
	}
	setActiveEventId(id) {
		this.db.prepare("INSERT INTO settings (key, value) VALUES ('active_event', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(id);
	}
	listTemplates() {
		return this.db.prepare("SELECT json FROM templates ORDER BY built_in DESC, id").all().map((r) => JSON.parse(r.json));
	}
	getTemplate(id) {
		const row = this.db.prepare("SELECT json FROM templates WHERE id = ?").get(id);
		return row ? JSON.parse(row.json) : void 0;
	}
	saveTemplate(t) {
		const toSave = this.db.prepare("SELECT built_in FROM templates WHERE id = ?").get(t.id)?.built_in ? {
			...t,
			id: `${t.id}-copy-${(0, node_crypto.randomUUID)().slice(0, 6)}`
		} : t;
		this.db.prepare("INSERT INTO templates (id, json, built_in) VALUES (?, ?, 0) ON CONFLICT(id) DO UPDATE SET json = excluded.json").run(toSave.id, JSON.stringify(toSave));
		return toSave;
	}
	deleteTemplate(id) {
		if (this.db.prepare("SELECT built_in FROM templates WHERE id = ?").get(id)?.built_in) throw new Error("Built-in templates cannot be deleted.");
		const users = this.db.prepare("SELECT name FROM events WHERE template_id = ?").all(id);
		if (users.length) throw new Error(`This template is used by: ${users.map((u) => u.name).join(", ")}. Pick another template for those events first.`);
		this.db.prepare("DELETE FROM templates WHERE id = ?").run(id);
	}
	mapEvent(r) {
		return {
			id: r.id,
			name: r.name,
			date: r.date,
			templateId: r.template_id,
			photosPerSession: r.photos_per_session,
			countdownSeconds: r.countdown_seconds,
			retakesAllowed: r.retakes_allowed,
			printCopies: r.print_copies,
			autoPrint: !!r.auto_print,
			galleryEnabled: !!r.gallery_enabled,
			shotIntervalSeconds: r.shot_interval_seconds,
			photoReviewSeconds: r.photo_review_seconds,
			doneScreenSeconds: r.done_screen_seconds,
			showGallery: !!r.show_gallery,
			exposure: r.exposure ? JSON.parse(r.exposure) : void 0,
			createdAt: r.created_at
		};
	}
	listEvents() {
		return this.db.prepare("SELECT * FROM events ORDER BY date DESC, created_at DESC").all().map((r) => this.mapEvent(r));
	}
	getEvent(id) {
		const r = this.db.prepare("SELECT * FROM events WHERE id = ?").get(id);
		return r ? this.mapEvent(r) : void 0;
	}
	saveEvent(e) {
		const template = this.getTemplate(e.templateId);
		if (!template) throw new Error("Unknown template");
		const ev = {
			...e,
			id: e.id ?? (0, node_crypto.randomUUID)(),
			createdAt: e.id && this.getEvent(e.id)?.createdAt || now(),
			photosPerSession: template.slots.length,
			countdownSeconds: clamp(e.countdownSeconds, 1, 10),
			shotIntervalSeconds: clamp(e.shotIntervalSeconds ?? e.countdownSeconds, 1, 10),
			photoReviewSeconds: clamp(e.photoReviewSeconds ?? 3, 0, 10),
			doneScreenSeconds: clamp(e.doneScreenSeconds ?? 20, 5, 120),
			showGallery: e.showGallery ?? true,
			retakesAllowed: clamp(e.retakesAllowed, 0, 10),
			printCopies: clamp(e.printCopies, 0, 10)
		};
		this.db.prepare(`INSERT INTO events (id, name, date, template_id, photos_per_session, countdown_seconds, retakes_allowed, print_copies, auto_print, gallery_enabled,
           shot_interval_seconds, photo_review_seconds, done_screen_seconds, show_gallery, exposure, created_at)
         VALUES (@id, @name, @date, @templateId, @photosPerSession, @countdownSeconds, @retakesAllowed, @printCopies, @autoPrint, @galleryEnabled,
           @shotIntervalSeconds, @photoReviewSeconds, @doneScreenSeconds, @showGallery, @exposure, @createdAt)
         ON CONFLICT(id) DO UPDATE SET name=@name, date=@date, template_id=@templateId, photos_per_session=@photosPerSession,
           countdown_seconds=@countdownSeconds, retakes_allowed=@retakesAllowed, print_copies=@printCopies, auto_print=@autoPrint, gallery_enabled=@galleryEnabled,
           shot_interval_seconds=@shotIntervalSeconds, photo_review_seconds=@photoReviewSeconds, done_screen_seconds=@doneScreenSeconds, show_gallery=@showGallery`).run({
			...ev,
			autoPrint: ev.autoPrint ? 1 : 0,
			galleryEnabled: ev.galleryEnabled ? 1 : 0,
			showGallery: ev.showGallery ? 1 : 0,
			exposure: ev.exposure ? JSON.stringify(ev.exposure) : null
		});
		return this.getEvent(ev.id);
	}
	/** Saved from the Camera screen; separate from saveEvent so it never races the event form. */
	saveEventExposure(id, exposure) {
		this.db.prepare("UPDATE events SET exposure = ? WHERE id = ?").run(JSON.stringify(exposure), id);
	}
	duplicateEvent(id) {
		const ev = this.getEvent(id);
		if (!ev) throw new Error("Unknown event");
		const { id: _id, createdAt: _created, ...rest } = ev;
		return this.saveEvent({
			...rest,
			name: `${ev.name} (copy)`,
			date: todayIso()
		});
	}
	eventStats(eventId) {
		const sessions = this.db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE event_id = ? AND status = 'complete'").get(eventId).n;
		const jobs = this.db.prepare("SELECT j.status, COUNT(*) AS n, SUM(j.copies) AS copies FROM print_jobs j JOIN sessions s ON s.id = j.session_id WHERE s.event_id = ? GROUP BY j.status").all(eventId);
		const job = (st) => jobs.find((r) => r.status === st);
		const lastPrintError = this.db.prepare("SELECT j.last_error AS e FROM print_jobs j JOIN sessions s ON s.id = j.session_id WHERE s.event_id = ? AND j.last_error IS NOT NULL ORDER BY j.updated_at DESC LIMIT 1").get(eventId);
		const ups = this.db.prepare("SELECT u.status, COUNT(*) AS n FROM uploads u JOIN sessions s ON s.id = u.session_id WHERE s.event_id = ? GROUP BY u.status").all(eventId);
		const up = (st) => ups.find((r) => r.status === st)?.n ?? 0;
		const lastUploadError = this.db.prepare("SELECT u.last_error AS e FROM uploads u JOIN sessions s ON s.id = u.session_id WHERE s.event_id = ? AND u.last_error IS NOT NULL ORDER BY u.next_attempt_at DESC LIMIT 1").get(eventId);
		return {
			sessions,
			prints: {
				sent: job("sent")?.copies ?? 0,
				pending: (job("queued")?.n ?? 0) + (job("sending")?.n ?? 0),
				failed: (job("failed")?.n ?? 0) + (job("needs_check")?.n ?? 0),
				...lastPrintError ? { lastError: lastPrintError.e } : {}
			},
			uploads: {
				done: up("done"),
				pending: up("pending") + up("uploading"),
				failed: up("failed"),
				...lastUploadError ? { lastError: lastUploadError.e } : {}
			}
		};
	}
	deleteEvent(id) {
		this.db.prepare("DELETE FROM events WHERE id = ?").run(id);
	}
	mapSession(r) {
		return {
			id: r.id,
			eventId: r.event_id,
			status: r.status,
			photoPaths: JSON.parse(r.photo_paths),
			compositePath: r.composite_path ?? void 0,
			printPath: r.print_path ?? void 0,
			gifPath: r.gif_path ?? void 0,
			galleryUrl: r.gallery_url ?? void 0,
			createdAt: r.created_at
		};
	}
	createSession(eventId) {
		const s = {
			id: (0, node_crypto.randomUUID)(),
			eventId,
			status: "capturing",
			photoPaths: [],
			createdAt: now()
		};
		this.db.prepare("INSERT INTO sessions (id, event_id, status, photo_paths, created_at) VALUES (?, ?, ?, ?, ?)").run(s.id, eventId, s.status, "[]", s.createdAt);
		return s;
	}
	getSession(id) {
		const r = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
		return r ? this.mapSession(r) : void 0;
	}
	listSessions(eventId, limit = 200) {
		return this.db.prepare("SELECT * FROM sessions WHERE event_id = ? ORDER BY created_at DESC LIMIT ?").all(eventId, limit).map((r) => this.mapSession(r));
	}
	updateSession(id, patch) {
		const cur = this.getSession(id);
		if (!cur) throw new Error("Session not found");
		const next = {
			...cur,
			...patch
		};
		this.db.prepare("UPDATE sessions SET status=?, photo_paths=?, composite_path=?, print_path=?, gif_path=?, gallery_url=? WHERE id=?").run(next.status, JSON.stringify(next.photoPaths), next.compositePath ?? null, next.printPath ?? null, next.gifPath ?? null, next.galleryUrl ?? null, id);
	}
	mapJob(r) {
		return {
			id: r.id,
			sessionId: r.session_id,
			filePath: r.file_path,
			format: r.format,
			copies: r.copies,
			status: r.status,
			attempts: r.attempts,
			lastError: r.last_error ?? void 0,
			createdAt: r.created_at,
			updatedAt: r.updated_at
		};
	}
	/**
	* Idempotent: the same (sessionId, requestKey) returns the existing job instead of creating a duplicate.
	* The UI passes a key per button press, so a double-tap or an IPC retry can't print twice.
	*/
	insertPrintJob(sessionId, requestKey, filePath, format, copies) {
		const existing = this.db.prepare("SELECT * FROM print_jobs WHERE session_id = ? AND request_key = ?").get(sessionId, requestKey);
		if (existing) return this.mapJob(existing);
		const t = now();
		const id = (0, node_crypto.randomUUID)();
		this.db.prepare("INSERT INTO print_jobs (id, session_id, request_key, file_path, format, copies, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)").run(id, sessionId, requestKey, filePath, format, copies, t, t);
		return this.getPrintJob(id);
	}
	getPrintJob(id) {
		const r = this.db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(id);
		return r ? this.mapJob(r) : void 0;
	}
	listPrintJobs(limit = 100) {
		return this.db.prepare("SELECT * FROM print_jobs ORDER BY created_at DESC LIMIT ?").all(limit).map((r) => this.mapJob(r));
	}
	nextQueuedPrintJob() {
		const r = this.db.prepare("SELECT * FROM print_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1").get();
		return r ? this.mapJob(r) : void 0;
	}
	/** Compare-and-set so two workers (or a crash/restart) can't both send the same job. */
	transitionPrintJob(id, from, to, extra = {}) {
		const placeholders = from.map(() => "?").join(",");
		return this.db.prepare(`UPDATE print_jobs SET status = ?, updated_at = ?, last_error = COALESCE(?, last_error), attempts = attempts + ? WHERE id = ? AND status IN (${placeholders})`).run(to, now(), extra.error ?? null, extra.incAttempts ? 1 : 0, id, ...from).changes === 1;
	}
	/** On startup: a job left in 'sending' may or may not have printed — make the operator decide. */
	flagInterruptedPrintJobs() {
		return this.db.prepare("UPDATE print_jobs SET status = 'needs_check', last_error = 'App closed while sending — check the printer before reprinting', updated_at = ? WHERE status = 'sending'").run(now()).changes;
	}
	mapUpload(r) {
		return {
			id: r.id,
			sessionId: r.session_id,
			filePath: r.file_path,
			status: r.status,
			attempts: r.attempts,
			nextAttemptAt: r.next_attempt_at,
			url: r.url ?? void 0,
			lastError: r.last_error ?? void 0
		};
	}
	enqueueUpload(sessionId, filePath) {
		this.db.prepare("INSERT INTO uploads (id, session_id, file_path, status, next_attempt_at) VALUES (?, ?, ?, 'pending', ?) ON CONFLICT(session_id) DO NOTHING").run((0, node_crypto.randomUUID)(), sessionId, filePath, now());
		return this.mapUpload(this.db.prepare("SELECT * FROM uploads WHERE session_id = ?").get(sessionId));
	}
	dueUploads(at, limit = 5) {
		return this.db.prepare("SELECT * FROM uploads WHERE status IN ('pending','failed') AND next_attempt_at <= ? ORDER BY next_attempt_at LIMIT ?").all(at.toISOString(), limit).map((r) => this.mapUpload(r));
	}
	updateUpload(id, patch) {
		this.db.prepare("UPDATE uploads SET status = ?, url = COALESCE(?, url), last_error = ?, next_attempt_at = COALESCE(?, next_attempt_at), attempts = attempts + ? WHERE id = ?").run(patch.status, patch.url ?? null, patch.error ?? null, patch.nextAttemptAt?.toISOString() ?? null, patch.incAttempts ? 1 : 0, id);
	}
	resetStuckUploads() {
		this.db.prepare("UPDATE uploads SET status = 'pending' WHERE status = 'uploading'").run();
	}
	uploadStats() {
		const rows = this.db.prepare("SELECT status, COUNT(*) AS n FROM uploads GROUP BY status").all();
		const get = (s) => rows.find((r) => r.status === s)?.n ?? 0;
		return {
			pending: get("pending") + get("uploading"),
			failed: get("failed"),
			done: get("done")
		};
	}
};
// src/main/printer/MockPrinter.ts
/** Development printer: "prints" by copying the sheet into a folder so you can inspect it. */
var MockPrinter = class {
	outDir;
	delayMs;
	driver = "mock";
	failNext = false;
	constructor(outDir, delayMs = 1500) {
		this.outDir = outDir;
		this.delayMs = delayMs;
	}
	async print(req) {
		await new Promise((r) => setTimeout(r, this.delayMs));
		if (this.failNext) {
			this.failNext = false;
			throw new Error("Mock printer: simulated paper jam");
		}
		await (0, node_fs_promises.mkdir)(this.outDir, { recursive: true });
		for (let i = 0; i < req.copies; i++) await (0, node_fs_promises.copyFile)(req.filePath, (0, node_path.join)(this.outDir, `${req.jobName}-copy${i + 1}-${(0, node_path.basename)(req.filePath)}`));
	}
	async getStatus() {
		return {
			driver: this.driver,
			state: "ready",
			printerName: `Folder: ${this.outDir}`
		};
	}
	async listPrinters() {
		return ["Mock printer (saves to folder)"];
	}
};
// src/main/printer/WindowsPrinter.ts
var run = (0, node_util.promisify)(node_child_process.execFile);
var MICRONS_PER_INCH = 25400;
/**
* Prints through the installed Windows driver (DNP's official driver), using Chromium's
* silent print path. No direct printer protocol work — the driver owns colour, cut and media.
*
* NOT YET PROVEN ON HARDWARE: verify scaling (must be 100%, no white border) and both
* queues with a real DS-RX1HS before relying on this at an event.
*/
var WindowsPrinter = class {
	getSettings;
	driver = "windows-driver";
	constructor(getSettings) {
		this.getSettings = getSettings;
	}
	queueFor(format) {
		const s = this.getSettings();
		return format === "2x6" ? s.printerName2x6 : s.printerName4x6;
	}
	async print(req) {
		const deviceName = this.queueFor(req.format);
		const jpeg = await (0, node_fs_promises.readFile)(req.filePath);
		const wMm = SHEET.w / 300 * 25.4;
		const hMm = SHEET.h / 300 * 25.4;
		const html = `<!doctype html><html><head><style>
      @page { size: ${wMm}mm ${hMm}mm; margin: 0 }
      html, body { margin: 0; padding: 0; width: ${wMm}mm; height: ${hMm}mm; overflow: hidden }
      img { display: block; width: ${wMm}mm; height: ${hMm}mm }
    </style></head><body><img src="data:image/jpeg;base64,${jpeg.toString("base64")}"></body></html>`;
		const win = new electron.BrowserWindow({
			show: false,
			webPreferences: {
				offscreen: true,
				javascript: false
			}
		});
		try {
			await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString("base64")}`);
			await new Promise((resolve, reject) => {
				win.webContents.print({
					silent: true,
					deviceName,
					copies: req.copies,
					printBackground: true,
					color: true,
					landscape: false,
					margins: { marginType: "none" },
					pageSize: {
						width: Math.round(SHEET.w / 300 * MICRONS_PER_INCH),
						height: Math.round(SHEET.h / 300 * MICRONS_PER_INCH)
					}
				}, (ok, reason) => ok ? resolve() : reject(/* @__PURE__ */ new Error(`Print failed on "${deviceName}": ${reason}`)));
			});
		} finally {
			win.destroy();
		}
	}
	async listPrinters() {
		const win = electron.BrowserWindow.getAllWindows()[0];
		if (!win) return [];
		return (await win.webContents.getPrintersAsync()).map((p) => p.name);
	}
	async getStatus() {
		const name = this.getSettings().printerName4x6;
		if (process.platform !== "win32") return {
			driver: this.driver,
			state: "error",
			printerName: name,
			message: "Windows driver printing only works on Windows."
		};
		try {
			const { stdout } = await run("powershell.exe", [
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				`& {param(\$n) \$p = Get-Printer -Name \$n -ErrorAction Stop; [pscustomobject]@{ status = "\$(\$p.PrinterStatus)"; jobs = \$p.JobCount } | ConvertTo-Json -Compress} '${name.replace(/'/g, "''")}'`
			], {
				timeout: 8e3,
				windowsHide: true
			});
			const info = JSON.parse(stdout.trim());
			const ok = /normal|idle|printing|0/i.test(info.status);
			return {
				driver: this.driver,
				state: ok ? info.jobs > 0 ? "busy" : "ready" : "error",
				printerName: name,
				message: ok ? info.jobs ? `${info.jobs} job(s) in Windows queue` : void 0 : `Printer reports: ${info.status}`
			};
		} catch (e) {
			return {
				driver: this.driver,
				state: "disconnected",
				printerName: name,
				message: `Printer "${name}" not found or offline`
			};
		}
	}
};
// src/main/queue/PrintQueue.ts
/**
* Persistent, one-at-a-time print queue.
*
* Duplicate protection:
*  - enqueue is idempotent per (session, requestKey)
*  - a job moves queued → sending → sent|failed via compare-and-set
*  - failed jobs are never retried automatically; the operator presses Retry
*  - jobs interrupted mid-send become needs_check on restart (they may have printed)
*/
var PrintQueue = class extends node_events.EventEmitter {
	db;
	getPrinter;
	running = false;
	stopped = false;
	constructor(db, getPrinter) {
		super();
		this.db = db;
		this.getPrinter = getPrinter;
		if (db.flagInterruptedPrintJobs()) this.emit("changed");
	}
	enqueue(sessionId, requestKey, filePath, format, copies) {
		const job = this.db.insertPrintJob(sessionId, requestKey, filePath, format, copies);
		this.emit("changed");
		this.drain();
		return job;
	}
	/** Operator-initiated only. */
	retry(jobId) {
		const ok = this.db.transitionPrintJob(jobId, ["failed", "needs_check"], "queued");
		if (ok) {
			this.emit("changed");
			this.drain();
		}
		return ok;
	}
	cancel(jobId) {
		const ok = this.db.transitionPrintJob(jobId, [
			"queued",
			"failed",
			"needs_check"
		], "cancelled");
		if (ok) this.emit("changed");
		return ok;
	}
	/** Operator confirms an interrupted job did print. */
	markPrinted(jobId) {
		const ok = this.db.transitionPrintJob(jobId, ["needs_check", "failed"], "sent");
		if (ok) this.emit("changed");
		return ok;
	}
	pendingCount() {
		return this.db.listPrintJobs(500).filter((j) => j.status === "queued" || j.status === "sending").length;
	}
	stop() {
		this.stopped = true;
	}
	/** Processes queued jobs sequentially. Safe to call repeatedly. Resolves when the queue is empty. */
	async drain() {
		if (this.running) return;
		this.running = true;
		try {
			while (!this.stopped) {
				const job = this.db.nextQueuedPrintJob();
				if (!job) break;
				if (!this.db.transitionPrintJob(job.id, ["queued"], "sending", { incAttempts: true })) continue;
				this.emit("changed");
				try {
					await this.getPrinter().print({
						filePath: job.filePath,
						format: job.format,
						copies: job.copies,
						jobName: `booth-${job.id.slice(0, 8)}`
					});
					this.db.transitionPrintJob(job.id, ["sending"], "sent");
				} catch (e) {
					this.db.transitionPrintJob(job.id, ["sending"], "failed", { error: e instanceof Error ? e.message : String(e) });
					this.emit("jobFailed", job.id, e);
				}
				this.emit("changed");
			}
		} finally {
			this.running = false;
		}
	}
};
// src/main/queue/UploadQueue.ts
/** Exponential backoff capped at 15 minutes: 15s, 30s, 1m, 2m, 4m ... */
function backoffMs(attempts) {
	return Math.min(9e5, 15e3 * 2 ** Math.max(0, attempts - 1));
}
/**
* Background uploader. Uploads never block capture or printing; if the venue has no
* internet, sessions stay pending and go up when connectivity returns.
*/
var UploadQueue = class extends node_events.EventEmitter {
	db;
	gallery;
	intervalMs;
	timer;
	busy = false;
	constructor(db, gallery, intervalMs = 1e4) {
		super();
		this.db = db;
		this.gallery = gallery;
		this.intervalMs = intervalMs;
		db.resetStuckUploads();
	}
	start() {
		if (!this.gallery.enabled || this.timer) return;
		this.timer = setInterval(() => void this.tick(), this.intervalMs);
		this.tick();
	}
	stop() {
		if (this.timer) clearInterval(this.timer);
		this.timer = void 0;
	}
	enqueue(sessionId, filePath) {
		if (!this.gallery.enabled) return;
		this.db.enqueueUpload(sessionId, filePath);
		this.tick();
	}
	async tick(now = /* @__PURE__ */ new Date()) {
		if (this.busy) return;
		this.busy = true;
		try {
			for (const job of this.db.dueUploads(now)) {
				const session = this.db.getSession(job.sessionId);
				if (!session) continue;
				this.db.updateUpload(job.id, { status: "uploading" });
				try {
					const url = await this.gallery.upload(session.id, session.eventId, job.filePath);
					this.db.updateUpload(job.id, {
						status: "done",
						url,
						incAttempts: true
					});
					this.db.updateSession(session.id, { galleryUrl: url });
					this.emit("uploaded", session.id, url);
				} catch (e) {
					const attempts = job.attempts + 1;
					this.db.updateUpload(job.id, {
						status: "failed",
						error: e instanceof Error ? e.message : String(e),
						nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
						incAttempts: true
					});
				}
				this.emit("changed");
			}
		} finally {
			this.busy = false;
		}
	}
};
// src/main/index.ts
if (!electron.app.requestSingleInstanceLock()) electron.app.quit();
var userData = electron.app.getPath("userData");
var dataDir = (0, node_path.join)(electron.app.getPath("documents"), "SnapDesk Booth");
var logFile = (0, node_path.join)(userData, "logs", "booth.log");
async function log(level, msg) {
	const line = `${(/* @__PURE__ */ new Date()).toISOString()} [${level}] ${msg}\n`;
	if (level === "error") console.error(line.trim());
	await (0, node_fs_promises.mkdir)((0, node_path.join)(userData, "logs"), { recursive: true }).catch(() => void 0);
	await (0, node_fs_promises.appendFile)(logFile, line).catch(() => void 0);
}
process.on("uncaughtException", (e) => void log("error", `uncaught: ${e.stack ?? e}`));
process.on("unhandledRejection", (e) => void log("error", `unhandled rejection: ${e instanceof Error ? e.stack : e}`));
/** Minimal .env reader: operator config lives next to the database, never inside the installer. */
function loadEnv(file) {
	if (!(0, node_fs.existsSync)(file)) return;
	for (const line of (0, node_fs.readFileSync)(file, "utf8").split(/\r?\n/)) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
		if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
	}
}
var win = null;
var db;
var camera;
var printer;
var printQueue;
var uploadQueue;
var service;
var pinLock;
var gallery = (() => {
	loadEnv((0, node_path.join)(userData, ".env"));
	loadEnv((0, node_path.join)(process.cwd(), ".env"));
	return galleryFromEnv(process.env);
})();
function bridgePath() {
	return electron.app.isPackaged ? (0, node_path.join)(process.resourcesPath, "canon-bridge", "CanonBridge.exe") : (0, node_path.join)(electron.app.getAppPath(), "native", "CanonBridge", "publish", "CanonBridge.exe");
}
function makeCamera(s) {
	const cam = s.cameraDriver === "canon-edsdk" ? new CanonBridgeCamera(bridgePath()) : new MockCamera();
	cam.on("status", () => void broadcastDevices());
	cam.on("log", (m) => void log("info", `camera: ${m.trim()}`));
	cam.on("exposure", () => win?.webContents.send("booth:exposure"));
	return cam;
}
function makePrinter(s) {
	return s.printerDriver === "windows-driver" ? new WindowsPrinter(() => db.getDeviceSettings()) : new MockPrinter((0, node_path.join)(dataDir, "mock-prints"));
}
async function connectCamera() {
	try {
		await camera.connect();
		await log("info", `camera connected: ${camera.getStatus().model}`);
	} catch (e) {
		await log("warn", `camera connect failed: ${e instanceof Error ? e.message : e}`);
		return;
	}
	await applyEventExposure();
}
/** Puts the active event's saved exposure back on the camera (after a reconnect or switching events). */
async function applyEventExposure() {
	const id = db.getActiveEventId();
	const wanted = id ? db.getEvent(id)?.exposure : void 0;
	if (!wanted || camera.getStatus().state !== "ready") return;
	try {
		const { skipped } = await applyExposure(camera, wanted);
		if (skipped.length) await log("warn", `camera exposure not applied for ${skipped.join(", ")} (mode dial not on M?)`);
		win?.webContents.send("booth:exposure");
	} catch (e) {
		await log("warn", `camera exposure: ${e instanceof Error ? e.message : e}`);
	}
}
/** Remembers the camera's exposure on an event (default: the active one), so it is re-applied next time. */
function rememberExposure(current, eventId = db.getActiveEventId()) {
	if (eventId && db.getEvent(eventId)) db.saveEventExposure(eventId, current);
}
var TEST_SHOTS_KEPT = 12;
async function testShot() {
	const settings = (await camera.getExposure().catch(() => null))?.current ?? {};
	const dir = (0, node_path.join)(userData, "testshots");
	const path = await camera.capture(dir);
	const old = (await (0, node_fs_promises.readdir)(dir)).sort().reverse().slice(TEST_SHOTS_KEPT);
	await Promise.all(old.map((f) => (0, node_fs_promises.rm)((0, node_path.join)(dir, f), { force: true })));
	return {
		path,
		preview: await previewDataUrl(path, 1600),
		settings,
		...await analyzeShot(path),
		takenAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
async function devices() {
	const p = await printer.getStatus().catch((e) => ({
		driver: printer.driver,
		state: "error",
		message: String(e)
	}));
	return {
		camera: camera.getStatus(),
		printer: {
			...p,
			queueLength: printQueue.pendingCount()
		},
		uploads: {
			enabled: gallery.enabled,
			...db.uploadStats()
		}
	};
}
var shuttingDown = false;
var devicesTimer;
async function broadcastDevices() {
	if (shuttingDown || !win || win.isDestroyed()) return;
	try {
		const snapshot = await devices();
		if (!shuttingDown && !win.isDestroyed()) win.webContents.send("booth:devices", snapshot);
	} catch (e) {
		if (!shuttingDown) throw e;
	}
}
function handle(name, fn) {
	electron.ipcMain.handle(`booth:${name}`, async (_e, ...args) => {
		try {
			return await fn(...args);
		} catch (e) {
			await log("error", `${name}: ${e instanceof Error ? e.stack : e}`);
			throw e;
		}
	});
}
/** Placeholder photos so templates can be previewed and test-printed without a camera. */
async function sampleShots(n) {
	const cam = new MockCamera({
		w: 900,
		h: 600
	});
	await cam.connect();
	const dir = (0, node_path.join)(userData, "template-previews");
	const shots = [];
	for (let i = 0; i < n; i++) shots.push(await cam.capture(dir));
	return shots;
}
var IMPORTED_ID = /^imported-[0-9a-f]{8}$/;
/** Imported artwork always lives at a path derived from the template id, so the renderer never supplies file paths. */
function artworkPath(id) {
	if (!IMPORTED_ID.test(id)) throw new Error("Not an imported template.");
	return (0, node_path.join)(userData, "templates", `${id}.png`);
}
/** Rebuilds an imported template from renderer data, keeping only the fields the editor may change. */
function cleanImported(t) {
	if (!["2x6", "4x6"].includes(t.format) || !["portrait", "landscape"].includes(t.orientation)) throw new Error("Unknown print layout.");
	const path = artworkPath(t.id);
	return {
		id: t.id,
		name: String(t.name ?? "").trim().slice(0, 80),
		format: t.format,
		orientation: t.format === "2x6" ? "portrait" : t.orientation,
		background: "#ffffff",
		...t.overlayPath ? { overlayPath: path } : { backgroundPath: path },
		slots: (t.slots ?? []).map((s) => ({
			x: Math.round(s.x),
			y: Math.round(s.y),
			w: Math.round(s.w),
			h: Math.round(s.h)
		})),
		texts: []
	};
}
async function artworkPreview(input) {
	return `data:image/png;base64,${(await (0, sharp.default)(input).resize({
		width: 480,
		withoutEnlargement: true
	}).png().toBuffer()).toString("base64")}`;
}
var LAYOUT_LABEL = {
	"2x6": "2×6 strip",
	"4x6": "4×6"
};
async function prepareTemplateImport(src, opts = {}) {
	if (!/\.(png|jpe?g|webp)$/i.test(src)) throw new Error("Use a PNG or JPG file.");
	const meta = await (0, sharp.default)(src).metadata().catch(() => {
		throw new Error("Couldn't read that file. Export your design as a PNG or JPG and try again.");
	});
	if (!meta.width || !meta.height) throw new Error("Couldn't read the size of that image.");
	const [w, h] = (meta.orientation ?? 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
	const layout = opts.format ? {
		format: opts.format,
		orientation: opts.format === "2x6" ? "portrait" : opts.orientation ?? "portrait"
	} : guessLayout(w, h);
	const fit = opts.fit ?? suggestFit(w, h, layout);
	const id = opts.draftId && IMPORTED_ID.test(opts.draftId) ? opts.draftId : `imported-${(0, node_crypto.randomUUID)().slice(0, 8)}`;
	const png = await normalizeArtwork(src, layout, fit);
	const found = await detectSlots(png);
	await (0, node_fs_promises.mkdir)((0, node_path.join)(userData, "templates"), { recursive: true });
	await (0, node_fs_promises.writeFile)(artworkPath(id), png);
	const size = canvasSize(layout.format, layout.orientation);
	const notes = [];
	if (suggestFit(w, h, layout) === "fit") notes.push(`This design is a different shape from a ${LAYOUT_LABEL[layout.format]} print. Check the fit below.`);
	if (Math.max(w, h) < Math.max(size.w, size.h) * .7) notes.push(`The image is small (${w}×${h}) and may print soft. Export at ${size.w}×${size.h} or larger if you can.`);
	return {
		template: {
			id,
			name: (0, node_path.basename)(src, (0, node_path.extname)(src)).slice(0, 80),
			format: layout.format,
			orientation: layout.orientation,
			background: "#ffffff",
			...found.layer === "over" ? { overlayPath: artworkPath(id) } : { backgroundPath: artworkPath(id) },
			slots: found.slots.length ? found.slots : defaultSlots(layout),
			texts: []
		},
		artwork: await artworkPreview(png),
		source: {
			fileName: (0, node_path.basename)(src),
			width: w,
			height: h
		},
		fit,
		detection: found.method,
		notes
	};
}
function registerIpc() {
	handle("getActiveEvent", () => {
		const id = db.getActiveEventId();
		const event = id ? db.getEvent(id) : void 0;
		const template = event ? db.getTemplate(event.templateId) : void 0;
		return event && template ? {
			event,
			template
		} : null;
	});
	handle("startSession", () => service.startSession());
	handle("capture", (sessionId) => service.capture(sessionId));
	handle("finish", (sessionId, paths, key) => service.finish(sessionId, paths, key));
	handle("reprint", (sessionId, key, copies) => service.reprint(sessionId, key, copies));
	handle("galleryList", () => service.galleryList());
	handle("galleryItem", (sessionId) => service.galleryItem(sessionId));
	handle("liveViewStart", () => camera.startLiveView());
	handle("liveViewFrame", async () => {
		const f = await camera.getLiveViewFrame();
		return f ? `data:image/jpeg;base64,${f.toString("base64")}` : null;
	});
	handle("liveViewStop", () => camera.stopLiveView());
	handle("listEvents", () => db.listEvents());
	handle("duplicateEvent", (id) => db.duplicateEvent(id));
	handle("eventStats", (id) => db.eventStats(id));
	handle("exportEventPhotos", async (eventId, originals) => {
		const res = await electron.dialog.showOpenDialog(win, {
			title: "Export photos to…",
			properties: ["openDirectory", "createDirectory"],
			buttonLabel: "Export here"
		});
		if (res.canceled || !res.filePaths[0]) return null;
		const out = await exportEventPhotos(db, eventId, res.filePaths[0], { originals });
		electron.shell.openPath(out.folder);
		return out;
	});
	handle("hasPin", () => pinLock.hasPin());
	handle("verifyPin", (pin) => pinLock.verify(String(pin)));
	handle("setPin", (current, next) => pinLock.setPin(current, next));
	handle("saveEvent", (e) => db.saveEvent(e));
	handle("deleteEvent", (id) => db.deleteEvent(id));
	handle("setActiveEvent", (id) => {
		if (!db.getEvent(id)) throw new Error("Unknown event");
		db.setActiveEventId(id);
		applyEventExposure();
	});
	handle("listTemplates", () => db.listTemplates());
	handle("previewTemplate", async (templateId, eventName) => {
		const t = db.getTemplate(templateId);
		if (!t) throw new Error("Unknown template");
		const { composite } = await compose({
			template: t,
			photoPaths: await sampleShots(t.slots.length),
			eventName: eventName || "Your Event"
		});
		return previewDataUrl(composite, 520);
	});
	handle("chooseTemplateFile", async () => {
		const res = await electron.dialog.showOpenDialog(win, {
			title: "Import a design",
			properties: ["openFile"],
			filters: [{
				name: "Designs (PNG, JPG)",
				extensions: [
					"png",
					"jpg",
					"jpeg",
					"webp"
				]
			}]
		});
		return res.canceled ? null : res.filePaths[0] ?? null;
	});
	handle("prepareTemplateImport", (src, opts) => prepareTemplateImport(src, opts));
	handle("getTemplateArtwork", async (id) => {
		const t = db.getTemplate(id);
		const path = t?.overlayPath ?? t?.backgroundPath;
		return path && (0, node_fs.existsSync)(path) ? artworkPreview(path) : null;
	});
	handle("saveTemplate", (t) => {
		const clean = cleanImported(t);
		if (!clean.name) throw new Error("Give the template a name.");
		if (!(0, node_fs.existsSync)(artworkPath(clean.id))) throw new Error("The design file is missing. Import it again.");
		const errors = validateTemplate(clean).filter((i) => i.level === "error");
		if (errors.length) throw new Error(errors.map((e) => e.message).join(" "));
		return db.saveTemplate(clean);
	});
	handle("deleteTemplate", async (id) => {
		db.deleteTemplate(id);
		if (IMPORTED_ID.test(id)) await (0, node_fs_promises.rm)(artworkPath(id), { force: true });
	});
	handle("discardTemplateDraft", async (id) => {
		if (IMPORTED_ID.test(id) && !db.getTemplate(id)) await (0, node_fs_promises.rm)(artworkPath(id), { force: true });
	});
	handle("previewTemplateDraft", async (t, eventName) => {
		const clean = cleanImported(t);
		const { composite } = await compose({
			template: clean,
			photoPaths: await sampleShots(clean.slots.length),
			eventName: eventName || "Your Event"
		});
		return previewDataUrl(composite, 520);
	});
	handle("testPrintTemplate", async (t) => {
		const template = IMPORTED_ID.test(t.id) ? cleanImported(t) : db.getTemplate(t.id);
		if (!template) throw new Error("Unknown template");
		const { printSheet } = await compose({
			template,
			photoPaths: await sampleShots(template.slots.length),
			eventName: "Test print"
		});
		const file = (0, node_path.join)(userData, "test-template.jpg");
		await (0, node_fs_promises.writeFile)(file, printSheet);
		await printer.print({
			filePath: file,
			format: template.format,
			copies: 1,
			jobName: "test-template"
		});
		return file;
	});
	handle("listSessions", (eventId) => db.listSessions(eventId));
	handle("openEventFolder", async () => {
		await (0, node_fs_promises.mkdir)((0, node_path.join)(dataDir, "events"), { recursive: true });
		await electron.shell.openPath((0, node_path.join)(dataDir, "events"));
	});
	handle("getDeviceSettings", () => db.getDeviceSettings());
	handle("saveDeviceSettings", async (s) => {
		const prev = db.getDeviceSettings();
		db.saveDeviceSettings(s);
		if (prev.cameraDriver !== s.cameraDriver) {
			await camera.disconnect().catch(() => void 0);
			camera = makeCamera(s);
			connectCamera();
		}
		if (prev.printerDriver !== s.printerDriver) printer = makePrinter(s);
		await broadcastDevices();
	});
	handle("listPrinters", () => printer.listPrinters());
	handle("reconnectCamera", async () => {
		await camera.disconnect().catch(() => void 0);
		await connectCamera();
	});
	handle("getDevices", () => devices());
	handle("getExposure", () => readExposure(camera));
	handle("setExposure", async (key, value, eventId) => {
		if (key === "shutter" && !flashSafe([value]).length) throw new Error(`${value} is faster than the flash can sync.`);
		const state = withFlashSafeShutters(await camera.setExposure(key, value));
		rememberExposure(state.current, eventId);
		return state;
	});
	handle("applyExposure", async (settings, eventId) => {
		const res = await applyExposure(camera, settings);
		rememberExposure(res.state.current, eventId);
		return res;
	});
	handle("testShot", () => testShot());
	handle("listPrintJobs", () => db.listPrintJobs());
	handle("retryPrintJob", (id) => printQueue.retry(id));
	handle("cancelPrintJob", (id) => printQueue.cancel(id));
	handle("markPrintJobPrinted", (id) => printQueue.markPrinted(id));
	handle("testPrint", async (format) => {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}" height="${SHEET.h}">
      <rect width="100%" height="100%" fill="#fff"/>
      <rect x="4" y="4" width="${SHEET.w - 8}" height="${SHEET.h - 8}" fill="none" stroke="#e00" stroke-width="8"/>
      <rect x="36" y="36" width="${SHEET.w - 72}" height="${SHEET.h - 72}" fill="none" stroke="#06c" stroke-width="4" stroke-dasharray="20 12"/>
      ${format === "2x6" ? `<line x1="${SHEET.w / 2}" y1="0" x2="${SHEET.w / 2}" y2="${SHEET.h}" stroke="#0a0" stroke-width="4"/>` : ""}
      <text x="50%" y="48%" text-anchor="middle" font-size="64" font-family="Arial" font-weight="bold">TEST ${format}</text>
      <text x="50%" y="53%" text-anchor="middle" font-size="34" font-family="Arial">${SHEET.w}×${SHEET.h}px @300dpi · ${(/* @__PURE__ */ new Date()).toLocaleString("en-GB")}</text>
      <text x="50%" y="58%" text-anchor="middle" font-size="28" font-family="Arial" fill="#555">Red = sheet edge (may trim) · Blue = safe area · Green = 2" cut line</text>
    </svg>`;
		const file = (0, node_path.join)(userData, `test-${format}.jpg`);
		await (0, sharp.default)(Buffer.from(svg)).jpeg({ quality: 95 }).withMetadata({ density: 300 }).toFile(file);
		await printer.print({
			filePath: file,
			format,
			copies: 1,
			jobName: `test-${format}`
		});
		return file;
	});
	handle("appInfo", () => ({
		version: electron.app.getVersion(),
		dataDir,
		logFile
	}));
	handle("quit", () => electron.app.quit());
}
function createWindow() {
	win = new electron.BrowserWindow({
		width: 1280,
		height: 800,
		fullscreen: electron.app.isPackaged,
		autoHideMenuBar: true,
		backgroundColor: "#0b0b0f",
		webPreferences: {
			preload: (0, node_path.join)(__dirname, "../preload/index.js"),
			sandbox: false,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	win.webContents.on("will-navigate", (e) => e.preventDefault());
	win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
	win.webContents.on("render-process-gone", (_e, d) => void log("error", `renderer gone: ${d.reason}`));
	if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
	else win.loadFile((0, node_path.join)(__dirname, "../renderer/index.html"));
}
electron.app.on("second-instance", () => {
	if (win) {
		if (win.isMinimized()) win.restore();
		win.focus();
	}
});
electron.app.whenReady().then(async () => {
	await (0, node_fs_promises.mkdir)((0, node_path.join)(userData, "data"), { recursive: true });
	db = new BoothDatabase((0, node_path.join)(userData, "data", "booth.db"));
	const settings = db.getDeviceSettings();
	camera = makeCamera(settings);
	printer = makePrinter(settings);
	printQueue = new PrintQueue(db, () => printer);
	printQueue.on("changed", () => {
		win?.webContents.send("booth:printJobs");
		broadcastDevices();
	});
	printQueue.on("jobFailed", (id, e) => void log("error", `print job ${id} failed: ${e}`));
	uploadQueue = new UploadQueue(db, gallery);
	uploadQueue.on("changed", () => void broadcastDevices());
	pinLock = new PinLock(db);
	service = new BoothService({
		db,
		dataDir,
		camera: () => camera,
		printQueue,
		uploadQueue,
		gallery,
		log: (level, m) => void log(level, m)
	});
	registerIpc();
	createWindow();
	electron.powerSaveBlocker.start("prevent-display-sleep");
	connectCamera();
	printQueue.drain();
	uploadQueue.start();
	devicesTimer = setInterval(() => void broadcastDevices(), 5e3);
	await log("info", `started v${electron.app.getVersion()} · gallery ${gallery.enabled ? "on" : "off"}`);
});
electron.app.on("window-all-closed", () => electron.app.quit());
electron.app.on("before-quit", () => {
	shuttingDown = true;
	clearInterval(devicesTimer);
	printQueue?.stop();
	uploadQueue?.stop();
	camera?.disconnect();
	db?.close();
});
