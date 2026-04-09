import { broadcast } from "./wsServer.js"

export type ActivityAction = 'opened' | 'closed' | 'added' | 'reduced' | 'flipped'
export type PositionSide = 'LONG' | 'SHORT'
export type CompetitionChannel = 'connected' | 'competitions' | 'activity' | 'leaderboard' | 'pnl' | 'pnl:tick'
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export interface ConnectedMessage {
    message?: string
    pong?: boolean
}

export interface ActiveCompetitionEntry {
    competition_id: string
    env: string
    name: string
    status: string
    participant_count: number
    started_at: number
    ends_at: number
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
    leverage?: number
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
    total_positions?: number
    avg_leverage?: number
    avg_hold_time_ms?: number
}

export interface LeaderboardSnapshot {
    competition_id?: string
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
    avatar_url?: string
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
    competition_id?: string
    ts: number
    data: Record<string, PnlTickValue>
}

export type CompetitionEnvelope =
    | { channel: 'connected'; data: ConnectedMessage }
    | { channel: 'competitions'; data: ActiveCompetitionEntry[] }
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
    availableCompetitions: ActiveCompetitionEntry[]
    selectedCompetitionId: string | null
    competitionStates: Record<string, CompetitionState>
    competition: CompetitionState
}

function createEmptyCompetitionState(): CompetitionState {
    return {
        connected: null,
        leaderboard: null,
        pnl: null,
        latestPnlTick: null,
        lastChannel: null,
        lastMessageAt: null,
    }
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
    availableCompetitions: [],
    selectedCompetitionId: null,
    competitionStates: {},
    competition: createEmptyCompetitionState(),
}

const MAX_TRACKED_ACTIVITY_ITEMS = 256
const trackedActivityById = new Map<string, ActivityItem>()
const trackedActivityOrder: string[] = []
const FAKE_TRADE_SYMBOLS = ['BTC', 'DOGE'] as const
const FAKE_TRADE_ACTIONS: ActivityAction[] = ['opened', 'closed']
const FAKE_TRADE_SIDES: PositionSide[] = ['LONG', 'SHORT']

export function patchConnectionState(partial: Partial<ConnectionState>): void {
    state.connection = {
        ...state.connection,
        ...partial,
    }
}

export function getSelectedCompetitionId(): string | null {
    return state.selectedCompetitionId
}

export function getSelectedCompetitionState(): CompetitionState {
    return state.competition
}

export function setSelectedCompetitionId(competitionId: string | null): void {
    if (state.selectedCompetitionId === competitionId) {
        return
    }

    state.selectedCompetitionId = competitionId
    syncSelectedCompetitionState()
}

export function setTraderEliminated(userId: string, isEliminated: boolean): void {
    const competitionId = state.selectedCompetitionId
    const competitionState = getSelectedCompetitionState()
    const leaderboard = competitionState.leaderboard
    if (leaderboard === null) {
        return
    }

    setCompetitionState(competitionId, {
        ...competitionState,
        ...leaderboard,
        leaderboard: {
            ...leaderboard,
            traders: leaderboard.traders.map((trader) => trader.user_id === userId
                ? { ...trader, is_eliminated: isEliminated }
                : trader),
        },
    })
}

export function eliminateBottomHalf(): void {
    const competitionId = state.selectedCompetitionId
    const competitionState = getSelectedCompetitionState()
    const leaderboard = competitionState.leaderboard
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

    setCompetitionState(competitionId, {
        ...competitionState,
        leaderboard: {
            ...leaderboard,
            traders: leaderboard.traders.map((trader) => eliminatedUserIds.has(trader.user_id)
                ? { ...trader, is_eliminated: true }
                : trader),
        },
    })
}

export function resetEliminations(): void {
    const competitionId = state.selectedCompetitionId
    const competitionState = getSelectedCompetitionState()
    const leaderboard = competitionState.leaderboard
    if (leaderboard === null) {
        return
    }

    setCompetitionState(competitionId, {
        ...competitionState,
        leaderboard: {
            ...leaderboard,
            traders: leaderboard.traders.map((trader) => ({
                ...trader,
                is_eliminated: false,
            })),
        },
    })
}

export function spawnFakeTrade(): void {
    const trader = getFakeTradeSourceTrader()
    const symbol = sample(FAKE_TRADE_SYMBOLS)
    const action = sample(FAKE_TRADE_ACTIONS)
    const side = sample(FAKE_TRADE_SIDES)
    const sizeUsd = randomInt(2_500, 35_000)
    const price = symbol === 'BTC'
        ? randomInt(60_000, 72_000)
        : randomFloat(0.08, 0.32)
    const closedPnl = action === 'closed'
        ? randomSignedFloat(120, 2_400)
        : null

    upsertTrackedActivity({
        id: `fake-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        ts: Date.now(),
        user_id: trader?.user_id ?? 'fake-trader',
        username: trader?.username ?? 'Legend Whale',
        avatar_url: trader?.avatar_url ?? '',
        action,
        symbol,
        side,
        size_usd: sizeUsd,
        price,
        leverage: randomInt(2, 20),
        margin_usd: randomInt(400, 6_000),
        closed_pnl: closedPnl,
        closed_pnl_pct: closedPnl === null ? null : randomSignedFloat(0.8, 12.5),
    })
}

export function applyCompetitionEnvelope(envelope: CompetitionEnvelope): void {
    const receivedAt = new Date().toISOString()

    switch (envelope.channel) {
        case 'connected':
            state.competition.connected = envelope.data
            return

        case 'competitions':
            state.availableCompetitions = envelope.data.slice()
            if (state.selectedCompetitionId === null || !state.availableCompetitions.some(
                (competition) => competition.competition_id === state.selectedCompetitionId,
            )) {
                state.selectedCompetitionId = state.availableCompetitions[0]?.competition_id ?? null
                syncSelectedCompetitionState()
            }
            return

        case 'activity':
            applyActivityEnvelope(envelope.data)
            return

        case 'leaderboard':
            applyCompetitionStateUpdate(envelope, receivedAt, (competitionState) => ({
                ...competitionState,
                leaderboard: {
                    ...envelope.data,
                    traders: withManualTraderFields(envelope.data.traders, competitionState.leaderboard?.traders)
                        .sort((left, right) => left.user_id.localeCompare(right.user_id)),
                },
            }))
            return

        case 'pnl':
            applyCompetitionStateUpdate(envelope, receivedAt, (competitionState) => ({
                ...competitionState,
                pnl: mergeLatestTickIntoPnl(envelope.data, competitionState.latestPnlTick),
            }))
            return

        case 'pnl:tick':
            applyCompetitionStateUpdate(envelope, receivedAt, (competitionState) => ({
                ...competitionState,
                latestPnlTick: envelope.data,
                pnl: competitionState.pnl === null
                    ? null
                    : mergeLatestTickIntoPnl(competitionState.pnl, envelope.data),
            }))
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

function getFakeTradeSourceTrader(): LeaderboardTrader | null {
    const traders = getSelectedCompetitionState().leaderboard?.traders ?? []
    if (traders.length === 0) {
        return null
    }

    return traders[randomInt(0, traders.length - 1)] ?? null
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

function syncSelectedCompetitionState(): void {
    const selectedCompetitionId = state.selectedCompetitionId
    state.competition = selectedCompetitionId === null
        ? createEmptyCompetitionState()
        : getCompetitionState(selectedCompetitionId)
}

function getCompetitionState(competitionId: string): CompetitionState {
    return state.competitionStates[competitionId] ?? createEmptyCompetitionState()
}

function setCompetitionState(competitionId: string | null, competitionState: CompetitionState): void {
    if (competitionId !== null) {
        state.competitionStates[competitionId] = competitionState
    }

    if (competitionId === state.selectedCompetitionId || competitionId === null) {
        state.competition = competitionState
    }
}

function applyCompetitionStateUpdate(
    envelope: Exclude<CompetitionEnvelope, { channel: 'connected' | 'competitions' | 'activity' }>,
    receivedAt: string,
    updater: (competitionState: CompetitionState) => CompetitionState,
): void {
    const competitionId = getEnvelopeCompetitionId(envelope) ?? state.selectedCompetitionId
    if (competitionId === null) {
        return
    }

    const currentCompetitionState = getCompetitionState(competitionId)
    const nextCompetitionState = updater({
        ...currentCompetitionState,
        lastChannel: envelope.channel,
        lastMessageAt: receivedAt,
    })
    setCompetitionState(competitionId, nextCompetitionState)
}

function getEnvelopeCompetitionId(
    envelope: Exclude<CompetitionEnvelope, { channel: 'connected' | 'competitions' | 'activity' }>,
): string | null {
    switch (envelope.channel) {
        case 'leaderboard':
            return typeof envelope.data.competition_id === 'string' ? envelope.data.competition_id : null
        case 'pnl':
            return typeof envelope.data.competition_id === 'string' ? envelope.data.competition_id : null
        case 'pnl:tick':
            return typeof envelope.data.competition_id === 'string' ? envelope.data.competition_id : null
    }
}

function randomInt(min: number, max: number): number {
    const lower = Math.ceil(min)
    const upper = Math.floor(max)
    return Math.floor(Math.random() * (upper - lower + 1)) + lower
}

function randomFloat(min: number, max: number): number {
    return Number((Math.random() * (max - min) + min).toFixed(4))
}

function randomSignedFloat(minMagnitude: number, maxMagnitude: number): number {
    const magnitude = randomFloat(minMagnitude, maxMagnitude)
    return Math.random() < 0.5 ? -magnitude : magnitude
}

function sample<T>(values: readonly T[]): T {
    return values[randomInt(0, values.length - 1)]
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
