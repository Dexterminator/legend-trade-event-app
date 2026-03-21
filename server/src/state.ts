export interface Contestant {
    contestant_number: string
    name: string
    wallet_address: string
    profile_url: string
    is_out: boolean
}

export interface UserState {
    payload?: unknown
    contestant?: Contestant
}

export interface State {
    standings: string
    score: string
    ticker: string
    users: Record<string, UserState>
}

export const state: State = {
    standings: '',
    score: '',
    ticker: '',
    users: {},
}

export function updateState(partial: Partial<State>): void {
    Object.assign(state, partial)
}

export function setUserPayload(userAddress: string, payload: unknown): void {
    const key = userAddress.toLowerCase()
    state.users[key] = {
        ...state.users[key],
        payload,
    }
}

export function setContestants(contestantsByWallet: Record<string, Contestant>): void {
    const nextWallets = new Set(Object.keys(contestantsByWallet))

    // Remove stale contestant entries while preserving existing payload data.
    for (const [wallet, current] of Object.entries(state.users)) {
        if (current.contestant && !nextWallets.has(wallet)) {
            const { contestant: _contestant, ...rest } = current
            state.users[wallet] = rest
        }
    }

    for (const [wallet, contestant] of Object.entries(contestantsByWallet)) {
        state.users[wallet] = {
            ...state.users[wallet],
            contestant,
        }
    }
}
