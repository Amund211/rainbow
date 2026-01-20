import test from "node:test";
import assert from "node:assert";
import {
    createRateLimiter,
    checkRateLimit,
    retryOnRateLimit,
    RateLimitError,
} from "./rateLimiter.ts";

await test("RateLimitError", async (t) => {
    await t.test("should be instance of Error", () => {
        const error = new RateLimitError("Test message");
        assert.strictEqual(error instanceof Error, true);
        assert.strictEqual(error.name, "RateLimitError");
        assert.strictEqual(error.message, "Test message");
    });
});

await test("createRateLimiter", async (t) => {
    await t.test("should create a PQueue with correct options", () => {
        const limiter = createRateLimiter({
            concurrency: 1,
            interval: 1000,
            intervalCap: 10,
        });
        assert.strictEqual(limiter.concurrency, 1);
        assert.ok(limiter);
    });
});

await test("checkRateLimit", async (t) => {
    await t.test("should throw RateLimitError when queue is full", () => {
        const limiter = createRateLimiter({
            concurrency: 1,
            interval: 1000,
            intervalCap: 1,
        });

        // Fill the queue beyond the threshold (10x concurrency)
        for (let i = 0; i < 15; i++) {
            void limiter.add(async () => {
                await new Promise((resolve) => {
                    setTimeout(resolve, 100);
                });
            });
        }

        // This should throw because the queue is full
        assert.throws(
            () => {
                checkRateLimit(limiter);
            },
            (error: Error) => {
                return (
                    error instanceof RateLimitError &&
                    error.message === "Rate limit exceeded: queue is full"
                );
            },
        );
    });

    await t.test("should not throw when queue has capacity", () => {
        const limiter = createRateLimiter({
            concurrency: 5,
            interval: 1000,
            intervalCap: 10,
        });

        assert.doesNotThrow(() => {
            checkRateLimit(limiter);
        });
    });
});

await test("retryOnRateLimit", async (t) => {
    await t.test("should execute function successfully", async () => {
        const limiter = createRateLimiter({
            concurrency: 5,
            interval: 1000,
            intervalCap: 10,
        });

        const result = await retryOnRateLimit(
            () => Promise.resolve("success"),
            limiter,
        );

        assert.strictEqual(result, "success");
    });

    await t.test("should throw non-RateLimitError immediately", async () => {
        const limiter = createRateLimiter({
            concurrency: 5,
            interval: 1000,
            intervalCap: 10,
        });

        const customError = new Error("Custom error");

        await assert.rejects(
            () => retryOnRateLimit(() => Promise.reject(customError), limiter),
            (error: Error) => {
                return error === customError;
            },
        );
    });

    await t.test("should execute function with queue", async () => {
        const limiter = createRateLimiter({
            concurrency: 1,
            interval: 1000,
            intervalCap: 5,
        });

        let executionCount = 0;
        const results = await Promise.all([
            retryOnRateLimit(() => {
                executionCount++;
                return Promise.resolve("result1");
            }, limiter),
            retryOnRateLimit(() => {
                executionCount++;
                return Promise.resolve("result2");
            }, limiter),
        ]);

        assert.deepStrictEqual(results, ["result1", "result2"]);
        assert.strictEqual(executionCount, 2);
    });
});
