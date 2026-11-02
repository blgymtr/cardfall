'use strict';
// Steam'e bağlanmadan arayüzü sahte verilerle açar (yalnızca geliştirme).
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const electron = require('electron');

const env = { ...process.env, CARDFALL_DEMO: '1', CARDFALL_USER_DATA: path.join(os.tmpdir(), 'cardfall-demo') };
delete env.ELECTRON_RUN_AS_NODE;
spawn(electron, [path.resolve(__dirname, '..')], { stdio: 'inherit', env });
