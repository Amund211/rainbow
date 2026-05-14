import { captureException, captureMessage } from "@sentry/react";
import { queryOptions } from "@tanstack/react-query";

import { env } from "#env.ts";
import { getOrSetUserId } from "#helpers/userId.ts";
import { isNormalizedUUID } from "#helpers/uuid.ts";

import { apiToPlayerDataPIT } from "./playerdata.ts";
import type { APIPlayerDataPIT, PlayerDataPIT } from "./playerdata.ts";
import type { APISession, Session } from "./sessions.ts";
import { apiToSession } from "./sessions.ts";

interface APISessionAtResponse {
    readonly session: APISession | null;
    readonly history: readonly APIPlayerDataPIT[];
}

export interface SessionAt {
    readonly session: Session | null;
    readonly history: readonly PlayerDataPIT[];
}

interface SessionAtQueryOptions {
    readonly uuid: string;
    readonly time: Date;
}

export const getSessionAtQueryOptions = ({ uuid, time }: SessionAtQueryOptions) => {
    const timeISOString = time.toISOString();

    return queryOptions({
        staleTime: Infinity,
        queryKey: ["sessionAt", uuid, timeISOString],
        queryFn: async (): Promise<SessionAt> => {
            if (!isNormalizedUUID(uuid)) {
                captureMessage("Failed to get session-at: uuid is not normalized", {
                    level: "error",
                    extra: { uuid, time: timeISOString },
                });
                throw new Error(`UUID not normalized: ${uuid}`);
            }

            const response = await fetch(
                // NOTE: The flashlight API does **not** allow third-party access.
                //       Do not send any requests to any endpoints without explicit permission.
                //       Reach out on Discord for more information. https://discord.gg/k4FGUnEHYg
                `${env.VITE_FLASHLIGHT_URL}/v1/session-at`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-User-Id": getOrSetUserId(),
                    },
                    method: "POST",
                    body: JSON.stringify({ uuid, time: timeISOString }),
                },
            ).catch((error: unknown) => {
                captureException(error, {
                    extra: {
                        uuid,
                        time: timeISOString,
                        message: "Failed to get session-at: failed to fetch",
                    },
                });
                throw error;
            });

            if (!response.ok) {
                const text = await response.text().catch(() => "");
                captureMessage("Failed to get session-at: response error", {
                    level: "error",
                    tags: {
                        status: response.status,
                        statusText: response.statusText,
                    },
                    extra: { uuid, time: timeISOString, text },
                });
                throw new Error(
                    `Failed to fetch session-at. ${response.status.toString()} - ${response.statusText}`,
                );
            }

            const data = (await response.json().catch((error: unknown) => {
                captureException(error, {
                    extra: {
                        uuid,
                        time: timeISOString,
                        message: "Failed to get session-at: failed to parse json",
                    },
                });
                throw error;
            })) as APISessionAtResponse;

            return {
                session:
                    data.session === null ? null : apiToSession(data.session, false),
                history: data.history.map((pit) => apiToPlayerDataPIT(pit)),
            };
        },
    });
};
