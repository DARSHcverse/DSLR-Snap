import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { BoothApi, DeviceSnapshot } from '../shared/api'
import type { AccountState } from '../shared/types'

const invoke = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const methods = [
  'getActiveEvent', 'startSession', 'capture', 'finish', 'reprint', 'liveViewStart', 'liveViewFrame', 'liveViewStop', 'galleryList', 'galleryItem',
  'listEvents', 'saveEvent', 'deleteEvent', 'setActiveEvent', 'listTemplates', 'previewTemplate', 'listSessions', 'openEventFolder',
  'chooseTemplateFile', 'prepareTemplateImport', 'getTemplateArtwork', 'saveTemplate', 'deleteTemplate', 'discardTemplateDraft',
  'previewTemplateDraft', 'testPrintTemplate',
  'getDeviceSettings', 'saveDeviceSettings', 'detectPrinters', 'reconnectCamera', 'getDevices',
  'getExposure', 'setExposure', 'applyExposure', 'testShot',
  'duplicateEvent', 'eventStats', 'exportEventPhotos', 'hasPin', 'verifyPin', 'setPin',
  'listPrintJobs', 'retryPrintJob', 'cancelPrintJob', 'markPrintJobPrinted', 'testPrint', 'eventGalleryLink', 'diskFree', 'appInfo', 'quit',
  'accountState', 'accountSignIn', 'accountRedeemCode', 'accountRefresh', 'accountSignOut', 'openAccountWebsite'
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

api.onAccount = (cb: (s: AccountState) => void) => {
  const listener = (_: unknown, s: AccountState) => cb(s)
  ipcRenderer.on('booth:account', listener)
  return () => ipcRenderer.removeListener('booth:account', listener)
}

api.onAccountError = (cb: (message: string) => void) => {
  const listener = (_: unknown, m: string) => cb(m)
  ipcRenderer.on('booth:accountError', listener)
  return () => ipcRenderer.removeListener('booth:accountError', listener)
}

contextBridge.exposeInMainWorld('booth', api)
