import PQueue from "p-queue";

export class RateLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RateLimitError";
    }
}

/**
 * Creates a rate limiter using p-queue with timeout enabled
 */
export const createRateLimiter = (options: {
    concurrency: number;
    interval: number;
    intervalCap: number;
}) => {
    return new PQueue({
        concurrency: options.concurrency,
        interval: options.interval,
        intervalCap: options.intervalCap,
    });
};

/**
 * Checks if the rate limiter has capacity to execute a request.
 * Throws RateLimitError if no capacity is available.
 */
export const checkRateLimit = (queue: PQueue) => {
    // Check if the queue is at capacity based on pending and size
    const totalLoad = queue.size + queue.pending;
    if (totalLoad >= queue.concurrency * 10) {
        // Allow 10x concurrency in queue
        throw new RateLimitError("Rate limit exceeded: queue is full");
    }
};

/**
 * Retries a function up to maxRetries times if it throws a RateLimitError
 */
export const retryOnRateLimit = async <T>(
    fn: () => Promise<T>,
    queue: PQueue,
    maxRetries = 5,
): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            checkRateLimit(queue);
            return await queue.add(() => fn());
        } catch (error) {
            if (error instanceof RateLimitError && attempt < maxRetries) {
                lastError = error;
                // Wait before retrying (exponential backoff)
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }

    throw (
        lastError ?? new Error("Failed to execute after maximum retry attempts")
    );
};
