import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'node:http'
import { URL } from 'node:url'
import { getPnlChartReplayState, getSelectedCompetitionState } from './state.js'

let appWss: WebSocketServer | null = null
let pnlChartWss: WebSocketServer | null = null
let broadcastInterval: ReturnType<typeof setInterval> | null = null

export function createWsServer(server: Server): WebSocketServer {
    appWss = new WebSocketServer({ noServer: true })
    pnlChartWss = new WebSocketServer({ noServer: true })

    appWss.on('connection', (ws: WebSocket) => {
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

    pnlChartWss.on('connection', (ws: WebSocket) => {
        ws.send(JSON.stringify({
            type: 'connected',
            payload: {
                message: 'Connection successful',
            },
        }))

        sendCurrentPnlChartState(ws)
        sendCurrentPnlChartReplayState(ws)

        ws.on('error', (err) => {
            console.error('[pnl chart ws client] error:', err.message)
        })
    })

    appWss.on('error', (err) => {
        console.error('[ws server] error:', err.message)
    })

    pnlChartWss.on('error', (err) => {
        console.error('[pnl chart ws server] error:', err.message)
    })

    server.on('upgrade', (request, socket, head) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        const target = pathname === '/ws'
            ? appWss
            : pathname === '/ws-pnl-chart'
                ? pnlChartWss
                : null

        if (target === null) {
            socket.destroy()
            return
        }

        target.handleUpgrade(request, socket, head, (ws) => {
            target.emit('connection', ws, request)
        })
    })

    return appWss
}

export function closeWsServer(): void {
    if (broadcastInterval !== null) {
        clearInterval(broadcastInterval)
        broadcastInterval = null
    }
    if (appWss) {
        for (const client of appWss.clients) {
            client.terminate()
        }
        appWss.close()
        appWss = null
    }
    if (pnlChartWss) {
        for (const client of pnlChartWss.clients) {
            client.terminate()
        }
        pnlChartWss.close()
        pnlChartWss = null
    }
}

export function startStateBroadcast(): void {
    if (broadcastInterval !== null) {
        clearInterval(broadcastInterval)
    }

    broadcastInterval = setInterval(() => {
        const competitionState = getSelectedCompetitionState()

        broadcast({
            type: 'leaderboard',
            payload: competitionState.leaderboard,
        })

        broadcastPnlChart({
            type: 'pnl_chart',
            payload: {
                leaderboard: competitionState.leaderboard,
                pnl: competitionState.pnl,
            },
        })
    }, 500)
}

/**
 * Broadcast a JSON-serialisable message to every connected client.
 */
export function broadcast(data: object): void {
    if (!appWss) return
    const msg = JSON.stringify(data)
    for (const client of appWss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg)
        }
    }
}

export function broadcastPnlChart(data: object): void {
    if (!pnlChartWss) return
    const msg = JSON.stringify(data)
    for (const client of pnlChartWss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg)
        }
    }
}

export function broadcastCurrentPnlChartReplayState(): void {
    broadcastPnlChart({
        type: 'pnl_chart_replay',
        payload: getPnlChartReplayState(),
    })
}

function sendCurrentPnlChartState(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) {
        return
    }

    const competitionState = getSelectedCompetitionState()
    ws.send(JSON.stringify({
        type: 'pnl_chart',
        payload: {
            leaderboard: competitionState.leaderboard,
            pnl: competitionState.pnl,
        },
    }))
}

function sendCurrentPnlChartReplayState(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) {
        return
    }

    ws.send(JSON.stringify({
        type: 'pnl_chart_replay',
        payload: getPnlChartReplayState(),
    }))
}
