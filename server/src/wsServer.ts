import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'node:http'
import { state } from './state.js'

let wss: WebSocketServer | null = null
let leaderboardInterval: ReturnType<typeof setInterval> | null = null

export function createWsServer(server: Server): WebSocketServer {
    wss = new WebSocketServer({ server, path: '/ws' })

    wss.on('connection', (ws: WebSocket) => {
        ws.send(JSON.stringify({
            type: 'connected',
            payload: {
                message: 'Connection successful',
            },
        }))

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

export function closeWsServer(): void {
    if (leaderboardInterval !== null) {
        clearInterval(leaderboardInterval)
        leaderboardInterval = null
    }
    if (wss) {
        for (const client of wss.clients) {
            client.terminate()
        }
        wss.close()
        wss = null
    }
}

export function startStateBroadcast(): void {
    if (leaderboardInterval !== null) {
        clearInterval(leaderboardInterval)
    }

    leaderboardInterval = setInterval(() => {
        broadcast({
            type: 'leaderboard',
            payload: state.competition.leaderboard,
        })
    }, 500)
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
