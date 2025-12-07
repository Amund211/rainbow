import { queryOptions } from "@tanstack/react-query";
import { env } from "#env.ts";
import { isNormalizedUUID } from "#helpers/uuid.ts";
import { captureException, captureMessage } from "@sentry/react";
import { getOrSetUserId } from "#helpers/userId.ts";
import type { PlayerDataPIT, StatsPIT } from "./playerdata.ts";

interface BestSession {
    start: string;
    end: string;
    value: number;
    durationHours: number;
    stats: {
        gamesPlayed: number;
        wins: number;
        losses: number;
        bedsBroken: number;
        bedsLost: number;
        finalKills: number;
        finalDeaths: number;
        kills: number;
        deaths: number;
    };
}

export type { BestSession };

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
        highestFKDR: BestSession;
        mostKills: BestSession;
        mostFinalKills: BestSession;
        mostWins: BestSession;
        longestSession: BestSession;
        mostWinsPerHour: BestSession;
        mostFinalsPerHour: BestSession;
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
        start: APIPlayerDataPITFromWrapped;
        end: APIPlayerDataPITFromWrapped;
    };
    sessionStats?: SessionStats;
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
    sessionStats?: {
        sessionLengths: {
            totalHours: number;
            longestHours: number;
            shortestHours: number;
            averageHours: number;
        };
        sessionsPerMonth: Record<string, number>;
        bestSessions: {
            highestFKDR: BestSession;
            mostKills: BestSession;
            mostFinalKills: BestSession;
            mostWins: BestSession;
            longestSession: BestSession;
            mostWinsPerHour: BestSession;
            mostFinalsPerHour: BestSession;
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
    };
    cause?: string;
}

interface WrappedQueryOptions {
    uuid: string;
    year: number;
    timezone?: string; // IANA timezone (e.g., "Europe/Oslo", "America/New_York")
}

// API returns PascalCase, we need camelCase for PlayerDataPIT
interface APIPlayerDataPITFromWrapped {
    DBID: string;
    QueriedAt: string;
    UUID: string;
    Displayname: string | null;
    LastLogin: string | null;
    LastLogout: string | null;
    MissingBedwarsStats: boolean;
    Experience: number;
    Solo: {
        Winstreak: number | null;
        GamesPlayed: number;
        Wins: number;
        Losses: number;
        BedsBroken: number;
        BedsLost: number;
        FinalKills: number;
        FinalDeaths: number;
        Kills: number;
        Deaths: number;
    };
    Doubles: {
        Winstreak: number | null;
        GamesPlayed: number;
        Wins: number;
        Losses: number;
        BedsBroken: number;
        BedsLost: number;
        FinalKills: number;
        FinalDeaths: number;
        Kills: number;
        Deaths: number;
    };
    Threes: {
        Winstreak: number | null;
        GamesPlayed: number;
        Wins: number;
        Losses: number;
        BedsBroken: number;
        BedsLost: number;
        FinalKills: number;
        FinalDeaths: number;
        Kills: number;
        Deaths: number;
    };
    Fours: {
        Winstreak: number | null;
        GamesPlayed: number;
        Wins: number;
        Losses: number;
        BedsBroken: number;
        BedsLost: number;
        FinalKills: number;
        FinalDeaths: number;
        Kills: number;
        Deaths: number;
    };
    Overall: {
        Winstreak: number | null;
        GamesPlayed: number;
        Wins: number;
        Losses: number;
        BedsBroken: number;
        BedsLost: number;
        FinalKills: number;
        FinalDeaths: number;
        Kills: number;
        Deaths: number;
    };
}

const convertAPIPlayerDataPIT = (
    apiData: APIPlayerDataPITFromWrapped,
): PlayerDataPIT => {
    const convertStats = (
        stats: APIPlayerDataPITFromWrapped["Solo"],
    ): StatsPIT => ({
        winstreak: stats.Winstreak,
        gamesPlayed: stats.GamesPlayed,
        wins: stats.Wins,
        losses: stats.Losses,
        bedsBroken: stats.BedsBroken,
        bedsLost: stats.BedsLost,
        finalKills: stats.FinalKills,
        finalDeaths: stats.FinalDeaths,
        kills: stats.Kills,
        deaths: stats.Deaths,
    });

    return {
        uuid: apiData.UUID,
        queriedAt: new Date(apiData.QueriedAt),
        experience: apiData.Experience,
        solo: convertStats(apiData.Solo),
        doubles: convertStats(apiData.Doubles),
        threes: convertStats(apiData.Threes),
        fours: convertStats(apiData.Fours),
        overall: convertStats(apiData.Overall),
    };
};

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

            // Convert the PascalCase API response to camelCase, keeping nested structure
            const convertedData: WrappedData = {
                success: apiData.success,
                uuid: apiData.uuid,
                year: apiData.year,
                totalSessions: apiData.totalSessions,
                nonConsecutiveSessions: apiData.nonConsecutiveSessions,
                yearStats: apiData.yearStats
                    ? {
                          start: convertAPIPlayerDataPIT(
                              apiData.yearStats.start,
                          ),
                          end: convertAPIPlayerDataPIT(apiData.yearStats.end),
                      }
                    : undefined,
                // Keep sessionStats nested as returned from API
                sessionStats: apiData.sessionStats,
                cause: apiData.cause,
            };

            return convertedData;
        },
    });
};
