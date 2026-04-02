import { WebSocket } from 'ws'
import { getContestantWalletAddresses, setUserPayload } from './state.js'

const HYPERLIQUID_WS_URL = 'wss://api.hyperliquid.xyz/ws'

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

// Subscriptions used in legend.trade
// allMids
// openOrders
// allDexsClearinghouseState
// spotState

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let attempt = 0
const subscribedUsers = new Set<string>()
let destroyed = false

// ── Public API ─────────────────────────────────────────────────────────────────

export function connectExternal(): void {
    if (destroyed) return

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return
    }

    console.log(`[hl ws] connecting to ${HYPERLIQUID_WS_URL} …`)
    socket = new WebSocket(HYPERLIQUID_WS_URL)

    socket.on('open', () => {
        attempt = 0
        subscribedUsers.clear()
        syncExternalSubscriptions()
    })

    socket.on('message', (raw) => {
        try {
            const msg: unknown = JSON.parse(raw.toString())
            if (typeof msg !== 'object' || msg === null) return

            const data = (msg as Record<string, unknown>)['data']
            const user = (data as Record<string, unknown> | undefined)?.['user']
            if (typeof user !== 'string' || user.length === 0) {
                console.warn('[hl ws] message missing data.user')
                return
            }

            setUserPayload(user, msg)
        } catch {
            console.warn('[hl ws] unparseable message:', raw.toString().slice(0, 120))
        }
    })

    socket.on('close', (code, reason) => {
        console.log(`[hl ws] closed (${code} ${reason.toString()})`)
        socket = null
        subscribedUsers.clear()
        scheduleReconnect()
    })

    socket.on('error', (err) => {
        // 'close' fires after 'error', so reconnect is triggered there.
        console.error('[hl ws] error:', err.message)
    })
}

export function destroyExternal(): void {
    destroyed = true
    if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }
    socket?.terminate()
    socket = null
    subscribedUsers.clear()
}

export function syncExternalSubscriptions(): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    const desiredUsers = new Set(getContestantWalletAddresses())

    for (const user of desiredUsers) {
        if (subscribedUsers.has(user)) continue
        socket.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
                type: 'allDexsClearinghouseState',
                user,
            },
        }))
        subscribedUsers.add(user)
    }

    for (const user of [...subscribedUsers]) {
        if (desiredUsers.has(user)) continue
        socket.send(JSON.stringify({
            method: 'unsubscribe',
            subscription: {
                type: 'allDexsClearinghouseState',
                user,
            },
        }))
        subscribedUsers.delete(user)
    }

    console.log(`[hl ws] synced subscriptions for ${desiredUsers.size} users`)
}

// ── Internal ───────────────────────────────────────────────────────────────────

function scheduleReconnect(): void {
    if (destroyed) return

    if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
    }

    // Exponential backoff: 1s, 2s, 4s, 8s … capped at 30s
    const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
    attempt++
    console.log(`[hl ws] reconnecting in ${delay}ms (attempt ${attempt})`)
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connectExternal()
    }, delay)
}
