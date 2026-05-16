import { captureException, captureMessage } from "@sentry/react";
import { queryOptions } from "@tanstack/react-query";

import { env } from "#env.ts";
import { getOrSetUserId } from "#helpers/userId.ts";
import { isNormalizedUUID } from "#helpers/uuid.ts";

import { apiToPlayerDataPIT } from "./playerdata.ts";
import type { APIPlayerDataPIT, PlayerDataPIT } from "./playerdata.ts";
import type { APISession, Session } from "./sessions.ts";
import { apiToSession } from "./sessions.ts";

export type Gamemode = "solo" | "doubles" | "threes" | "fours";

const isGamemode = (value: unknown): value is Gamemode =>
    value === "solo" || value === "doubles" || value === "threes" || value === "fours";

interface APIGameResult {
    readonly gamemode: string;
    readonly won: boolean;
    readonly finalKills: number;
    readonly finalDeath: boolean;
    readonly bedsBroken: number;
    readonly bedLost: boolean;
    readonly kills: number;
    readonly deaths: number;
    readonly xpGained: number;
}

interface APIGameSegment {
    readonly start: APIPlayerDataPIT;
    readonly end: APIPlayerDataPIT;
    readonly game: APIGameResult | null;
}

interface APISessionAtResponse {
    readonly session: APISession | null;
    readonly games: readonly APIGameSegment[];
}

export interface GameResult {
    readonly gamemode: Gamemode;
    readonly won: boolean;
    readonly finalKills: number;
    // Booleans: at most one final death and one bed lost happen per game.
    readonly finalDeath: boolean;
    readonly bedsBroken: number;
    readonly bedLost: boolean;
    readonly kills: number;
    readonly deaths: number;
    readonly xpGained: number;
}

export interface GameSegment {
    readonly start: PlayerDataPIT;
    readonly end: PlayerDataPIT;
    // null when the snapshot pair represents zero games (a heartbeat) or
    // more than one game (gamesPlayed jumped by 2+, or multiple modes
    // advanced). Callers should render these specially — e.g. "(no games)"
    // for heartbeats or "(N games played)" for ambiguous stretches.
    readonly game: GameResult | null;
}

export interface SessionAt {
    readonly session: Session | null;
    readonly games: readonly GameSegment[];
}

const apiToGameResult = (api: APIGameResult): GameResult | null => {
    if (!isGamemode(api.gamemode)) {
        captureMessage("Unknown gamemode in session-at response", {
            level: "error",
            extra: { gamemode: api.gamemode },
        });
        return null;
    }
    return {
        gamemode: api.gamemode,
        won: api.won,
        finalKills: api.finalKills,
        finalDeath: api.finalDeath,
        bedsBroken: api.bedsBroken,
        bedLost: api.bedLost,
        kills: api.kills,
        deaths: api.deaths,
        xpGained: api.xpGained,
    };
};

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
                games: data.games.map(
                    (seg): GameSegment => ({
                        start: apiToPlayerDataPIT(seg.start),
                        end: apiToPlayerDataPIT(seg.end),
                        game: seg.game === null ? null : apiToGameResult(seg.game),
                    }),
                ),
            };
        },
    });
};
