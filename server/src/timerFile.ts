import { writeFile } from 'node:fs/promises'
import { getSelectedCompetitionTimerWindow } from './state.js'

const TIMER_UPDATE_INTERVAL_MS = 500
const DEFAULT_TIMER_VALUE = '30:00'

let timerInterval: ReturnType<typeof setInterval> | null = null
let timerFilePath: string | null = null
let lastWrittenValue: string | null = null
let pendingValue: string | null = null
let writeChain: Promise<void> = Promise.resolve()

export function startTimerFileWriter(filePath: string): void {
    timerFilePath = filePath

    if (timerInterval !== null) {
        clearInterval(timerInterval)
    }

    syncTimerFile()
    timerInterval = setInterval(() => {
        syncTimerFile()
    }, TIMER_UPDATE_INTERVAL_MS)
}

export function stopTimerFileWriter(): void {
    if (timerInterval !== null) {
        clearInterval(timerInterval)
        timerInterval = null
    }

    timerFilePath = null
    pendingValue = null
}

function syncTimerFile(): void {
    if (timerFilePath === null) {
        return
    }

    const nextValue = getNextTimerValue()
    if (nextValue === null || nextValue === lastWrittenValue || nextValue === pendingValue) {
        return
    }

    pendingValue = nextValue
    writeChain = writeChain
        .catch(() => undefined)
        .then(async () => {
            if (timerFilePath === null || pendingValue === null) {
                return
            }

            const valueToWrite = pendingValue
            pendingValue = null

            if (valueToWrite === lastWrittenValue) {
                return
            }

            await writeFile(timerFilePath, valueToWrite, 'utf8')
            lastWrittenValue = valueToWrite
        })
        .catch((error: unknown) => {
            console.error('Failed to update competition timer file', { filePath: timerFilePath, error })
        })
}

function getNextTimerValue(): string | null {
    const timerWindow = getSelectedCompetitionTimerWindow()

    if (timerWindow.startedAt === null || timerWindow.endsAt === null) {
        return timerWindow.hasObservedValidWindow ? null : DEFAULT_TIMER_VALUE
    }

    const remainingMs = Math.max(timerWindow.endsAt - Date.now(), 0)
    return formatTimerValue(remainingMs)
}

function formatTimerValue(remainingMs: number): string {
    const totalSeconds = Math.floor(remainingMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}