import { queryOptions } from "@tanstack/react-query";
import { env } from "#env.ts";
import { isNormalizedUUID } from "#helpers/uuid.ts";
import { captureException, captureMessage } from "@sentry/react";
import { getOrSetUserId } from "#helpers/userId.ts";
import {
    apiToPlayerDataPIT,
    type APIPlayerDataPIT,
    type PlayerDataPIT,
} from "./playerdata.ts";
import { apiToSession, type APISession, type Session } from "./sessions.ts";

interface StreakInfo {
    highest: number;
    when: string;
}

interface PlayInterval {
    hourStart: number;
    hourEnd: number;
    percentage: number;
}

interface PlaytimeDistribution {
    hourlyDistribution: number[]; // 24 elements for UTC hours 0-23
    dayHourDistribution: Record<string, number[]>; // Weekday name -> 24 elements for UTC hours
}

// API Session statistics - as returned from API before conversion
interface APISessionStats {
    sessionLengths: {
        totalHours: number;
        longestHours: number;
        shortestHours: number;
        averageHours: number;
    };
    sessionsPerMonth: Record<string, number>;
    bestSessions: {
        highestFKDR: APISession;
        mostKills: APISession;
        mostFinalKills: APISession;
        mostWins: APISession;
        longestSession: APISession;
        mostWinsPerHour: APISession;
        mostFinalsPerHour: APISession;
    };
    averages: {
        sessionLengthHours: number;
        gamesPlayed: number;
        wins: number;
        finalKills: number;
    };
    winstreaks: {
        overall: StreakInfo;
        solo: StreakInfo;
        doubles: StreakInfo;
        threes: StreakInfo;
        fours: StreakInfo;
    };
    finalKillStreaks: {
        overall: StreakInfo;
        solo: StreakInfo;
        doubles: StreakInfo;
        threes: StreakInfo;
        fours: StreakInfo;
    };
    sessionCoverage: {
        gamesPlayedPercentage: number;
        adjustedTotalHours: number;
    };
    favoritePlayIntervals: PlayInterval[];
    flawlessSessions: {
        count: number;
        percentage: number;
    };
    playtimeDistribution: PlaytimeDistribution;
}

// Session statistics - only present when there is at least one consecutive session
interface SessionStats {
    sessionLengths: {
        totalHours: number;
        longestHours: number;
        shortestHours: number;
        averageHours: number;
    };
    sessionsPerMonth: Record<string, number>;
    bestSessions: {
        highestFKDR: Session;
        mostKills: Session;
        mostFinalKills: Session;
        mostWins: Session;
        longestSession: Session;
        mostWinsPerHour: Session;
        mostFinalsPerHour: Session;
    };
    averages: {
        sessionLengthHours: number;
        gamesPlayed: number;
        wins: number;
        finalKills: number;
    };
    winstreaks: {
        overall: StreakInfo;
        solo: StreakInfo;
        doubles: StreakInfo;
        threes: StreakInfo;
        fours: StreakInfo;
    };
    finalKillStreaks: {
        overall: StreakInfo;
        solo: StreakInfo;
        doubles: StreakInfo;
        threes: StreakInfo;
        fours: StreakInfo;
    };
    sessionCoverage: {
        gamesPlayedPercentage: number;
        adjustedTotalHours: number;
    };
    favoritePlayIntervals: PlayInterval[];
    flawlessSessions: {
        count: number;
        percentage: number;
    };
    playtimeDistribution: PlaytimeDistribution;
}

// API response structure (before conversion)
interface APIWrappedData {
    success: boolean;
    uuid: string;
    year: number;
    totalSessions: number;
    nonConsecutiveSessions: number;
    yearStats?: {
        start: APIPlayerDataPIT;
        end: APIPlayerDataPIT;
    };
    sessionStats?: APISessionStats;
    cause?: string;
}

export interface WrappedData {
    success: boolean;
    uuid: string;
    year: number;
    totalSessions: number;
    nonConsecutiveSessions: number;
    yearStats?: {
        start: PlayerDataPIT;
        end: PlayerDataPIT;
    };
    // Session stats are nested and only present when there's at least one consecutive session
    sessionStats?: SessionStats;
    cause?: string;
}

interface WrappedQueryOptions {
    uuid: string;
    year: number;
    timezone?: string; // IANA timezone (e.g., "Europe/Oslo", "America/New_York")
}

export const getWrappedQueryOptions = ({
    uuid,
    year,
    timezone,
}: WrappedQueryOptions) => {
    // Get user's timezone if not provided
    const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

    return queryOptions({
        staleTime: Infinity, // Wrapped data is historical and doesn't change
        queryKey: ["wrapped", uuid, year, tz],
        queryFn: async (): Promise<WrappedData> => {
            if (!isNormalizedUUID(uuid)) {
                captureMessage(
                    "Failed to get wrapped: uuid is not normalized",
                    {
                        level: "error",
                        extra: {
                            uuid,
                            year,
                            timezone: tz,
                        },
                    },
                );
                throw new Error(`UUID not normalized: ${uuid}`);
            }

            const url = new URL(
                `${env.VITE_FLASHLIGHT_URL}/v1/wrapped/${uuid}/${year.toString()}`,
            );
            url.searchParams.set("timezone", tz);

            const response = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    "X-User-Id": getOrSetUserId(),
                },
                method: "GET",
            }).catch((error: unknown) => {
                captureException(error, {
                    extra: {
                        uuid,
                        year,
                        timezone: tz,
                        message: "Failed to get wrapped: failed to fetch",
                    },
                });
                throw error;
            });

            if (!response.ok) {
                const text = await response.text().catch((error: unknown) => {
                    captureException(error, {
                        tags: {
                            status: response.status,
                            statusText: response.statusText,
                        },
                        extra: {
                            message:
                                "Failed to get wrapped: failed to read response text when handling response error",
                            uuid,
                            year,
                        },
                    });
                    throw error;
                });
                captureMessage("Failed to get wrapped: response error", {
                    level: "error",
                    tags: {
                        status: response.status,
                        statusText: response.statusText,
                    },
                    extra: {
                        uuid,
                        year,
                        text,
                    },
                });
                throw new Error(
                    `Failed to fetch wrapped data from API. ${response.status.toString()} - ${response.statusText}: ${text}`,
                );
            }

            const apiData = (await response.json().catch((error: unknown) => {
                response
                    .text()
                    .then((text) => {
                        captureException(error, {
                            extra: {
                                message:
                                    "Failed to get wrapped: failed to parse json",
                                uuid,
                                year,
                                timezone: tz,
                                text,
                            },
                        });
                    })
                    .catch((textError: unknown) => {
                        captureException(textError, {
                            extra: {
                                message:
                                    "Failed to get wrapped: failed to read response text when handling response error",
                                uuid,
                                year,
                                timezone: tz,
                                jsonParseError: error,
                            },
                        });
                    });
                throw error;
            })) as APIWrappedData;

            // Convert the API response to application format, keeping nested structure
            const convertedData: WrappedData = {
                success: apiData.success,
                uuid: apiData.uuid,
                year: apiData.year,
                totalSessions: apiData.totalSessions,
                nonConsecutiveSessions: apiData.nonConsecutiveSessions,
                yearStats: apiData.yearStats
                    ? {
                          start: apiToPlayerDataPIT(apiData.yearStats.start),
                          end: apiToPlayerDataPIT(apiData.yearStats.end),
                      }
                    : undefined,
                // Convert sessionStats, including bestSessions
                sessionStats: apiData.sessionStats
                    ? {
                          ...apiData.sessionStats,
                          bestSessions: {
                              highestFKDR: apiToSession(
                                  apiData.sessionStats.bestSessions.highestFKDR,
                                  false,
                              ),
                              mostKills: apiToSession(
                                  apiData.sessionStats.bestSessions.mostKills,
                                  false,
                              ),
                              mostFinalKills: apiToSession(
                                  apiData.sessionStats.bestSessions
                                      .mostFinalKills,
                                  false,
                              ),
                              mostWins: apiToSession(
                                  apiData.sessionStats.bestSessions.mostWins,
                                  false,
                              ),
                              longestSession: apiToSession(
                                  apiData.sessionStats.bestSessions
                                      .longestSession,
                                  false,
                              ),
                              mostWinsPerHour: apiToSession(
                                  apiData.sessionStats.bestSessions
                                      .mostWinsPerHour,
                                  false,
                              ),
                              mostFinalsPerHour: apiToSession(
                                  apiData.sessionStats.bestSessions
                                      .mostFinalsPerHour,
                                  false,
                              ),
                          },
                      }
                    : undefined,
                cause: apiData.cause,
            };

            return convertedData;
        },
    });
};
