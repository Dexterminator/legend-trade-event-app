export interface State {
    standings: string
    score: string
    ticker: string
    users: Record<string, unknown>
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
    state.users[userAddress.toLowerCase()] = payload
}
