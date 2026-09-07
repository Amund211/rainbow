import {
    Alert,
    Button,
    Divider,
    LinearProgress,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import React from "react";

import {
    MAX_DIFFICULTY,
    POW_ALGORITHM,
    solveChallenge,
} from "#helpers/flashlight/auth/proofOfWork.ts";
import { solve } from "#helpers/flashlight/auth/solve.ts";

// flashlight's challengeTTL. It is measured from minting, so both round trips
// and the solve have to fit inside it — that, not MAX_DIFFICULTY, is what caps
// the difficulty that actually works.
const CHALLENGE_TTL_SECONDS = 60;

// Solve time is geometric in the number of attempts, so a mean says little on
// its own: the tail is what decides whether a difficulty is usable. For the
// exponential it approximates, p95 is ln(20) means and p99 is ln(100).
const P95_FACTOR = Math.log(20);
const P99_FACTOR = Math.log(100);

// What the wait costs the user, in seconds of p95 — the page load one visitor
// in twenty gets, not the average one. No flashlight request carries a bearer
// until the handshake finishes, so this is dead time before any stats load.
//
// These are the numbers the whole page exists to place a difficulty against.
// They are judgement calls about perception, not measurements: a second is
// under the threshold where a wait registers as a wait at all, three is where
// one is clearly there but excusable on a cold load, and ten is where a
// visitor starts reading the page as broken.
const IMPERCEPTIBLE_UNTIL_SECONDS = 1;
const NOTICEABLE_FROM_SECONDS = 3;
const PAINFUL_FROM_SECONDS = 10;

// The band worth reporting estimates over. Below this the numbers are noise
// next to the worker startup; above it is over flashlight's own ceiling.
const ESTIMATE_FROM = 10;

// Worst to best is the order that matters: a verdict is "at least as bad as"
// another one. Kept in step with prism's benchmark, so the two clients'
// numbers are read on one scale.
const VERDICTS = [
    "imperceptible",
    "fine",
    "noticeable",
    "painful",
    "unusable — the tail expires",
    "does not converge",
] as const;

type Verdict = (typeof VERDICTS)[number];

// The first verdict a user would actually feel. Everything from here up is the
// answer to "where does this start to hurt".
const FIRST_HURTING_VERDICT: Verdict = "noticeable";

// Not a cost but a failure: the handshake does not complete inside the TTL, so
// the client loops on challenges that expire under it.
const BROKEN_VERDICTS: readonly Verdict[] = [
    "unusable — the tail expires",
    "does not converge",
];

const hurts = (verdict: Verdict): boolean =>
    VERDICTS.indexOf(verdict) >= VERDICTS.indexOf(FIRST_HURTING_VERDICT);

const encoder = new TextEncoder();

const randomBytes = (length: number): Uint8Array =>
    crypto.getRandomValues(new Uint8Array(length));

const toBase64Url = (bytes: Uint8Array): string =>
    btoa(String.fromCodePoint(...bytes))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");

const toHex = (bytes: Uint8Array): string =>
    [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 * A random id in a UUID's shape.
 *
 * Not `crypto.randomUUID`: that one exists only in a secure context, and this
 * page is meant to be reachable from a phone pointed at the dev server over
 * plain http. Nothing here reads the value — only its length matters, since
 * that is part of what each attempt hashes — so the version and variant bits
 * are not worth the bit twiddling.
 */
const randomIdInUuidShape = (): string => {
    const hex = toHex(randomBytes(16));
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
    ].join("-");
};

/**
 * Whether the real solver can run here at all.
 *
 * `crypto.subtle` is secure-context only. Over plain http on a LAN address the
 * browser hides it, and `solveChallenge` cannot hash anything — so there is
 * nothing to measure. Checked up front, because the alternative is a run that
 * throws on its first attempt.
 */
const canSolveHere = (): boolean =>
    globalThis.isSecureContext &&
    (crypto as { readonly subtle?: SubtleCrypto }).subtle !== undefined;

/**
 * A challenge value shaped like the ones flashlight mints: base64url of the
 * signed payload, a ".", then a base64url HMAC-SHA256.
 *
 * The shape matters for the measurement, not just for looks. Each attempt
 * hashes `challenge:solution`, so the ~320 characters of a real challenge cost
 * six SHA-256 blocks where a short stand-in would cost one — benchmarking a
 * short string would overstate the hash rate several times over.
 */
const mintFakeChallenge = (difficulty: number): string => {
    const payload = JSON.stringify({
        nonce: toBase64Url(randomBytes(16)),
        userId: randomIdInUuidShape(),
        ipHash: toHex(randomBytes(32)),
        issuedAtUnixMillis: Date.now(),
        difficulty,
        alg: POW_ALGORITHM,
    });
    return `${toBase64Url(encoder.encode(payload))}.${toBase64Url(randomBytes(32))}`;
};

type Mode = "worker" | "main";

interface Run {
    readonly id: number;
    readonly difficulty: number;
    readonly durationMs: number;
    readonly hashes: number;
}

/**
 * Solve one freshly minted fake challenge and time it.
 *
 * Worker mode goes through `solve`, so it pays for spawning and tearing down a
 * worker on every run — exactly as the real login path does.
 */
const timeOneSolve = async (
    difficulty: number,
    mode: Mode,
): Promise<Omit<Run, "id">> => {
    const challenge = mintFakeChallenge(difficulty);
    const solver = mode === "worker" ? solve : solveChallenge;

    const start = performance.now();
    const solution = await solver({ challenge, algorithm: POW_ALGORITHM, difficulty });
    const durationMs = performance.now() - start;

    // The solver counts up from 0, so the winning nonce is also the number of
    // attempts before it. Batching means a few more hashes were computed than
    // that; at any interesting difficulty the difference is under a promille.
    return { difficulty, durationMs, hashes: Number(solution) + 1 };
};

const quantile = (sorted: readonly number[], fraction: number): number => {
    if (sorted.length === 0) {
        return Number.NaN;
    }
    const index = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil(fraction * sorted.length) - 1),
    );
    return sorted[index];
};

const sum = (values: readonly number[]): number =>
    values.reduce((total, value) => total + value, 0);

interface Summary {
    readonly difficulty: number;
    readonly count: number;
    readonly meanMs: number;
    readonly medianMs: number;
    readonly minMs: number;
    readonly maxMs: number;
    readonly meanHashes: number;
    readonly hashesPerSecond: number;
}

const summarize = (difficulty: number, runs: readonly Run[]): Summary => {
    const durations = runs.map((run) => run.durationMs).toSorted((a, b) => a - b);
    const totalMs = sum(durations);
    const totalHashes = sum(runs.map((run) => run.hashes));
    return {
        difficulty,
        count: runs.length,
        meanMs: totalMs / runs.length,
        medianMs: quantile(durations, 0.5),
        minMs: quantile(durations, 0),
        maxMs: quantile(durations, 1),
        meanHashes: totalHashes / runs.length,
        hashesPerSecond: (totalHashes / totalMs) * 1000,
    };
};

const formatMs = (ms: number): string =>
    ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`;

const formatCount = (value: number): string =>
    value.toLocaleString("en-US", { maximumFractionDigits: 0 });

const formatRate = (hashesPerSecond: number): string =>
    `${formatCount(hashesPerSecond / 1000)} kH/s`;

const parseIntOr = (raw: string, fallback: number): number => {
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

const clamp = (value: number, low: number, high: number): number =>
    Math.min(high, Math.max(low, value));

interface BenchmarkConfig {
    readonly from: number;
    readonly to: number;
    readonly perDifficulty: number;
    readonly mode: Mode;
}

interface BenchmarkHandlers {
    readonly onRun: (run: Omit<Run, "id">) => void;
    readonly onStatus: (status: string) => void;
    readonly onProgress: (percent: number) => void;
    readonly onError: (message: string) => void;
    readonly onFinished: () => void;
    readonly shouldStop: () => boolean;
}

/**
 * Run every difficulty in the range, reporting each solve as it lands rather
 * than at the end, so a long sweep shows its results while it is still going.
 *
 * Deliberately unwarmed. A page load solves exactly one challenge, cold, in a
 * worker it just spawned — so a warmup run would exclude a cost the user
 * really pays and report a difficulty as cheaper than it is.
 *
 * Never throws: a failed solve is reported through `onError`.
 */
const runBenchmark = async (
    config: BenchmarkConfig,
    handlers: BenchmarkHandlers,
): Promise<void> => {
    const difficulties = Array.from(
        { length: config.to - config.from + 1 },
        (_, offset) => config.from + offset,
    );
    const total = difficulties.length * config.perDifficulty;
    let done = 0;

    try {
        for (const difficulty of difficulties) {
            for (let index = 0; index < config.perDifficulty; index++) {
                // A solve in flight cannot be interrupted — the solver has no
                // abort — so stopping means stopping between runs.
                if (handlers.shouldStop()) {
                    handlers.onStatus("Stopped.");
                    return;
                }
                handlers.onStatus(
                    `Difficulty ${difficulty.toString()}, run ${(index + 1).toString()}/${config.perDifficulty.toString()}…`,
                );
                // The runs are the measurement — they must not overlap
                // oxlint-disable-next-line eslint/no-await-in-loop
                handlers.onRun(await timeOneSolve(difficulty, config.mode));
                done += 1;
                handlers.onProgress((done / total) * 100);
            }
        }
        handlers.onStatus("Done.");
    } catch (error: unknown) {
        handlers.onError(error instanceof Error ? error.message : String(error));
    } finally {
        handlers.onFinished();
    }
};

/**
 * What a difficulty costs the user whose browser does the work.
 *
 * Judged on p95, not on the mean. Solve time is geometric — anywhere from
 * instant to several times the mean — so what a user carries away is their
 * worst loads, and an average that looks fine hides them. `budgetSeconds` is
 * the share of the challenge TTL the solve may spend.
 */
const verdictFor = (meanSeconds: number, budgetSeconds: number): Verdict => {
    const p95Seconds = meanSeconds * P95_FACTOR;

    // The failures first: past the budget it stops being a wait and starts
    // being a handshake that cannot complete.
    if (meanSeconds > budgetSeconds) {
        return "does not converge";
    }
    if (p95Seconds > budgetSeconds) {
        return "unusable — the tail expires";
    }

    if (p95Seconds > PAINFUL_FROM_SECONDS) {
        return "painful";
    }
    if (p95Seconds > NOTICEABLE_FROM_SECONDS) {
        return "noticeable";
    }
    if (p95Seconds > IMPERCEPTIBLE_UNTIL_SECONDS) {
        return "fine";
    }
    return "imperceptible";
};

const verdictColor = (verdict: Verdict): string => {
    if (BROKEN_VERDICTS.includes(verdict)) {
        return "error.main";
    }
    return hurts(verdict) ? "warning.main" : "success.main";
};

const SummaryTable: React.FC<{ readonly summaries: readonly Summary[] }> = ({
    summaries,
}) => (
    <TableContainer component={Paper}>
        <Table size="small">
            <TableHead>
                <TableRow>
                    <TableCell>Difficulty</TableCell>
                    <TableCell align="right">Runs</TableCell>
                    <TableCell align="right">Mean</TableCell>
                    <TableCell align="right">Median</TableCell>
                    <TableCell align="right">Min</TableCell>
                    <TableCell align="right">Max</TableCell>
                    <TableCell align="right">Mean hashes</TableCell>
                    <TableCell align="right">Hash rate</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {summaries.map((summary) => (
                    <TableRow key={summary.difficulty}>
                        <TableCell>{summary.difficulty}</TableCell>
                        <TableCell align="right">{summary.count}</TableCell>
                        <TableCell align="right">{formatMs(summary.meanMs)}</TableCell>
                        <TableCell align="right">
                            {formatMs(summary.medianMs)}
                        </TableCell>
                        <TableCell align="right">{formatMs(summary.minMs)}</TableCell>
                        <TableCell align="right">{formatMs(summary.maxMs)}</TableCell>
                        <TableCell align="right">
                            {formatCount(summary.meanHashes)}
                        </TableCell>
                        <TableCell align="right">
                            {formatRate(summary.hashesPerSecond)}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </TableContainer>
);

interface Estimate {
    readonly difficulty: number;
    readonly meanHashes: number;
    readonly meanSeconds: number;
    readonly p95Seconds: number;
    readonly p99Seconds: number;
    readonly verdict: Verdict;
}

// The TTL covers both round trips too, so leave some of it unspent rather than
// budgeting the solve up to it.
const SOLVE_BUDGET_SECONDS = CHALLENGE_TTL_SECONDS * 0.5;

/** Extrapolate the whole difficulty band from one measured hash rate. */
const estimateDifficulties = (
    hashesPerSecond: number,
    budgetSeconds: number,
): readonly Estimate[] =>
    Array.from({ length: MAX_DIFFICULTY - ESTIMATE_FROM + 1 }, (_, offset) => {
        const difficulty = ESTIMATE_FROM + offset;
        const meanHashes = 2 ** difficulty;
        const meanSeconds = meanHashes / hashesPerSecond;
        return {
            difficulty,
            meanHashes,
            meanSeconds,
            p95Seconds: meanSeconds * P95_FACTOR,
            p99Seconds: meanSeconds * P99_FACTOR,
            verdict: verdictFor(meanSeconds, budgetSeconds),
        };
    });

/**
 * Say where the difficulty starts to hurt.
 *
 * The one line the page exists to produce. Everything else on it is the
 * working behind this.
 */
const Headline: React.FC<{ readonly estimates: readonly Estimate[] }> = ({
    estimates,
}) => {
    const firstHurting = estimates.find((estimate) => hurts(estimate.verdict));
    const lastWorking = estimates.findLast(
        (estimate) => !BROKEN_VERDICTS.includes(estimate.verdict),
    );

    const top = estimates.at(-1);
    if (firstHurting === undefined || top === undefined) {
        return (
            <Typography variant="h6" sx={{ color: "success.main" }}>
                Nothing up to difficulty {top?.difficulty ?? MAX_DIFFICULTY} hurts on
                this machine — p95 is still {formatMs((top?.p95Seconds ?? 0) * 1000)} at
                the ceiling.
            </Typography>
        );
    }

    const below = estimates[estimates.indexOf(firstHurting) - 1];

    return (
        <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h6" sx={{ color: verdictColor(firstHurting.verdict) }}>
                Starts to hurt at difficulty {firstHurting.difficulty}: p95{" "}
                {formatMs(firstHurting.p95Seconds * 1000)} ({firstHurting.verdict})
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {below === undefined
                    ? "Every difficulty in the band is already felt here."
                    : `Difficulty ${below.difficulty.toString()} and under is free (p95 ${formatMs(below.p95Seconds * 1000)}).`}
                {lastWorking !== undefined &&
                lastWorking.difficulty >= firstHurting.difficulty
                    ? ` Stops working entirely above ${lastWorking.difficulty.toString()}.`
                    : ""}
            </Typography>
        </Stack>
    );
};

const EstimateTable: React.FC<{ readonly estimates: readonly Estimate[] }> = ({
    estimates,
}) => (
    <TableContainer component={Paper}>
        <Table size="small">
            <TableHead>
                <TableRow>
                    <TableCell>Difficulty</TableCell>
                    <TableCell align="right">Mean hashes</TableCell>
                    <TableCell align="right">Mean</TableCell>
                    <TableCell align="right">p95</TableCell>
                    <TableCell align="right">p99</TableCell>
                    <TableCell>Verdict</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {estimates.map((estimate) => (
                    <TableRow key={estimate.difficulty}>
                        <TableCell>{estimate.difficulty}</TableCell>
                        <TableCell align="right">
                            {formatCount(estimate.meanHashes)}
                        </TableCell>
                        <TableCell align="right">
                            {formatMs(estimate.meanSeconds * 1000)}
                        </TableCell>
                        <TableCell align="right">
                            {formatMs(estimate.p95Seconds * 1000)}
                        </TableCell>
                        <TableCell align="right">
                            {formatMs(estimate.p99Seconds * 1000)}
                        </TableCell>
                        <TableCell sx={{ color: verdictColor(estimate.verdict) }}>
                            {estimate.verdict}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </TableContainer>
);

const RunTable: React.FC<{ readonly runs: readonly Run[] }> = ({ runs }) => (
    <TableContainer component={Paper} sx={{ maxHeight: 320 }}>
        <Table size="small" stickyHeader>
            <TableHead>
                <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell align="right">Difficulty</TableCell>
                    <TableCell align="right">Duration</TableCell>
                    <TableCell align="right">Hashes</TableCell>
                    <TableCell align="right">Hash rate</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {runs.map((run) => (
                    <TableRow key={run.id}>
                        <TableCell>{run.id}</TableCell>
                        <TableCell align="right">{run.difficulty}</TableCell>
                        <TableCell align="right">{formatMs(run.durationMs)}</TableCell>
                        <TableCell align="right">{formatCount(run.hashes)}</TableCell>
                        <TableCell align="right">
                            {formatRate((run.hashes / run.durationMs) * 1000)}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </TableContainer>
);

function RouteComponent() {
    const [from, setFrom] = React.useState("18");
    const [to, setTo] = React.useState("18");
    const [perDifficulty, setPerDifficulty] = React.useState("5");
    const [mode, setMode] = React.useState<Mode>("worker");

    const [runs, setRuns] = React.useState<readonly Run[]>([]);
    const [status, setStatus] = React.useState<string | null>(null);
    const [progress, setProgress] = React.useState(0);
    const [error, setError] = React.useState<string | null>(null);
    const [running, setRunning] = React.useState(false);

    const stopRequested = React.useRef(false);

    // Read once: it cannot change without a reload.
    const solvable = React.useMemo(() => canSolveHere(), []);

    const start = (override?: Partial<BenchmarkConfig>) => {
        const config: BenchmarkConfig = {
            from: clamp(parseIntOr(from, 0), 0, MAX_DIFFICULTY),
            to: clamp(parseIntOr(to, 0), 0, MAX_DIFFICULTY),
            perDifficulty: Math.max(1, parseIntOr(perDifficulty, 1)),
            mode,
            ...override,
        };
        if (config.to < config.from) {
            setError("The difficulty range ends below where it starts.");
            return;
        }
        // Write the config back, so a preset button leaves the fields showing
        // what it ran.
        setFrom(config.from.toString());
        setTo(config.to.toString());
        setPerDifficulty(config.perDifficulty.toString());
        setMode(config.mode);

        setError(null);
        setRuns([]);
        setProgress(0);
        setRunning(true);
        stopRequested.current = false;

        void runBenchmark(config, {
            onRun: (run) => {
                setRuns((previous) => [
                    ...previous,
                    { ...run, id: previous.length + 1 },
                ]);
            },
            onStatus: setStatus,
            onProgress: setProgress,
            onError: (message) => {
                setError(message);
                setStatus(null);
            },
            onFinished: () => {
                setRunning(false);
            },
            shouldStop: () => stopRequested.current,
        });
    };

    const summaries = React.useMemo(() => {
        const difficulties = [...new Set(runs.map((run) => run.difficulty))].toSorted(
            (a, b) => a - b,
        );
        return difficulties.map((difficulty) =>
            summarize(
                difficulty,
                runs.filter((run) => run.difficulty === difficulty),
            ),
        );
    }, [runs]);

    // Estimates come from the hardest difficulty measured: its runs are the
    // ones where the hash loop, and not the worker startup, dominates.
    const basis = summaries.at(-1) ?? null;
    const estimates =
        basis === null
            ? null
            : estimateDifficulties(basis.hashesPerSecond, SOLVE_BUDGET_SECONDS);

    return (
        <Stack sx={{ gap: 2 }}>
            <meta name="robots" content="noindex" />
            <Stack sx={{ gap: 0.5 }}>
                <Typography variant="h5">Proof-of-work benchmark</Typography>
                <Typography variant="body2" color="text.secondary">
                    Finds the difficulty at which flashlight&apos;s proof-of-work starts
                    to cost this class of machine something a user would feel.
                    Everything timed is the shipped code — the same <code>solve()</code>
                    , a real worker per solve, prod&apos;s batch size — since a
                    benchmark that outruns the real client would report a difficulty as
                    affordable and hand users the sluggishness. Challenges are minted
                    locally in flashlight&apos;s format; nothing is sent to the API.
                </Typography>
            </Stack>

            {!solvable ? (
                <Alert severity="warning">
                    This page is not in a secure context, so the browser hides{" "}
                    <code>crypto.subtle</code> and the real solver cannot hash anything
                    — there is nothing to measure here. Reach the dev server over https,
                    or as <code>localhost</code>. From a phone, the least friction is
                    USB port forwarding (Chrome&apos;s <code>chrome://inspect</code> →
                    Port forwarding), which makes the page <code>localhost</code> on the
                    device and therefore secure.
                </Alert>
            ) : null}

            <Stack
                direction="row"
                sx={{ gap: 2, flexWrap: "wrap", alignItems: "center" }}
            >
                <TextField
                    label="Difficulty from"
                    type="number"
                    size="small"
                    sx={{ width: 140 }}
                    value={from}
                    disabled={running}
                    onChange={(event) => {
                        setFrom(event.target.value);
                    }}
                />
                <TextField
                    label="Difficulty to"
                    type="number"
                    size="small"
                    sx={{ width: 140 }}
                    value={to}
                    disabled={running}
                    onChange={(event) => {
                        setTo(event.target.value);
                    }}
                />
                <TextField
                    label="Runs each"
                    type="number"
                    size="small"
                    sx={{ width: 120 }}
                    value={perDifficulty}
                    disabled={running}
                    onChange={(event) => {
                        setPerDifficulty(event.target.value);
                    }}
                />
                <TextField
                    label="Solver"
                    select
                    size="small"
                    sx={{ width: 200 }}
                    value={mode}
                    disabled={running}
                    onChange={(event) => {
                        setMode(event.target.value === "main" ? "main" : "worker");
                    }}
                >
                    <MenuItem value="worker">Worker (as in prod)</MenuItem>
                    <MenuItem value="main">Main thread (fallback)</MenuItem>
                </TextField>
            </Stack>

            <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
                <Button
                    variant="contained"
                    disabled={running || !solvable}
                    onClick={() => {
                        start();
                    }}
                >
                    Run benchmark
                </Button>
                <Button
                    variant="outlined"
                    disabled={running || !solvable}
                    onClick={() => {
                        start({ from: 18, to: 18, perDifficulty: 10 });
                    }}
                >
                    Calibrate (18 × 10)
                </Button>
                <Button
                    variant="outlined"
                    disabled={running || !solvable}
                    onClick={() => {
                        start({ from: 14, to: 22, perDifficulty: 3 });
                    }}
                >
                    Sweep 14–22 (× 3)
                </Button>
                <Button
                    variant="outlined"
                    color="warning"
                    disabled={!running}
                    onClick={() => {
                        stopRequested.current = true;
                    }}
                >
                    Stop
                </Button>
                <Button
                    variant="text"
                    disabled={running || runs.length === 0}
                    onClick={() => {
                        setRuns([]);
                        setStatus(null);
                        setProgress(0);
                    }}
                >
                    Clear
                </Button>
            </Stack>

            {running ? <LinearProgress variant="determinate" value={progress} /> : null}
            {status !== null ? (
                <Typography variant="body2" color="text.secondary">
                    {status}
                </Typography>
            ) : null}
            {error !== null ? <Alert severity="error">{error}</Alert> : null}

            {estimates !== null ? (
                <>
                    <Divider />
                    <Headline estimates={estimates} />
                </>
            ) : null}

            {summaries.length > 0 ? (
                <>
                    <Divider />
                    <Typography variant="h6">Measured</Typography>
                    <SummaryTable summaries={summaries} />
                </>
            ) : null}

            {basis !== null && estimates !== null ? (
                <>
                    <Divider />
                    <Typography variant="h6">Estimated</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Extrapolated from {formatRate(basis.hashesPerSecond)} measured
                        at difficulty {basis.difficulty}, over {basis.count} run
                        {basis.count === 1 ? "" : "s"}. Solve time is geometric, so p95
                        is ~3× the mean and p99 ~4.6×. A verdict is how the p95 wait
                        reads to a user; the last two mean the handshake no longer fits
                        the {SOLVE_BUDGET_SECONDS}s of flashlight&apos;s{" "}
                        {CHALLENGE_TTL_SECONDS}s challenge TTL left for the solve.
                    </Typography>
                    <EstimateTable estimates={estimates} />
                </>
            ) : null}

            {runs.length > 0 ? (
                <>
                    <Divider />
                    <Typography variant="h6">Runs</Typography>
                    <RunTable runs={runs} />
                </>
            ) : null}
        </Stack>
    );
}

export const Route = createFileRoute("/dev/pow")({
    component: RouteComponent,
});
