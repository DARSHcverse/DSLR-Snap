let electron = require("electron");
// src/preload/index.ts
var invoke = (channel) => (...args) => electron.ipcRenderer.invoke(channel, ...args);
var api = Object.fromEntries([
	"getActiveEvent",
	"startSession",
	"capture",
	"finish",
	"reprint",
	"liveViewStart",
	"liveViewFrame",
	"liveViewStop",
	"galleryList",
	"galleryItem",
	"listEvents",
	"saveEvent",
	"deleteEvent",
	"setActiveEvent",
	"listTemplates",
	"previewTemplate",
	"listSessions",
	"openEventFolder",
	"chooseTemplateFile",
	"prepareTemplateImport",
	"getTemplateArtwork",
	"saveTemplate",
	"deleteTemplate",
	"discardTemplateDraft",
	"previewTemplateDraft",
	"testPrintTemplate",
	"getDeviceSettings",
	"saveDeviceSettings",
	"listPrinters",
	"reconnectCamera",
	"getDevices",
	"getExposure",
	"setExposure",
	"applyExposure",
	"testShot",
	"duplicateEvent",
	"eventStats",
	"exportEventPhotos",
	"hasPin",
	"verifyPin",
	"setPin",
	"listPrintJobs",
	"retryPrintJob",
	"cancelPrintJob",
	"markPrintJobPrinted",
	"testPrint",
	"appInfo",
	"quit"
].map((m) => [m, invoke(`booth:${m}`)]));
api.pathForFile = (file) => electron.webUtils.getPathForFile(file);
api.onDevices = (cb) => {
	const listener = (_, d) => cb(d);
	electron.ipcRenderer.on("booth:devices", listener);
	return () => electron.ipcRenderer.removeListener("booth:devices", listener);
};
api.onExposure = (cb) => {
	const listener = () => cb();
	electron.ipcRenderer.on("booth:exposure", listener);
	return () => electron.ipcRenderer.removeListener("booth:exposure", listener);
};
api.onPrintJobs = (cb) => {
	const listener = () => cb();
	electron.ipcRenderer.on("booth:printJobs", listener);
	return () => electron.ipcRenderer.removeListener("booth:printJobs", listener);
};
electron.contextBridge.exposeInMainWorld("booth", api);
