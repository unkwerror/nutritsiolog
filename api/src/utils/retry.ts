export async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 1000
): Promise<T> {
    try {
        return await fn()
    } catch (err) {
        const status = typeof err === 'object' && err !== null && 'status' in err
            ? (err as { status: number }).status
            : null

        if (status === 503 && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay))
            return withRetry(fn, retries - 1, delay * 2)
        }
        throw err
    }
}