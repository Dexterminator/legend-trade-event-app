import { WebSocket } from 'ws'
import {
    applyCompetitionEnvelope,
    patchConnectionState,
    type CompetitionEnvelope,
} from './state.js'

const DEFAULT_EXTERNAL_WS_URL = 'wss://testnet-api.legend.trade/competition/ws'
const EXTERNAL_WS_URL = process.env['EXTERNAL_WS_URL'] ?? DEFAULT_EXTERNAL_WS_URL

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000
const PING_INTERVAL_MS = 15_000

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let attempt = 0
let destroyed = false

// ── Public API ─────────────────────────────────────────────────────────────────

export function connectExternal(): void {
    if (destroyed) return

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return
    }

    patchConnectionState({
        url: EXTERNAL_WS_URL,
        status: 'connecting',
        reconnectAttempt: attempt,
        lastError: null,
        updatedAt: new Date().toISOString(),
    })

    console.log(`[external ws] connecting to ${EXTERNAL_WS_URL} ...`)
    socket = new WebSocket(EXTERNAL_WS_URL)

    socket.on('open', () => {
        attempt = 0
        startPingLoop()
        patchConnectionState({
            url: EXTERNAL_WS_URL,
            status: 'connected',
            reconnectAttempt: 0,
            connectedAt: new Date().toISOString(),
            disconnectedAt: null,
            lastError: null,
            updatedAt: new Date().toISOString(),
        })
    })

    socket.on('message', (raw) => {
        try {
            const message = parseMessage(raw.toString())

            if (isPongMessage(message)) {
                patchConnectionState({
                    lastPongAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                })
                return
            }

            if (!isCompetitionEnvelope(message)) {
                console.warn('[external ws] unexpected message:', raw.toString().slice(0, 160))
                return
            }

            applyCompetitionEnvelope(message)
            patchConnectionState({
                status: 'connected',
                lastError: null,
                updatedAt: new Date().toISOString(),
            })
        } catch {
            console.warn('[external ws] unparseable message:', raw.toString().slice(0, 120))
        }
    })

    socket.on('close', (code, reason) => {
        console.log(`[external ws] closed (${code} ${reason.toString()})`)
        stopPingLoop()
        socket = null
        patchConnectionState({
            status: 'disconnected',
            reconnectAttempt: attempt,
            disconnectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
        scheduleReconnect()
    })

    socket.on('error', (err) => {
        // 'close' fires after 'error', so reconnect is triggered there.
        console.error('[external ws] error:', err.message)
        patchConnectionState({
            lastError: err.message,
            updatedAt: new Date().toISOString(),
        })
    })
}

export function destroyExternal(): void {
    destroyed = true
    if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }
    stopPingLoop()
    socket?.terminate()
    socket = null
    patchConnectionState({
        status: 'disconnected',
        disconnectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    })
}

// ── Internal ───────────────────────────────────────────────────────────────────

function parseMessage(raw: string): unknown {
    return JSON.parse(raw)
}

function isPongMessage(value: unknown): value is { type: 'pong' } {
    return typeof value === 'object'
        && value !== null
        && (value as Record<string, unknown>)['type'] === 'pong'
}

function isCompetitionEnvelope(value: unknown): value is CompetitionEnvelope {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const channel = (value as Record<string, unknown>)['channel']
    return channel === 'connected'
        || channel === 'activity'
        || channel === 'leaderboard'
        || channel === 'pnl'
        || channel === 'pnl:tick'
}

function startPingLoop(): void {
    stopPingLoop()

    pingTimer = setInterval(() => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return
        }

        socket.send(JSON.stringify({ type: 'ping' }))
        patchConnectionState({
            lastPingAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
    }, PING_INTERVAL_MS)
}

function stopPingLoop(): void {
    if (pingTimer === null) return

    clearInterval(pingTimer)
    pingTimer = null
}

function scheduleReconnect(): void {
    if (destroyed) return

    if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
    }

    // Exponential backoff: 1s, 2s, 4s, 8s … capped at 30s
    const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
    attempt++
    patchConnectionState({
        reconnectAttempt: attempt,
        updatedAt: new Date().toISOString(),
    })
    console.log(`[external ws] reconnecting in ${delay}ms (attempt ${attempt})`)
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connectExternal()
    }, delay)
}
