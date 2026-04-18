import { writeFile } from 'node:fs/promises'
import { getCustomTimerState, getSelectedCompetitionTimerWindow } from './state.js'

const TIMER_UPDATE_INTERVAL_MS = 250
const DEFAULT_TIMER_VALUE = '30:00'

interface TimerWriterState {
    interval: ReturnType<typeof setInterval> | null
    filePath: string | null
    lastWrittenValue: string | null
    pendingValue: string | null
    writeChain: Promise<void>
}

const competitionTimerWriterState: TimerWriterState = {
    interval: null,
    filePath: null,
    lastWrittenValue: null,
    pendingValue: null,
    writeChain: Promise.resolve(),
}

const customTimerWriterState: TimerWriterState = {
    interval: null,
    filePath: null,
    lastWrittenValue: null,
    pendingValue: null,
    writeChain: Promise.resolve(),
}

export function startTimerFileWriter(filePath: string): void {
    startWriter(competitionTimerWriterState, filePath, getNextCompetitionTimerValue, 'competition timer')
}

export function stopTimerFileWriter(): void {
    stopWriter(competitionTimerWriterState)
}

export function startCustomTimerFileWriter(filePath: string): void {
    startWriter(customTimerWriterState, filePath, getNextCustomTimerValue, 'custom timer')
}

export function stopCustomTimerFileWriter(): void {
    stopWriter(customTimerWriterState)
}

function startWriter(
    writerState: TimerWriterState,
    filePath: string,
    getNextValue: () => string | null,
    logLabel: string,
): void {
    writerState.filePath = filePath

    if (writerState.interval !== null) {
        clearInterval(writerState.interval)
    }

    syncWriter(writerState, getNextValue, logLabel)
    writerState.interval = setInterval(() => {
        syncWriter(writerState, getNextValue, logLabel)
    }, TIMER_UPDATE_INTERVAL_MS)
}

function stopWriter(writerState: TimerWriterState): void {
    if (writerState.interval !== null) {
        clearInterval(writerState.interval)
        writerState.interval = null
    }

    writerState.filePath = null
    writerState.pendingValue = null
}

function syncWriter(
    writerState: TimerWriterState,
    getNextValue: () => string | null,
    logLabel: string,
): void {
    if (writerState.filePath === null) {
        return
    }

    const nextValue = getNextValue()
    if (nextValue === null || nextValue === writerState.lastWrittenValue || nextValue === writerState.pendingValue) {
        return
    }

    writerState.pendingValue = nextValue
    writerState.writeChain = writerState.writeChain
        .catch(() => undefined)
        .then(async () => {
            if (writerState.filePath === null || writerState.pendingValue === null) {
                return
            }

            const valueToWrite = writerState.pendingValue
            writerState.pendingValue = null

            if (valueToWrite === writerState.lastWrittenValue) {
                return
            }

            await writeFile(writerState.filePath, valueToWrite, 'utf8')
            writerState.lastWrittenValue = valueToWrite
        })
        .catch((error: unknown) => {
            console.error(`Failed to update ${logLabel} file`, { filePath: writerState.filePath, error })
        })
}

function getNextCompetitionTimerValue(): string | null {
    const timerWindow = getSelectedCompetitionTimerWindow()

    if (timerWindow.startedAt === null || timerWindow.endsAt === null) {
        return timerWindow.hasObservedValidWindow ? null : DEFAULT_TIMER_VALUE
    }

    const remainingMs = Math.max(timerWindow.endsAt - Date.now(), 0)
    return formatTimerValue(remainingMs)
}

function getNextCustomTimerValue(): string | null {
    return formatTimerValue(getCustomTimerState().remainingMs)
}

function formatTimerValue(remainingMs: number): string {
    const totalSeconds = Math.floor(remainingMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}