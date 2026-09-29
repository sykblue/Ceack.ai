import {defineConfig, loadEnv} from 'vite';
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxy = {'/api': {target: `http://127.0.0.1:${env.API_PORT || 3001}`, changeOrigin: true}};
  return {server: {host: '127.0.0.1', port: 5187, strictPort: true, proxy}, preview: {host:'127.0.0.1', proxy}};
});
