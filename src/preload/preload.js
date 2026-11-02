'use strict';
// Arayüze açılan tek köprü: dar, adlandırılmış çağrılar. Node/Electron nesnesi sızdırılmaz.

const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('cardfall', Object.freeze({
  getState: () => call('state:get'),
  onState: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const h = (_e, s) => cb(s);
    ipcRenderer.on('state', h);
    return () => ipcRenderer.removeListener('state', h);
  },
  setup: (pass) => call('auth:setup', pass),
  unlock: (pass) => call('auth:unlock', pass),
  lock: () => call('auth:lock'),
  setLanguage: (lang) => call('lang:set', lang),
  changePassphrase: (oldPass, newPass) => call('auth:change', oldPass, newPass),
  startLogin: () => call('login:start'),
  logout: () => call('account:logout'),
  wipe: (word) => call('account:wipe', word),
  toggle: () => call('farm:toggle'),
  refresh: () => call('farm:refresh'),
  pin: (appid) => call('farm:pin', appid),
  unpin: () => call('farm:unpin'),
  next: () => call('farm:next'),
  blacklist: (appid, on) => call('game:black', appid, on),
  setSettings: (patch) => call('settings:set', patch),
  hide: () => call('app:hide'),
  quit: () => call('app:quit'),
  activity: () => ipcRenderer.send('activity'),
}));
