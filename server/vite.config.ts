import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        ssr: 'src/index.ts',
        outDir: 'dist',
        target: 'node24',
        rollupOptions: {
            output: {
                format: 'esm',
                entryFileNames: 'index.js',
            },
        },
    },
    ssr: {
        // Bundle all dependencies into the single output file so
        // no node_modules installation is needed in the release directory.
        noExternal: true,
    },
})
