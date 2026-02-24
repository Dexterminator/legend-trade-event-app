import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'node:http'
import { state } from './state.js'

let wss: WebSocketServer | null = null

export function createWsServer(server: Server): WebSocketServer {
    wss = new WebSocketServer({ server, path: '/ws' })

    wss.on('connection', (ws: WebSocket) => {
        // Send full state immediately on connect
        ws.send(JSON.stringify({ type: 'initial_state', payload: { ...state } }))

        ws.on('error', (err) => {
            console.error('[ws client] error:', err.message)
        })

        ws.on('close', () => {
            // Per-client cleanup — nothing stateful to tear down
        })
    })

    wss.on('error', (err) => {
        console.error('[ws server] error:', err.message)
    })

    return wss
}

export function mockBroadcast(): void {
    setInterval(() => {
        const a = Math.floor(Math.random() * 101)
        const b = Math.floor(Math.random() * 101)
        const c = Math.floor(Math.random() * 101)

        const scoreA = Math.floor(Math.random() * 21)
        const scoreB = Math.floor(Math.random() * 21)
        const tickerMessages = [
            'Momentum building',
            'Big move incoming',
            'Market cooling off',
            'Market heating up',
            'Unexpected trade',
            'Tightening spreads',
            'Volatility rising',
        ]
        const ticker = `${tickerMessages[Math.floor(Math.random() * tickerMessages.length)]} #${Math.floor(Math.random() * 1000)}`

        broadcast({
            type: 'state_update',
            payload: {
                standings: `A: ${a}\nB: ${b}\nC: ${c}`,
                score: `A ${scoreA} - ${scoreB} B`,
                ticker
            }
        })
    }, 3000)
}

/**
 * Broadcast a JSON-serialisable message to every connected client.
 */
export function broadcast(data: object): void {
    if (!wss) return
    const msg = JSON.stringify(data)
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg)
        }
    }
}
