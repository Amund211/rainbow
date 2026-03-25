import { describe, test, expect } from "vitest";
import { getStat, computeStat } from "./index.ts";
import { bedwarsLevelFromExp } from "./stars.ts";
import { type PlayerDataPIT } from "#queries/playerdata.ts";
import { type History } from "#queries/history.ts";

const makePlayerData = (
    overrides: Partial<PlayerDataPIT> = {},
): PlayerDataPIT => ({
    uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    queriedAt: new Date("2025-06-01"),
    experience: 500000,
    solo: {
        winstreak: 5,
        gamesPlayed: 20,
        wins: 12,
        losses: 8,
        bedsBroken: 30,
        bedsLost: 10,
        finalKills: 40,
        finalDeaths: 10,
        kills: 60,
        deaths: 50,
    },
    doubles: {
        winstreak: null,
        gamesPlayed: 30,
        wins: 22,
        losses: 8,
        bedsBroken: 50,
        bedsLost: 15,
        finalKills: 80,
        finalDeaths: 20,
        kills: 100,
        deaths: 80,
    },
    threes: {
        winstreak: 3,
        gamesPlayed: 20,
        wins: 16,
        losses: 4,
        bedsBroken: 40,
        bedsLost: 8,
        finalKills: 60,
        finalDeaths: 15,
        kills: 80,
        deaths: 60,
    },
    fours: {
        winstreak: 10,
        gamesPlayed: 30,
        wins: 20,
        losses: 10,
        bedsBroken: 60,
        bedsLost: 20,
        finalKills: 100,
        finalDeaths: 25,
        kills: 120,
        deaths: 100,
    },
    overall: {
        winstreak: 10,
        gamesPlayed: 100,
        wins: 70,
        losses: 30,
        bedsBroken: 150,
        bedsLost: 40,
        finalKills: 200,
        finalDeaths: 35,
        kills: 300,
        deaths: 250,
    },
    ...overrides,
});

describe("getStat", () => {
    const playerData = makePlayerData();

    test("returns experience for experience stat", () => {
        expect(getStat(playerData, "overall", "experience")).toBe(500000);
    });

    test("returns stars calculated from experience", () => {
        const stars = getStat(playerData, "overall", "stars");
        expect(stars).toBe(bedwarsLevelFromExp(500000));
    });

    test("returns winstreak (nullable)", () => {
        expect(getStat(playerData, "solo", "winstreak")).toBe(5);
        expect(getStat(playerData, "doubles", "winstreak")).toBeNull();
    });

    test("returns gamemode-specific stats", () => {
        expect(getStat(playerData, "solo", "kills")).toBe(60);
        expect(getStat(playerData, "doubles", "wins")).toBe(22);
        expect(getStat(playerData, "overall", "finalKills")).toBe(200);
    });

    test("computes fkdr correctly", () => {
        // overall: 200 / 35
        expect(getStat(playerData, "overall", "fkdr")).toBeCloseTo(200 / 35, 5);
    });

    test("computes fkdr when finalDeaths is 0", () => {
        const data = makePlayerData({
            overall: {
                ...playerData.overall,
                finalDeaths: 0,
                finalKills: 50,
            },
        });
        expect(getStat(data, "overall", "fkdr")).toBe(50);
    });

    test("computes kdr correctly", () => {
        // overall: 300 / 250
        expect(getStat(playerData, "overall", "kdr")).toBeCloseTo(300 / 250, 5);
    });

    test("computes kdr when deaths is 0", () => {
        const data = makePlayerData({
            overall: { ...playerData.overall, deaths: 0, kills: 100 },
        });
        expect(getStat(data, "overall", "kdr")).toBe(100);
    });

    test("computes index as fkdr^2 * stars", () => {
        const fkdr = getStat(playerData, "overall", "fkdr");
        const stars = getStat(playerData, "overall", "stars");
        expect(getStat(playerData, "overall", "index")).toBeCloseTo(
            fkdr ** 2 * stars,
            5,
        );
    });
});

describe("computeStat", () => {
    const baseline = makePlayerData({
        experience: 490000,
        overall: {
            winstreak: 5,
            gamesPlayed: 90,
            wins: 60,
            losses: 25,
            bedsBroken: 140,
            bedsLost: 35,
            finalKills: 180,
            finalDeaths: 30,
            kills: 280,
            deaths: 240,
        },
    });

    const current = makePlayerData({
        experience: 500000,
    });

    const history: History = [baseline];

    test("returns overall stat directly for variant=overall", () => {
        expect(
            computeStat(current, "overall", "kills", "overall", history),
        ).toBe(300);
    });

    test("computes session stat as current - baseline for variant=session", () => {
        // current kills = 300, baseline kills = 280
        expect(
            computeStat(current, "overall", "kills", "session", history),
        ).toBe(20);
    });

    test("computes session wins", () => {
        // current wins = 70, baseline wins = 60
        expect(
            computeStat(current, "overall", "wins", "session", history),
        ).toBe(10);
    });

    test("computes session fkdr from session final kills and deaths", () => {
        // session finalKills = 200 - 180 = 20
        // session finalDeaths = 35 - 30 = 5
        // session fkdr = 20 / 5 = 4
        expect(
            computeStat(current, "overall", "fkdr", "session", history),
        ).toBeCloseTo(4, 5);
    });

    test("computes session kdr from session kills and deaths", () => {
        // session kills = 300 - 280 = 20
        // session deaths = 250 - 240 = 10
        // session kdr = 20 / 10 = 2
        expect(
            computeStat(current, "overall", "kdr", "session", history),
        ).toBeCloseTo(2, 5);
    });

    test("computes session index from session fkdr and stars", () => {
        const fkdr = computeStat(
            current,
            "overall",
            "fkdr",
            "session",
            history,
        );
        const stars = computeStat(
            current,
            "overall",
            "stars",
            "session",
            history,
        );
        expect(
            computeStat(current, "overall", "index", "session", history),
        ).toBeCloseTo(fkdr ** 2 * stars, 5);
    });

    test("returns null for session winstreak when baseline is null", () => {
        const historyWithNullWs: History = [
            makePlayerData({
                overall: { ...baseline.overall, winstreak: null },
            }),
        ];
        expect(
            computeStat(
                current,
                "overall",
                "winstreak",
                "session",
                historyWithNullWs,
            ),
        ).toBeNull();
    });

    test("returns null when history is empty for session variant", () => {
        const emptyHistory: History = [];
        expect(
            computeStat(current, "overall", "kills", "session", emptyHistory),
        ).toBeNull();
    });

    test("handles zero session deaths for fkdr", () => {
        const historyMatch: History = [
            makePlayerData({
                overall: {
                    ...baseline.overall,
                    finalDeaths: 35,
                    finalKills: 190,
                },
            }),
        ];
        // session finalKills = 200 - 190 = 10, session finalDeaths = 35 - 35 = 0
        const result = computeStat(
            current,
            "overall",
            "fkdr",
            "session",
            historyMatch,
        );
        expect(result).toBe(10);
    });

    test("handles zero session deaths for kdr", () => {
        const historyMatch: History = [
            makePlayerData({
                overall: {
                    ...baseline.overall,
                    deaths: 250,
                    kills: 290,
                },
            }),
        ];
        // session kills = 300 - 290 = 10, session deaths = 250 - 250 = 0
        const result = computeStat(
            current,
            "overall",
            "kdr",
            "session",
            historyMatch,
        );
        expect(result).toBe(10);
    });

    test("computes session stat with non-overall gamemode", () => {
        const soloBaseline = makePlayerData({
            solo: {
                winstreak: 3,
                gamesPlayed: 15,
                wins: 8,
                losses: 7,
                bedsBroken: 20,
                bedsLost: 8,
                finalKills: 30,
                finalDeaths: 8,
                kills: 50,
                deaths: 40,
            },
        });
        const soloHistory: History = [soloBaseline];
        // current solo kills = 60, baseline solo kills = 50
        expect(
            computeStat(current, "solo", "kills", "session", soloHistory),
        ).toBe(10);
    });

    test("findBaseline skips null entries and uses first non-null", () => {
        const entryWithNull = makePlayerData({
            overall: { ...baseline.overall, winstreak: null },
        });
        const entryWithValue = makePlayerData({
            overall: { ...baseline.overall, winstreak: 3 },
        });
        const multiHistory: History = [entryWithNull, entryWithValue];
        // First entry has null winstreak, second has 3
        // current winstreak = 10, baseline = 3 => session = 7
        expect(
            computeStat(
                current,
                "overall",
                "winstreak",
                "session",
                multiHistory,
            ),
        ).toBe(7);
    });

    test("computes session experience as current - baseline", () => {
        // current experience = 500000, baseline experience = 490000
        expect(
            computeStat(current, "overall", "experience", "session", history),
        ).toBe(10000);
    });
});
