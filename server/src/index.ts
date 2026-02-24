import express from 'express'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWsServer, mockBroadcast } from './wsServer.js'
import { connectExternal, destroyExternal } from './wsExternal.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env['PORT'] ?? 5050)

// Served after `npm run build && export.sh` copies the Godot web export here
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public')

// ── Express ────────────────────────────────────────────────────────────────────
const app = express()
app.use(express.json())

// Serve Godot web export static files
app.use(express.static(PUBLIC_DIR))

// SPA fallback — let Godot's index.html handle all unknown paths
app.get('*', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'))
})

// ── HTTP + WebSocket server ────────────────────────────────────────────────────
const server = createServer(app)
createWsServer(server)
mockBroadcast()

server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
})

// ── External data feed ────────────────────────────────────────────────────────
connectExternal()

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal: string): void {
    console.log(`\nReceived ${signal} — shutting down …`)
    destroyExternal()
    server.close(() => {
        console.log('HTTP server closed. Bye.')
        process.exit(0)
    })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
