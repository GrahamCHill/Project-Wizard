const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('appInfo', { electronVersion: process.versions.electron });
