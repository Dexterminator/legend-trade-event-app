import { WebSocket } from 'ws'
import { state, updateState } from './state.js'
import { broadcast } from './wsServer.js'

// Override via environment variable: EXTERNAL_WS_URL=ws://data-feed:9090
const EXTERNAL_WS_URL = process.env['EXTERNAL_WS_URL'] ?? 'ws://localhost:9090'

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let attempt = 0
let destroyed = false

// ── Public API ─────────────────────────────────────────────────────────────────

export function connectExternal(): void {
    if (destroyed) return

    console.log(`[external ws] connecting to ${EXTERNAL_WS_URL} …`)
    socket = new WebSocket(EXTERNAL_WS_URL)

    socket.on('open', () => {
        console.log('[external ws] connected')
        attempt = 0
    })

    socket.on('message', (raw) => {
        try {
            const msg: unknown = JSON.parse(raw.toString())
            if (typeof msg !== 'object' || msg === null) return

            const m = msg as Record<string, unknown>
            const partial: Partial<typeof state> = {}

            if (typeof m['standings'] === 'string') partial.standings = m['standings']
            if (typeof m['score'] === 'string') partial.score = m['score']
            if (typeof m['ticker'] === 'string') partial.ticker = m['ticker']

            if (Object.keys(partial).length > 0) {
                updateState(partial)
                broadcast({ type: 'state_update', payload: { ...state } })
            }
        } catch {
            console.warn('[external ws] unparseable message:', raw.toString().slice(0, 120))
        }
    })

    socket.on('close', (code, reason) => {
        console.log(`[external ws] closed (${code} ${reason.toString()})`)
        scheduleReconnect()
    })

    socket.on('error', (err) => {
        // 'close' fires after 'error', so reconnect is triggered there
        console.error('[external ws] error:', err.message)
    })
}

export function destroyExternal(): void {
    destroyed = true
    if (reconnectTimer !== null) clearTimeout(reconnectTimer)
    socket?.terminate()
    socket = null
}

// ── Internal ───────────────────────────────────────────────────────────────────

function scheduleReconnect(): void {
    if (destroyed) return
    // Exponential backoff: 1s, 2s, 4s, 8s … capped at 30s
    const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
    attempt++
    console.log(`[external ws] reconnecting in ${delay}ms (attempt ${attempt})`)
    reconnectTimer = setTimeout(connectExternal, delay)
}
