import { describe, test, expect, beforeAll, afterAll } from "vitest";
import {
    LOCAL_DEVELOPMENT_USER_ID,
    newUserId,
    STAGING_USER_ID,
    validateUserId,
} from "./userId.ts";
import { isNormalizedUUID } from "./uuid.ts";

describe("newUserId", () => {
    describe("should generate a new user ID like rnb_<uuid-v4>", () => {
        for (let i = 0; i < 10; i++) {
            const userId = newUserId();
            test(userId, () => {
                expect(
                    userId.startsWith("rnb_"),
                    "User ID should start with 'rnb_'",
                ).toBeTruthy();

                const suffix = userId.slice(4);

                expect(
                    isNormalizedUUID(suffix),
                    "User ID suffix should be a normalized UUID",
                ).toBeTruthy();
            });
        }
    });

    describe("should generate a new user ID that passes validation", () => {
        for (let i = 0; i < 10; i++) {
            const userId = newUserId();
            test(userId, () => {
                expect(
                    validateUserId(userId),
                    "User ID should be valid",
                ).toBeTruthy();
            });
        }
    });

    describe("without crypto.randomUUID", () => {
        let originalRandomUUID: typeof crypto.randomUUID | undefined;
        beforeAll(() => {
            originalRandomUUID = crypto.randomUUID.bind(crypto);

            // Simulate an environment without crypto.randomUUID
            crypto.randomUUID =
                undefined as unknown as typeof crypto.randomUUID;
        });
        afterAll(() => {
            expect(
                originalRandomUUID,
                "crypto.randomUUID should be restored after the test",
            ).toBeTruthy();
            crypto.randomUUID = originalRandomUUID!;
        });

        test(
            "should generate a new user ID like rnb_<random-string>",
            () => {
                for (let i = 0; i < 10; i++) {
                    const userId = newUserId();
                    expect(
                        userId.startsWith("rnb_"),
                        "User ID should start with 'rnb_'",
                    ).toBeTruthy();

                    const suffix = userId.slice(4);

                    expect(
                        /^([a-f0-9-]+-){3}([a-f0-9-]+)$/.test(suffix),
                        "User ID suffix should be a four random hex strings",
                    ).toBeTruthy();

                    expect(
                        suffix.split("-").length,
                        "User ID suffix should consist of 4 parts",
                    ).toBe(4);

                    for (const part of suffix.split("-")) {
                        expect(
                            part.length,
                            "Each part of the user ID suffix should be 12 characters long",
                        ).toBe(12);
                    }
                }
            },
        );

        test(
            "should generate a new user ID that passes validation",
            () => {
                for (let i = 0; i < 10; i++) {
                    const userId = newUserId();
                    expect(
                        validateUserId(userId),
                        "User ID should be valid",
                    ).toBeTruthy();
                }
            },
        );
    });
});

describe("getOrSetUserId", () => {
    test("in development mode", () => {
        // We use import.meta.env.DEV to return this from getOrSetUserId(), so we can't test
        // in node. Instead we just do some basic checks on the exported constant.
        expect(
            validateUserId(LOCAL_DEVELOPMENT_USER_ID),
            "Development user ID should be valid",
        ).toBeTruthy();

        expect(
            LOCAL_DEVELOPMENT_USER_ID.startsWith("rnb_"),
            "Development user ID should start with 'rnb_'",
        ).toBeTruthy();

        expect(LOCAL_DEVELOPMENT_USER_ID).toBe("rnb_local_development");
    });

    test("in staging", () => {
        // We use the current hostname to return this from getOrSetUserId(), so we don't test
        // this here. Instead we just do some basic checks on the exported constant.
        expect(
            validateUserId(STAGING_USER_ID),
            "Staging user ID should be valid",
        ).toBeTruthy();

        expect(
            STAGING_USER_ID.startsWith("rnb_"),
            "Staging user ID should start with 'rnb_'",
        ).toBeTruthy();

        expect(STAGING_USER_ID).toBe("rnb_staging");
    });
});

describe("validateUserId", () => {
    const cases = [
        {
            input: "rnb_4a6113bb-5f94-4bc6-9e71-fc94e90c1fb2",
            expected: true,
        },
        {
            input: "rnb_custom_suffix",
            expected: true,
        },
        {
            input: "rnb_local_development",
            expected: true,
        },
        {
            input: LOCAL_DEVELOPMENT_USER_ID,
            expected: true,
        },
        {
            input: null,
            expected: false,
        },
        {
            input: "invalid_prefix_0123456789abcdef0123456789abcdef",
            expected: false,
        },
        {
            input: "Rnb_invalid_prefix",
            expected: false,
        },
    ];

    for (const tc of cases) {
        test(tc.input ?? "<null>", () => {
            const result = validateUserId(tc.input);
            expect(result).toBe(tc.expected);
        });
    }
});
