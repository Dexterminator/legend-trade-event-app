import { WebSocket } from 'ws'
import { patchStateObject } from './state.js'

const EXTERNAL_WS_URL = process.env['EXTERNAL_WS_URL']

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000
const FAKE_MESSAGE_INTERVAL_MS = 2_000

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let fakeMessageTimer: ReturnType<typeof setInterval> | null = null
let attempt = 0
let destroyed = false
let fakeCounter = 0

// ── Public API ─────────────────────────────────────────────────────────────────

export function connectExternal(): void {
    if (destroyed) return

    if (!EXTERNAL_WS_URL) {
        startFakeFeed()
        return
    }

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return
    }

    console.log(`[external ws] connecting to ${EXTERNAL_WS_URL} ...`)
    socket = new WebSocket(EXTERNAL_WS_URL)

    socket.on('open', () => {
        attempt = 0
        patchStateObject({
            connected: true,
            source: 'websocket',
            updatedAt: new Date().toISOString(),
        })
    })

    socket.on('message', (raw) => {
        try {
            const payload = parseMessage(raw.toString())
            patchStateObject({
                connected: true,
                lastMessage: payload,
                source: 'websocket',
                updatedAt: new Date().toISOString(),
            })
        } catch {
            console.warn('[external ws] unparseable message:', raw.toString().slice(0, 120))
        }
    })

    socket.on('close', (code, reason) => {
        console.log(`[external ws] closed (${code} ${reason.toString()})`)
        socket = null
        patchStateObject({
            connected: false,
            source: 'websocket',
            updatedAt: new Date().toISOString(),
        })
        scheduleReconnect()
    })

    socket.on('error', (err) => {
        // 'close' fires after 'error', so reconnect is triggered there.
        console.error('[external ws] error:', err.message)
    })
}

export function destroyExternal(): void {
    destroyed = true
    if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }
    if (fakeMessageTimer !== null) {
        clearInterval(fakeMessageTimer)
        fakeMessageTimer = null
    }
    socket?.terminate()
    socket = null
    patchStateObject({
        connected: false,
        source: EXTERNAL_WS_URL ? 'websocket' : 'fake',
        updatedAt: new Date().toISOString(),
    })
}

// ── Internal ───────────────────────────────────────────────────────────────────

function startFakeFeed(): void {
    if (fakeMessageTimer !== null) return

    attempt = 0
    patchStateObject({
        connected: true,
        counter: fakeCounter,
        lastMessage: {
            example: 'fake websocket payload',
        },
        source: 'fake',
        updatedAt: new Date().toISOString(),
    })

    fakeMessageTimer = setInterval(() => {
        fakeCounter += 1
        patchStateObject({
            connected: true,
            counter: fakeCounter,
            lastMessage: {
                count: fakeCounter,
                text: `example-message-${fakeCounter}`,
            },
            source: 'fake',
            updatedAt: new Date().toISOString(),
        })
    }, FAKE_MESSAGE_INTERVAL_MS)
}

function parseMessage(raw: string): unknown {
    try {
        return JSON.parse(raw)
    } catch {
        return raw
    }
}

function scheduleReconnect(): void {
    if (destroyed || !EXTERNAL_WS_URL) return

    if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
    }

    // Exponential backoff: 1s, 2s, 4s, 8s … capped at 30s
    const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
    attempt++
    console.log(`[external ws] reconnecting in ${delay}ms (attempt ${attempt})`)
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connectExternal()
    }, delay)
}
