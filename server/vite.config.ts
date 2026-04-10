import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        ssr: 'src/index.ts',
        outDir: 'dist',
        target: 'node24',
        rollupOptions: {
            external: ['ws'],
            output: {
                format: 'esm',
                entryFileNames: 'index.js',
            },
        },
    },
    ssr: {
        // Keep most dependencies bundled, but leave ws external because
        // bundling it breaks its bufferUtil runtime helpers in production builds.
        noExternal: true,
        external: ['ws'],
    },
})
