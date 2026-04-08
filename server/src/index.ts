import express from 'express'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { eliminateBottomHalf, resetEliminations, setTraderEliminated, state } from './state.js'
import { createWsServer, closeWsServer, startStateBroadcast } from './wsServer.js'
import { connectExternal, destroyExternal, reconnectExternal } from './wsExternal.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env['PORT'] ?? 5050)
const TOKEN_IMAGE_BASE_URL = 'https://legend-trade-dev.s3.amazonaws.com/token-images'

// Served after `npm run build && export.sh` copies the Godot web export here
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public')

// ── Express ────────────────────────────────────────────────────────────────────
const app = express()
app.use(express.json())

app.get('/', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'admin.html'))
})

app.get('/pnl-chart', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'pnl-chart.html'))
})

app.get('/token-images/:symbol.png', async (req, res) => {
    const symbol = String(req.params['symbol'] ?? '').trim().toUpperCase()
    if (symbol.length === 0) {
        res.status(400).json({ error: 'invalid symbol' })
        return
    }

    try {
        const upstream = await fetch(`${TOKEN_IMAGE_BASE_URL}/${encodeURIComponent(symbol)}.png`)
        if (!upstream.ok) {
            res.sendStatus(upstream.status)
            return
        }

        const contentType = upstream.headers.get('content-type') ?? 'image/png'
        const cacheControl = upstream.headers.get('cache-control') ?? 'public, max-age=3600'
        const body = Buffer.from(await upstream.arrayBuffer())

        res.setHeader('Content-Type', contentType)
        res.setHeader('Cache-Control', cacheControl)
        res.send(body)
    } catch (error) {
        console.error('Token image proxy request failed', { symbol, error })
        res.status(502).json({ error: 'token image proxy failed' })
    }
})

app.get('/debug/state', (_req, res) => {
    res.json(state)
})

app.post('/admin/traders/:userId/elimination', (req, res) => {
    const userId = req.params['userId']
    const isEliminated = req.body?.['is_eliminated']

    if (typeof userId !== 'string' || userId.length === 0) {
        res.status(400).json({ error: 'invalid userId' })
        return
    }

    if (typeof isEliminated !== 'boolean') {
        res.status(400).json({ error: 'is_eliminated must be a boolean' })
        return
    }

    setTraderEliminated(userId, isEliminated)
    res.status(204).end()
})

app.post('/admin/external/reconnect', (_req, res) => {
    reconnectExternal()
    res.status(204).end()
})

app.post('/admin/leaderboard/eliminate-bottom-half', (_req, res) => {
    eliminateBottomHalf()
    res.status(204).end()
})

app.post('/admin/leaderboard/reset-eliminations', (_req, res) => {
    resetEliminations()
    res.status(204).end()
})

// Serve Godot web export static files
app.use(express.static(PUBLIC_DIR))

// SPA fallback — let Godot's index.html handle all unknown paths
app.get('*', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'))
})

// ── HTTP + WebSocket server ────────────────────────────────────────────────────
const server = createServer(app)
createWsServer(server)
startStateBroadcast()

server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
})

// ── External data feed ────────────────────────────────────────────────────────
connectExternal()

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal: string): void {
    console.log(`\nReceived ${signal} — shutting down …`)
    destroyExternal()
    closeWsServer()          // terminate WS clients + clear intervals
    server.closeAllConnections()  // drop open keep-alive HTTP connections
    server.close(() => {
        console.log('HTTP server closed. Bye.')
        process.exit(0)
    })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
