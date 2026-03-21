import { setContestants, type Contestant } from './state.js'

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1gTpwDkZEItMLKznGBi7-YsXeObdxlvum9LulqSFJ01M/export?format=csv&gid=0'
const POLL_INTERVAL_MS = 5_000

let pollInterval: ReturnType<typeof setInterval> | null = null
let pollingInFlight = false

export function startContestantsSheetPolling(): void {
    if (pollInterval !== null) {
        clearInterval(pollInterval)
    }

    void pollOnce()
    pollInterval = setInterval(() => {
        void pollOnce()
    }, POLL_INTERVAL_MS)
}

export function stopContestantsSheetPolling(): void {
    if (pollInterval !== null) {
        clearInterval(pollInterval)
        pollInterval = null
    }
}

async function pollOnce(): Promise<void> {
    if (pollingInFlight) return
    pollingInFlight = true

    try {
        const response = await fetch(SHEET_CSV_URL)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        const csv = await response.text()
        const rows = parseCsv(csv)
        if (rows.length === 0) {
            console.warn('[contestants] empty sheet response')
            return
        }

        const headers = rows[0].map((header) => header.trim().toLowerCase())
        const index = createHeaderIndex(headers)
        const contestantsByWallet: Record<string, Contestant> = {}

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const walletAddress = (row[index.wallet_address] ?? '').trim().toLowerCase()
            if (walletAddress.length === 0) continue

            contestantsByWallet[walletAddress] = {
                contestant_number: (row[index.contestant_number] ?? '').trim(),
                name: (row[index.name] ?? '').trim(),
                wallet_address: walletAddress,
                profile_url: (row[index.profile_url] ?? '').trim(),
                is_out: parseBoolean((row[index.is_out] ?? '').trim()),
            }
        }

        setContestants(contestantsByWallet)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[contestants] sheet poll failed:', message)
    } finally {
        pollingInFlight = false
    }
}

function parseBoolean(value: string): boolean {
    return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes'
}

function createHeaderIndex(headers: string[]): Record<'contestant_number' | 'name' | 'wallet_address' | 'profile_url' | 'is_out', number> {
    const required = ['contestant_number', 'name', 'wallet_address', 'profile_url', 'is_out'] as const
    const index: Partial<Record<(typeof required)[number], number>> = {}

    for (const key of required) {
        const columnIndex = headers.indexOf(key)
        if (columnIndex === -1) {
            throw new Error(`missing required column: ${key}`)
        }
        index[key] = columnIndex
    }

    return index as Record<'contestant_number' | 'name' | 'wallet_address' | 'profile_url' | 'is_out', number>
}

function parseCsv(input: string): string[][] {
    const rows: string[][] = []
    let currentRow: string[] = []
    let currentCell = ''
    let inQuotes = false

    for (let i = 0; i < input.length; i++) {
        const char = input[i]

        if (char === '"') {
            const next = input[i + 1]
            if (inQuotes && next === '"') {
                currentCell += '"'
                i++
            } else {
                inQuotes = !inQuotes
            }
            continue
        }

        if (!inQuotes && char === ',') {
            currentRow.push(currentCell)
            currentCell = ''
            continue
        }

        if (!inQuotes && (char === '\n' || char === '\r')) {
            if (char === '\r' && input[i + 1] === '\n') {
                i++
            }
            currentRow.push(currentCell)
            rows.push(currentRow)
            currentRow = []
            currentCell = ''
            continue
        }

        currentCell += char
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell)
        rows.push(currentRow)
    }

    return rows
}