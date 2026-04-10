import express from 'express'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { eliminateBottomHalf, getSelectedCompetitionId, resetEliminations, setSelectedCompetitionId, setTraderEliminated, spawnFakeTrade, state } from './state.js'
import { createWsServer, closeWsServer, startStateBroadcast } from './wsServer.js'
import { connectExternal, destroyExternal, reconnectExternal, subscribeExternalCompetition } from './wsExternal.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env['PORT'] ?? 5050)
const ARENA_COMPETITION_BASE_URL = process.env['ARENA_COMPETITION_BASE_URL'] ?? 'https://api.legend.trade/arena/competition'
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

app.get('/admin/competitions', (_req, res) => {
    res.json({
        competitions: state.availableCompetitions,
        selectedCompetitionId: state.selectedCompetitionId,
    })
})

app.get('/arena/list', (req, res) => {
    void proxyArenaRequest(req, res, '/list')
})

app.get('/arena/info', (req, res) => {
    void proxyArenaRequest(req, res, '/info')
})

app.get('/arena/leaderboard', (req, res) => {
    void proxyArenaRequest(req, res, '/leaderboard')
})

app.get('/arena/activity', (req, res) => {
    void proxyArenaRequest(req, res, '/activity')
})

app.get('/arena/pnl-chart', (req, res) => {
    void proxyArenaRequest(req, res, '/pnl-chart')
})

app.get('/arena/stats', (req, res) => {
    void proxyArenaRequest(req, res, '/stats')
})

app.post('/arena/simulate', (req, res) => {
    void proxyArenaRequest(req, res, '/simulate', { method: 'POST' })
})

app.post('/arena/simulate/stop', (req, res) => {
    void proxyArenaRequest(req, res, '/simulate/stop', { method: 'POST' })
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

app.post('/admin/competitions/select', (req, res) => {
    const competitionId = req.body?.['competition_id']

    if (competitionId === null || competitionId === '') {
        setSelectedCompetitionId(null)
        res.status(204).end()
        return
    }

    if (typeof competitionId !== 'string' || competitionId.length === 0) {
        res.status(400).json({ error: 'competition_id must be a string or null' })
        return
    }

    const competitionExists = state.availableCompetitions.some((competition) => competition.competition_id === competitionId)
    if (!competitionExists) {
        res.status(404).json({ error: 'competition not found' })
        return
    }

    setSelectedCompetitionId(competitionId)
    subscribeExternalCompetition(competitionId)
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

app.post('/admin/trades/spawn-fake', (_req, res) => {
    spawnFakeTrade()
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

async function proxyArenaRequest(
    req: express.Request,
    res: express.Response,
    pathName: string,
    init: RequestInit = {},
): Promise<void> {
    const upstreamUrl = new URL(`${ARENA_COMPETITION_BASE_URL}${pathName}`)

    const selectedCompetitionId = getSelectedCompetitionId()
    if (selectedCompetitionId !== null && !req.query['competition_id']) {
        upstreamUrl.searchParams.set('competition_id', selectedCompetitionId)
    }

    for (const [key, rawValue] of Object.entries(req.query)) {
        if (typeof rawValue === 'string' && rawValue.length > 0) {
            upstreamUrl.searchParams.set(key, rawValue)
            continue
        }

        if (Array.isArray(rawValue)) {
            for (const value of rawValue) {
                if (typeof value === 'string' && value.length > 0) {
                    upstreamUrl.searchParams.append(key, value)
                }
            }
        }
    }

    try {
        const upstream = await fetch(upstreamUrl, {
            method: init.method ?? req.method,
            headers: {
                Accept: 'application/json',
                ...init.headers,
            },
        })

        res.status(upstream.status)

        const contentType = upstream.headers.get('content-type')
        if (contentType !== null) {
            res.setHeader('Content-Type', contentType)
        }

        const responseText = await upstream.text()
        if (responseText.length === 0) {
            res.end()
            return
        }

        res.send(responseText)
    } catch (error) {
        console.error('Arena competition proxy request failed', { pathName, error })
        res.status(502).json({ error: 'arena competition proxy failed' })
    }
}
