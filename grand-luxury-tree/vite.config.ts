import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const PHOTO_GLOB_ID = 'virtual:photo-list';
const PHOTO_GLOB_ID_RESOLVED = `\0${PHOTO_GLOB_ID}`;
const PHOTO_DIR = path.resolve(__dirname, 'public/photos');

const photoListPlugin = () => ({
  name: 'photo-list',
  resolveId(id: string) {
    if (id === PHOTO_GLOB_ID) {
      return PHOTO_GLOB_ID_RESOLVED;
    }
    return null;
  },
  load(id: string) {
    if (id !== PHOTO_GLOB_ID_RESOLVED) return null;
    const files = fs.existsSync(PHOTO_DIR) ? fs.readdirSync(PHOTO_DIR) : [];
    const urls = files
      .filter((file) => /\.(jpe?g|png|webp|gif)$/i.test(file))
      .sort()
      .map((file) => `/photos/${file}`);
    return `export const photoUrls = ${JSON.stringify(urls)};`;
  },
  configureServer(server: { watcher: { add: (path: string) => void } }) {
    server.watcher.add(PHOTO_DIR);
  },
  handleHotUpdate({ file, server }: { file: string; server: { moduleGraph: { getModuleById: (id: string) => unknown; invalidateModule: (mod: unknown) => void } } }) {
    if (!file.startsWith(PHOTO_DIR)) return;
    const module = server.moduleGraph.getModuleById(PHOTO_GLOB_ID_RESOLVED);
    if (module) {
      server.moduleGraph.invalidateModule(module);
      return [module];
    }
  }
});

export default defineConfig({
  plugins: [react(), photoListPlugin()],
  server: {
    port: 5173
  }
});
