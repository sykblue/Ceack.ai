import {spawn} from 'node:child_process';
const children = [spawn(process.execPath, ['--watch', 'server/index.js'], {stdio:'inherit'}), spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], {stdio:'inherit'})];
let stopping = false;
function stop(code = 0) { if(stopping) return; stopping = true; for(const child of children) child.kill('SIGTERM'); setTimeout(() => process.exit(code), 250).unref(); }
for(const child of children) { child.on('exit', code => stop(code || 0)); child.on('error', () => stop(1)); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
