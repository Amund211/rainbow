import * as Sentry from "@sentry/react";

import { env } from "#env.ts";

if (env.VITE_SENTRY_DSN) {
    Sentry.init({
        dsn: env.VITE_SENTRY_DSN,
        // Setting this option to true will send default PII data to Sentry.
        // For example, automatic IP address collection on events
        sendDefaultPii: true,
    });
}
