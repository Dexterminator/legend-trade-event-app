import { WebSocket } from 'ws'
import { setUserPayload } from './state.js'

const HYPERLIQUID_WS_URL = 'wss://api.hyperliquid.xyz/ws'

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

// Subscriptions used in legend.trade
// allMids
// openOrders
// allDexsClearinghouseState
// spotState


export const USER_ADDRESSES: string[] = [
    '0xf6e4e49d2786fb5c284094e39eaac62db263af81', // https://app.legend.trade/users/ryoh
    // '0x0000000000000000000000000000000000000002',
    // '0x0000000000000000000000000000000000000003',
    // '0x0000000000000000000000000000000000000004',
    // '0x0000000000000000000000000000000000000005',
    // '0x0000000000000000000000000000000000000006',
    // '0x0000000000000000000000000000000000000007',
    // '0x0000000000000000000000000000000000000008',
]

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let attempt = 0
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
        console.log(`[hl ws] connected — subscribing to allDexsClearinghouseState for ${USER_ADDRESSES.length} users`)

        for (const user of USER_ADDRESSES) {
            socket!.send(JSON.stringify({
                method: 'subscribe',
                subscription: {
                    type: 'allDexsClearinghouseState',
                    user: user.toLowerCase(),
                },
            }))
        }
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
