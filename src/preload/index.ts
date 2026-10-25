import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { BoothApi, DeviceSnapshot } from '../shared/api'

const invoke = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const methods = [
  'getActiveEvent', 'startSession', 'capture', 'finish', 'reprint', 'liveViewStart', 'liveViewFrame', 'liveViewStop', 'galleryList', 'galleryItem',
  'listEvents', 'saveEvent', 'deleteEvent', 'setActiveEvent', 'listTemplates', 'previewTemplate', 'listSessions', 'openEventFolder',
  'chooseTemplateFile', 'prepareTemplateImport', 'getTemplateArtwork', 'saveTemplate', 'deleteTemplate', 'discardTemplateDraft',
  'previewTemplateDraft', 'testPrintTemplate',
  'getDeviceSettings', 'saveDeviceSettings', 'listPrinters', 'reconnectCamera', 'getDevices',
  'getExposure', 'setExposure', 'applyExposure', 'testShot',
  'duplicateEvent', 'eventStats', 'exportEventPhotos', 'hasPin', 'verifyPin', 'setPin',
  'listPrintJobs', 'retryPrintJob', 'cancelPrintJob', 'markPrintJobPrinted', 'testPrint', 'appInfo', 'quit'
] as const

const api = Object.fromEntries(methods.map((m) => [m, invoke(`booth:${m}`)])) as unknown as BoothApi

api.pathForFile = (file: File) => webUtils.getPathForFile(file)
api.onDevices = (cb: (d: DeviceSnapshot) => void) => {
  const listener = (_: unknown, d: DeviceSnapshot) => cb(d)
  ipcRenderer.on('booth:devices', listener)
  return () => ipcRenderer.removeListener('booth:devices', listener)
}
api.onExposure =(cb: () => void) => {
  const listener = () => cb()
  ipcRenderer.on('booth:exposure', listener)
  return () => ipcRenderer.removeListener('booth:exposure', listener)
}
api.onPrintJobs = (cb: () => void) => {
  const listener = () => cb()
  ipcRenderer.on('booth:printJobs', listener)
  return () => ipcRenderer.removeListener('booth:printJobs', listener)
}

contextBridge.exposeInMainWorld('booth', api)
