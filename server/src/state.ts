import { broadcast } from "./wsServer.js"

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
    is_eliminated: boolean
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
        leaderboard: null,
        pnl: null,
        latestPnlTick: null,
        lastChannel: null,
        lastMessageAt: null,
    },
}

const MAX_TRACKED_ACTIVITY_ITEMS = 256
const trackedActivityById = new Map<string, ActivityItem>()
const trackedActivityOrder: string[] = []

export function patchConnectionState(partial: Partial<ConnectionState>): void {
    state.connection = {
        ...state.connection,
        ...partial,
    }
}

export function setTraderEliminated(userId: string, isEliminated: boolean): void {
    const leaderboard = state.competition.leaderboard
    if (leaderboard === null) {
        return
    }

    state.competition.leaderboard = {
        ...leaderboard,
        traders: leaderboard.traders.map((trader) => trader.user_id === userId
            ? { ...trader, is_eliminated: isEliminated }
            : trader),
    }
}

export function eliminateBottomHalf(): void {
    const leaderboard = state.competition.leaderboard
    if (leaderboard === null) {
        return
    }

    const activeTraders = leaderboard.traders
        .filter((trader) => trader.is_eliminated !== true)
        .sort((left, right) => {
            if (left.rank !== right.rank) {
                return left.rank - right.rank
            }

            return left.user_id.localeCompare(right.user_id)
        })

    if (activeTraders.length <= 1) {
        return
    }

    const survivors = Math.ceil(activeTraders.length / 2)
    const eliminatedUserIds = new Set(activeTraders.slice(survivors).map((trader) => trader.user_id))

    state.competition.leaderboard = {
        ...leaderboard,
        traders: leaderboard.traders.map((trader) => eliminatedUserIds.has(trader.user_id)
            ? { ...trader, is_eliminated: true }
            : trader),
    }
}

export function resetEliminations(): void {
    const leaderboard = state.competition.leaderboard
    if (leaderboard === null) {
        return
    }

    state.competition.leaderboard = {
        ...leaderboard,
        traders: leaderboard.traders.map((trader) => ({
            ...trader,
            is_eliminated: false,
        })),
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
            applyActivityEnvelope(envelope.data)
            return

        case 'leaderboard':
            state.competition.leaderboard = {
                ...envelope.data,
                traders: withManualTraderFields(envelope.data.traders, state.competition.leaderboard?.traders)
                    .sort((left, right) => left.user_id.localeCompare(right.user_id)),
            }
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

function withManualTraderFields(nextTraders: LeaderboardTrader[], previousTraders: LeaderboardTrader[] | undefined): LeaderboardTrader[] {
    const eliminatedByUserId = new Map(previousTraders?.map((trader) => [trader.user_id, trader.is_eliminated]) ?? [])

    return nextTraders.map((trader) => ({
        ...trader,
        is_eliminated: eliminatedByUserId.get(trader.user_id) ?? false,
    }))
}

function applyActivityEnvelope(activity: ActivityItem[] | ActivityItem): void {
    if (Array.isArray(activity)) {
        replaceTrackedActivity(activity)
        return
    }

    upsertTrackedActivity(activity)
}

function replaceTrackedActivity(activity: ActivityItem[]): void {
    trackedActivityById.clear()
    trackedActivityOrder.length = 0

    const startIndex = Math.max(0, activity.length - MAX_TRACKED_ACTIVITY_ITEMS)
    for (let index = startIndex; index < activity.length; index += 1) {
        const item = activity[index]
        trackedActivityById.set(item.id, item)
        trackedActivityOrder.push(item.id)
    }
}

function upsertTrackedActivity(nextItem: ActivityItem): void {
    const hadExistingItem = trackedActivityById.has(nextItem.id)
    trackedActivityById.set(nextItem.id, nextItem)

    if (!hadExistingItem) {
        trackedActivityOrder.push(nextItem.id)
        trimTrackedActivity()
    }

    broadcast({
        type: 'trade_update',
        payload: nextItem,
    })
}

function trimTrackedActivity(): void {
    while (trackedActivityOrder.length > MAX_TRACKED_ACTIVITY_ITEMS) {
        const oldestId = trackedActivityOrder.shift()
        if (oldestId !== undefined) {
            trackedActivityById.delete(oldestId)
        }
    }
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
