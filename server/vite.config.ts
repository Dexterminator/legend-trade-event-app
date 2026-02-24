import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        // SSR mode: externalises node_modules, emits a single CJS/ESM bundle
        ssr: 'src/index.ts',
        outDir: 'dist',
        target: 'node24',
        rollupOptions: {
            output: {
                format: 'esm',
                // Keep the entry as index.js for start_server.bat
                entryFileNames: 'index.js',
            },
        },
    },
})
