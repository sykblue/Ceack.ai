import {loadEnvFile} from 'node:process';
import {createApp} from './app.js';
try { loadEnvFile(new URL('../.env', import.meta.url)); } catch (e) { if(e.code !== 'ENOENT') throw e; }
const port = Number(process.env.API_PORT || 3001);
const app = createApp({apiKey: process.env.GEMINI_API_KEY || '', model: process.env.GEMINI_MODEL || 'gemini-3.8-flash'});
app.listen(port, '127.0.0.1', () => console.log(`CEACK API: http://127.0.0.1:${port} (${process.env.GEMINI_API_KEY?.trim() ? '키 설정됨' : '키 미설정'})`));
app.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `API 포트 ${port}가 이미 사용 중입니다.` : 'API 서버를 시작하지 못했습니다.'); process.exit(1); });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => app.close(() => process.exit(0)));
