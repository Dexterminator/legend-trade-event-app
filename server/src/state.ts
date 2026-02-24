export interface State {
    standings: string
    score: string
    ticker: string
}

export const state: State = {
    standings: '',
    score: '',
    ticker: '',
}

export function updateState(partial: Partial<State>): void {
    Object.assign(state, partial)
}
