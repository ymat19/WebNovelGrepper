import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  console.log(env.VITE_PLATFORM === 'gh-pages' ? '/WebNovelGrepper/' : '/')

  return {
    plugins: [react(), tsconfigPaths()],
    base: 'hoge', // モードで切り替え
  };
});