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

export interface WrappedData {
    success: boolean;
    uuid: string;
    year: number;
    totalSessions: number;
    nonConsecutiveSessions: number;
    sessionLengths?: {
        totalHours: number;
        longestHours: number;
        shortestHours: number;
        averageHours: number;
    };
    sessionsPerMonth?: Record<string, number>;
    bestSessions?: {
        highestFKDR: BestSession;
        mostKills: BestSession;
        mostFinalKills: BestSession;
        mostWins: BestSession;
        longestSession: BestSession;
        mostWinsPerHour: BestSession;
        mostFinalsPerHour: BestSession;
    };
    averages?: {
        sessionLengthHours: number;
        gamesPlayed: number;
        wins: number;
        finalKills: number;
    };
    yearStats?: {
        start: PlayerDataPIT;
        end: PlayerDataPIT;
    };
    winstreaks?: {
        overall: StreakInfo;
        solo: StreakInfo;
        doubles: StreakInfo;
        threes: StreakInfo;
        fours: StreakInfo;
    };
    finalKillStreaks?: {
        overall: StreakInfo;
        solo: StreakInfo;
        doubles: StreakInfo;
        threes: StreakInfo;
        fours: StreakInfo;
    };
    sessionCoverage?: {
        gamesPlayedPercentage: number;
        adjustedTotalHours: number;
    };
    favoritePlayIntervals?: PlayInterval[];
    flawlessSessions?: {
        count: number;
        percentage: number;
    };
    playtimeDistribution?: PlaytimeDistribution;
}

interface WrappedQueryOptions {
    uuid: string;
    year: number;
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

export const getWrappedQueryOptions = ({ uuid, year }: WrappedQueryOptions) => {
    return queryOptions({
        staleTime: Infinity, // Wrapped data is historical and doesn't change
        queryKey: ["wrapped", uuid, year],
        queryFn: async (): Promise<WrappedData> => {
            if (!isNormalizedUUID(uuid)) {
                captureMessage(
                    "Failed to get wrapped: uuid is not normalized",
                    {
                        level: "error",
                        extra: {
                            uuid,
                            year,
                        },
                    },
                );
                throw new Error(`UUID not normalized: ${uuid}`);
            }

            const response = await fetch(
                `${env.VITE_FLASHLIGHT_URL}/v1/wrapped/${uuid}/${year.toString()}`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-User-Id": getOrSetUserId(),
                    },
                    method: "GET",
                },
            ).catch((error: unknown) => {
                captureException(error, {
                    extra: {
                        uuid,
                        year,
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

            const wrappedData = (await response
                .json()
                .catch((error: unknown) => {
                    response
                        .text()
                        .then((text) => {
                            captureException(error, {
                                extra: {
                                    message:
                                        "Failed to get wrapped: failed to parse json",
                                    uuid,
                                    year,
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
                                    jsonParseError: error,
                                },
                            });
                        });
                    throw error;
                })) as any; // Use any temporarily since API structure is different

            // Convert the PascalCase API response to camelCase
            const convertedData: WrappedData = {
                ...wrappedData,
                yearStats: {
                    start: convertAPIPlayerDataPIT(wrappedData.yearStats.start),
                    end: convertAPIPlayerDataPIT(wrappedData.yearStats.end),
                },
            };

            return convertedData;
        },
    });
};
