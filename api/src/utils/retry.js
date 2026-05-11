

export async function withRetry(fn, retries = 3, delay = 1000) {
    try {
        return await fn()
    } catch (err) {
        if(err.status === 503 && retries > 0){
            await new Promise(resolve => setTimeout(resolve, delay))
            return withRetry(fn, retries - 1, delay * 2)
        }
        throw err
    }
}