export type ActivityAction = 'opened' | 'closed' | 'added' | 'reduced' | 'flipped'
export type PositionSide = 'LONG' | 'SHORT'
export type CompetitionChannel = 'connected' | 'activity' | 'leaderboard' | 'pnl' | 'pnl:tick'
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export interface ConnectedMessage {
    message: string
}

export interface ActivityItem {
    id: string
    ts: number
    user_id: string
    username: string
    avatar_url: string
    action: ActivityAction
    symbol: string
    side: PositionSide
    size_usd: number
    price: number
    leverage: number
    margin_usd: number
    closed_pnl: number | null
    closed_pnl_pct: number | null
}

export interface LeaderboardPosition {
    symbol: string
    side: PositionSide
    size_usd: number
    unrealized_pnl: number
}

export interface LeaderboardTrader {
    user_id: string
    username: string
    avatar_url: string
    country_code: string
    rank: number
    rank_delta: number
    pnl_usd: number
    pnl_pct: number
    volume_usd: number
    top_positions: LeaderboardPosition[]
    sparkline: number[]
}

export interface LeaderboardSnapshot {
    ts: number
    traders: LeaderboardTrader[]
}

export interface PnlSeriesPoint {
    ts: number
    equity: number
    pnl_pct: number
}

export interface PnlTraderSeries {
    username: string
    color: string
    initial_balance: number
    series: PnlSeriesPoint[]
}

export interface PnlDataset {
    competition_id: string
    resolution_ms: number
    traders: Record<string, PnlTraderSeries>
}

export interface PnlTickValue {
    equity: number
    pnl_pct: number
}

export interface PnlTick {
    ts: number
    data: Record<string, PnlTickValue>
}

export type CompetitionEnvelope =
    | { channel: 'connected'; data: ConnectedMessage }
    | { channel: 'activity'; data: ActivityItem[] | ActivityItem }
    | { channel: 'leaderboard'; data: LeaderboardSnapshot }
    | { channel: 'pnl'; data: PnlDataset }
    | { channel: 'pnl:tick'; data: PnlTick }

export interface ConnectionState {
    url: string
    status: ConnectionStatus
    reconnectAttempt: number
    connectedAt: string | null
    disconnectedAt: string | null
    lastPingAt: string | null
    lastPongAt: string | null
    lastError: string | null
    updatedAt: string
}

export interface CompetitionState {
    connected: ConnectedMessage | null
    activity: ActivityItem[]
    leaderboard: LeaderboardSnapshot | null
    pnl: PnlDataset | null
    latestPnlTick: PnlTick | null
    lastChannel: CompetitionChannel | null
    lastMessageAt: string | null
}

export interface State {
    connection: ConnectionState
    competition: CompetitionState
}

export const state: State = {
    connection: {
        url: '',
        status: 'disconnected',
        reconnectAttempt: 0,
        connectedAt: null,
        disconnectedAt: null,
        lastPingAt: null,
        lastPongAt: null,
        lastError: null,
        updatedAt: new Date(0).toISOString(),
    },
    competition: {
        connected: null,
        activity: [],
        leaderboard: null,
        pnl: null,
        latestPnlTick: null,
        lastChannel: null,
        lastMessageAt: null,
    },
}

export function patchConnectionState(partial: Partial<ConnectionState>): void {
    state.connection = {
        ...state.connection,
        ...partial,
    }
}

export function applyCompetitionEnvelope(envelope: CompetitionEnvelope): void {
    const receivedAt = new Date().toISOString()

    state.competition.lastChannel = envelope.channel
    state.competition.lastMessageAt = receivedAt

    switch (envelope.channel) {
        case 'connected':
            state.competition.connected = envelope.data
            return

        case 'activity':
            state.competition.activity = Array.isArray(envelope.data)
                ? envelope.data
                : appendActivityItem(state.competition.activity, envelope.data)
            return

        case 'leaderboard':
            state.competition.leaderboard = envelope.data
            return

        case 'pnl':
            state.competition.pnl = mergeLatestTickIntoPnl(envelope.data, state.competition.latestPnlTick)
            return

        case 'pnl:tick':
            state.competition.latestPnlTick = envelope.data
            state.competition.pnl = state.competition.pnl === null
                ? null
                : mergeLatestTickIntoPnl(state.competition.pnl, envelope.data)
            return
    }
}

function appendActivityItem(activity: ActivityItem[], nextItem: ActivityItem): ActivityItem[] {
    const existingIndex = activity.findIndex((item) => item.id === nextItem.id)
    if (existingIndex === -1) {
        return [...activity, nextItem]
    }

    const nextActivity = [...activity]
    nextActivity[existingIndex] = nextItem
    return nextActivity
}

function mergeLatestTickIntoPnl(pnl: PnlDataset, tick: PnlTick | null): PnlDataset {
    if (tick === null) {
        return pnl
    }

    const nextTraders: Record<string, PnlTraderSeries> = {}

    for (const [userId, trader] of Object.entries(pnl.traders)) {
        const tickValue = tick.data[userId]
        nextTraders[userId] = tickValue === undefined
            ? trader
            : {
                ...trader,
                series: mergeSeriesPoint(trader.series, {
                    ts: tick.ts,
                    equity: tickValue.equity,
                    pnl_pct: tickValue.pnl_pct,
                }),
            }
    }

    for (const [userId, tickValue] of Object.entries(tick.data)) {
        if (nextTraders[userId] !== undefined) continue

        nextTraders[userId] = {
            username: userId,
            color: '#000000',
            initial_balance: tickValue.equity,
            series: [{
                ts: tick.ts,
                equity: tickValue.equity,
                pnl_pct: tickValue.pnl_pct,
            }],
        }
    }

    return {
        ...pnl,
        traders: nextTraders,
    }
}

function mergeSeriesPoint(series: PnlSeriesPoint[], nextPoint: PnlSeriesPoint): PnlSeriesPoint[] {
    const lastPoint = series.at(-1)
    if (lastPoint?.ts === nextPoint.ts) {
        return [...series.slice(0, -1), nextPoint]
    }

    return [...series, nextPoint]
}
