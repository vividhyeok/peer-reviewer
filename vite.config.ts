import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Custom Middleware for Local File System Access
// This allows the web app to read/write files directly to the project folder during development.
const localFileServer = () => ({
  name: 'local-file-server',
  // @ts-ignore
  configureServer(server) {
    // @ts-ignore
    server.middlewares.use('/api/fs', async (req, res, next) => {
      try {
        // @ts-ignore
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const endpoint = url.pathname; // e.g., /list, /file
        const query = Object.fromEntries(url.searchParams);
        
        // Base directory: project_root/paper-reader-data
        const dataDir = path.resolve(__dirname, 'paper-reader-data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // --- Helper: Safe Path Resolution ---
        const resolveSafePath = (userPath: string) => {
           // Prevent directory traversal
           const safePath = userPath.replace(/^(\.\.(\/|\\|$))+/, '');
           return path.join(dataDir, safePath);
        };

        // --- API: List Files ---
        if (endpoint === '/list' && req.method === 'GET') {
          const extensions = (query.ext || '').split(',').filter(Boolean).map(e => e.toLowerCase());
          
          const getAllFiles = (dir: string, fileList: string[] = [], relDir = '') => {
             const files = fs.readdirSync(dir);
             for (const file of files) {
               const filePath = path.join(dir, file);
               const relPath = relDir ? `${relDir}/${file}` : file;
               const stat = fs.statSync(filePath);
               
               if (stat.isDirectory()) {
                 getAllFiles(filePath, fileList, relPath);
               } else {
                 if (extensions.length === 0 || extensions.some(ext => file.toLowerCase().endsWith(ext))) {
                   fileList.push(relPath.replace(/\\/g, '/'));
                 }
               }
             }
             return fileList;
          };

          const files = getAllFiles(dataDir);
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(files));
          return;
        }

        // --- API: Read File ---
        if (endpoint === '/file' && req.method === 'GET') {
           const filePath = resolveSafePath(query.path);
           if (fs.existsSync(filePath)) {
             const content = fs.readFileSync(filePath); // Buffer
             // Determine content type (simple)
             if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
             else if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
             else res.setHeader('Content-Type', 'text/plain; charset=utf-8');
             
             res.end(content);
           } else {
             res.statusCode = 404;
             res.end('File not found');
           }
           return;
        }

        // --- API: Write File ---
        if (endpoint === '/file' && req.method === 'POST') {
           const filePath = resolveSafePath(query.path);
           const dirPath = path.dirname(filePath);
           
           if (!fs.existsSync(dirPath)) {
             fs.mkdirSync(dirPath, { recursive: true });
           }

           // @ts-ignore
           const chunks = [];
           // @ts-ignore
           req.on('data', chunk => chunks.push(chunk));
           req.on('end', () => {
             // @ts-ignore
             const buffer = Buffer.concat(chunks);
             fs.writeFileSync(filePath, buffer);
             res.end('OK');
           });
           return;
        }

        // --- API: Delete File ---
        if (endpoint === '/file' && req.method === 'DELETE') {
            const filePath = resolveSafePath(query.path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                res.end('OK');
            } else {
                res.statusCode = 404;
                res.end('Not Found');
            }
            return;
        }
        
        // --- API: Clear Cache (Special) ---
        if (endpoint === '/clear-cache' && req.method === 'POST') {
            const cacheDir = path.join(dataDir, 'cache');
            if (fs.existsSync(cacheDir)) {
                fs.rmSync(cacheDir, { recursive: true, force: true });
                fs.mkdirSync(cacheDir); // Recreate empty
            }
            res.end('OK');
            return;
        }

        next();
      } catch (e) {
        console.error('Local FS Error:', e);
        res.statusCode = 500;
        res.end(e instanceof Error ? e.message : 'Internal Server Error');
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localFileServer()],
  // Tauri settings
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: true,
    watch: {
        ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    chunkSizeWarningLimit: 1000,
  },
})
