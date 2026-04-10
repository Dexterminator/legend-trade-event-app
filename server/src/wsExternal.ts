import { WebSocket } from 'ws'
import {
    applyCompetitionEnvelope,
    getSelectedCompetitionId,
    patchConnectionState,
    type CompetitionEnvelope,
    type PnlDataset,
} from './state.js'

const DEFAULT_EXTERNAL_WS_URL = 'wss://api.legend.trade/arena/ws'
const EXTERNAL_WS_URL = process.env['EXTERNAL_WS_URL'] ?? DEFAULT_EXTERNAL_WS_URL
const ARENA_COMPETITION_BASE_URL = process.env['ARENA_COMPETITION_BASE_URL'] ?? 'https://api.legend.trade/arena/competition'

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000
const PING_INTERVAL_MS = 15_000

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let attempt = 0
let destroyed = false
let suppressReconnectOnClose = false
let subscribedCompetitionId: string | null = null
const pendingPnlHydrationCompetitionIds = new Set<string>()

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
    const currentSocket = socket

    currentSocket.on('open', () => {
        attempt = 0
        startPingLoop()
        subscribedCompetitionId = null
        patchConnectionState({
            url: EXTERNAL_WS_URL,
            status: 'connected',
            reconnectAttempt: 0,
            connectedAt: new Date().toISOString(),
            disconnectedAt: null,
            lastError: null,
            updatedAt: new Date().toISOString(),
        })

        const selectedCompetitionId = getSelectedCompetitionId()
        if (selectedCompetitionId !== null) {
            subscribeExternalCompetition(selectedCompetitionId)
        }
    })

    currentSocket.on('message', (raw) => {
        const rawText = raw.toString()
        let message: unknown

        try {
            message = parseMessage(rawText)
        } catch (error) {
            console.warn('[external ws] invalid JSON message:', {
                error: error instanceof Error ? error.message : String(error),
                payload: rawText.slice(0, 160),
            })
            return
        }

        if (isConnectedPongEnvelope(message)) {
            patchConnectionState({
                lastPongAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            return
        }

        if (!isCompetitionEnvelope(message)) {
            console.warn('[external ws] unexpected message:', rawText.slice(0, 160))
            return
        }

        try {
            applyCompetitionEnvelope(message)
            if (message.channel === 'competitions') {
                const selectedCompetitionId = getSelectedCompetitionId()
                if (selectedCompetitionId !== null) {
                    subscribeExternalCompetition(selectedCompetitionId)
                }
            }
            patchConnectionState({
                status: 'connected',
                lastError: null,
                updatedAt: new Date().toISOString(),
            })
        } catch (error) {
            console.warn('[external ws] failed to process message:', {
                channel: message.channel,
                error: error instanceof Error ? error.message : String(error),
                payload: rawText.slice(0, 160),
            })
        }
    })

    currentSocket.on('close', (code, reason) => {
        console.log(`[external ws] closed (${code} ${reason.toString()})`)
        stopPingLoop()
        if (socket === currentSocket) {
            socket = null
        }
        subscribedCompetitionId = null
        patchConnectionState({
            status: 'disconnected',
            reconnectAttempt: attempt,
            disconnectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })

        if (suppressReconnectOnClose) {
            suppressReconnectOnClose = false
            return
        }

        scheduleReconnect()
    })

    currentSocket.on('error', (err) => {
        // 'close' fires after 'error', so reconnect is triggered there.
        console.error('[external ws] error:', err.message)
        patchConnectionState({
            lastError: err.message,
            updatedAt: new Date().toISOString(),
        })
    })
}

export function reconnectExternal(): void {
    destroyed = false
    attempt = 0

    if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        suppressReconnectOnClose = true
        stopPingLoop()
        patchConnectionState({
            url: EXTERNAL_WS_URL,
            status: 'connecting',
            reconnectAttempt: 0,
            lastError: null,
            updatedAt: new Date().toISOString(),
        })
        socket.terminate()
        socket = null
    }

    connectExternal()
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
    subscribedCompetitionId = null
    pendingPnlHydrationCompetitionIds.clear()
    patchConnectionState({
        status: 'disconnected',
        disconnectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    })
}

export function subscribeExternalCompetition(competitionId: string): void {
    void hydrateCompetitionPnl(competitionId)

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return
    }

    if (subscribedCompetitionId === competitionId) {
        return
    }

    try {
        socket.send(JSON.stringify({
            type: 'subscribe',
            competition_id: competitionId,
        }))
        subscribedCompetitionId = competitionId
    } catch (error) {
        console.warn('[external ws] failed to send competition subscription', {
            competitionId,
            error: error instanceof Error ? error.message : String(error),
        })
    }
}

// ── Internal ───────────────────────────────────────────────────────────────────

function parseMessage(raw: string): unknown {
    return JSON.parse(raw)
}

async function hydrateCompetitionPnl(competitionId: string): Promise<void> {
    if (competitionId.length === 0 || pendingPnlHydrationCompetitionIds.has(competitionId)) {
        return
    }

    pendingPnlHydrationCompetitionIds.add(competitionId)
    try {
        const upstreamUrl = new URL(`${ARENA_COMPETITION_BASE_URL}/pnl-chart`)
        upstreamUrl.searchParams.set('competition_id', competitionId)

        const response = await fetch(upstreamUrl, {
            headers: {
                Accept: 'application/json',
            },
        })

        if (!response.ok) {
            console.warn('[external ws] failed to hydrate pnl snapshot', {
                competitionId,
                status: response.status,
            })
            return
        }

        const payload: unknown = await response.json()
        if (!isPnlDataset(payload)) {
            console.warn('[external ws] invalid pnl snapshot payload', { competitionId })
            return
        }

        applyCompetitionEnvelope({
            channel: 'pnl',
            data: payload,
        })
    } catch (error) {
        console.warn('[external ws] failed to hydrate pnl snapshot', {
            competitionId,
            error: error instanceof Error ? error.message : String(error),
        })
    } finally {
        pendingPnlHydrationCompetitionIds.delete(competitionId)
    }
}

function isPnlDataset(value: unknown): value is PnlDataset {
    return typeof value === 'object'
        && value !== null
        && typeof (value as Record<string, unknown>)['competition_id'] === 'string'
        && typeof (value as Record<string, unknown>)['resolution_ms'] === 'number'
        && typeof (value as Record<string, unknown>)['traders'] === 'object'
        && (value as Record<string, unknown>)['traders'] !== null
}

function isConnectedPongEnvelope(value: unknown): value is { channel: 'connected'; data: { pong: true } } {
    return typeof value === 'object'
        && value !== null
        && (value as Record<string, unknown>)['channel'] === 'connected'
        && typeof (value as Record<string, unknown>)['data'] === 'object'
        && (value as Record<string, unknown>)['data'] !== null
        && ((value as Record<string, unknown>)['data'] as Record<string, unknown>)['pong'] === true
}

function isCompetitionEnvelope(value: unknown): value is CompetitionEnvelope {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const channel = (value as Record<string, unknown>)['channel']
    return channel === 'connected'
        || channel === 'competitions'
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
