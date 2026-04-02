export interface State {
    object: Record<string, unknown>
}

export const state: State = {
    object: {
        connected: false,
        counter: 0,
        source: 'idle',
        updatedAt: new Date(0).toISOString(),
    },
}

export function setStateObject(nextObject: Record<string, unknown>): void {
    state.object = nextObject
}

export function patchStateObject(partial: Record<string, unknown>): void {
    state.object = {
        ...state.object,
        ...partial,
    }
}
