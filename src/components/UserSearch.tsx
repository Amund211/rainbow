import { getUUIDQueryOptions } from "#queries/uuid.ts";
import { normalizeUUID } from "#helpers/uuid.ts";
import { useUUIDToUsername } from "#queries/username.ts";
import { Search } from "@mui/icons-material";
import {
    Autocomplete,
    type AutocompleteProps,
    Avatar,
    Chip,
    CircularProgress,
    InputAdornment,
    Skeleton,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import React from "react";
import { usePlayerVisits } from "#contexts/PlayerVisits/hooks.ts";
import { useKnownAliases } from "#contexts/KnownAliases/hooks.ts";
import { useCurrentUser } from "#contexts/CurrentUser/hooks.ts";

interface UserSearchProps {
    onSubmit: (uuid: string) => void;
    placeholder?: string;
    size?: "small" | "medium";
}

interface UserSearchOptions<Multiple extends boolean> {
    uuids: string[];
    filterOptions: AutocompleteProps<
        string,
        Multiple,
        true,
        true
    >["filterOptions"];
    renderOption: AutocompleteProps<
        string,
        Multiple,
        true,
        true
    >["renderOption"];
    getOptionLabel: AutocompleteProps<
        string,
        false,
        true,
        true
    >["getOptionLabel"];
    isOptionEqualToValue: AutocompleteProps<
        string,
        Multiple,
        true,
        true
    >["isOptionEqualToValue"];
    renderTags: AutocompleteProps<string, Multiple, true, true>["renderTags"];
}

const useUserSearchOptions = <Multiple extends boolean = false>(
    additionalUUIDs?: readonly string[],
): UserSearchOptions<Multiple> => {
    const { knownAliases } = useKnownAliases();
    const uuids = Object.keys(knownAliases);
    const uuidToUsername = useUUIDToUsername([
        ...new Set(uuids.concat(additionalUUIDs ?? [])),
    ]);
    const { orderUUIDsByScore } = usePlayerVisits();
    const { currentUser } = useCurrentUser();

    return {
        uuids,
        filterOptions: (options, { inputValue }) => {
            const namesForOptions = options.map((option) => {
                const uuid = option;
                const name = uuidToUsername[uuid];
                const names = knownAliases[uuid] ?? [];
                if (!name) {
                    return {
                        names,
                        option,
                    };
                }
                return { names: [name, ...names], option };
            });

            const filteredOptions = orderUUIDsByScore(
                namesForOptions
                    .filter(({ names }) => {
                        return names.some((name) =>
                            name
                                .toLowerCase()
                                .includes(inputValue.toLowerCase()),
                        );
                    })
                    .map(({ option }) => option),
                currentUser ?? undefined,
            );

            // Add an option for the current search term if:
            // 1. There's an input value
            // 2. There's no exact match already in the filtered results
            if (inputValue.trim()) {
                const hasExactMatch = namesForOptions.some(
                    ({ names, option }) => {
                        return (
                            filteredOptions.includes(option) &&
                            names.some(
                                (name) =>
                                    name.toLowerCase() ===
                                    inputValue.toLowerCase(),
                            )
                        );
                    },
                );

                if (!hasExactMatch) {
                    // Use a special prefix to identify this as a search term option
                    filteredOptions.push(`__search_term__${inputValue}`);
                }
            }

            return filteredOptions;
        },
        renderOption: (props, option) => {
            const { key, ...optionProps } = props; // eslint-disable-line @typescript-eslint/no-unsafe-assignment

            // Handle special search term option
            if (option.startsWith("__search_term__")) {
                const searchTerm = option.replace("__search_term__", "");
                const normalizedUUID = normalizeUUID(searchTerm);

                if (normalizedUUID) {
                    // If search term is a UUID, try to render with player name and head
                    const playerName = uuidToUsername[normalizedUUID];
                    return (
                        <Stack
                            component="li"
                            key={key} // eslint-disable-line @typescript-eslint/no-unsafe-assignment
                            direction="row"
                            gap={2}
                            alignItems="center"
                            {...optionProps}
                        >
                            <Avatar
                                src={`https://crafatar.com/renders/head/${normalizedUUID}?overlay`}
                                alt={`Player head of ${playerName ?? "unknown"}`}
                            />
                            <Typography variant="body1">
                                {playerName ?? searchTerm}
                            </Typography>
                        </Stack>
                    );
                } else {
                    // Regular search term
                    return (
                        <Stack
                            component="li"
                            key={key} // eslint-disable-line @typescript-eslint/no-unsafe-assignment
                            direction="row"
                            gap={2}
                            alignItems="center"
                            {...optionProps}
                        >
                            <Search fontSize="small" />
                            <Typography variant="body1">
                                Search for &ldquo;{searchTerm}&rdquo;
                            </Typography>
                        </Stack>
                    );
                }
            }

            // Normal UUID option
            const uuid = option;
            return (
                <Stack
                    component="li"
                    key={key} // eslint-disable-line @typescript-eslint/no-unsafe-assignment
                    direction="row"
                    gap={2}
                    alignItems="center"
                    {...optionProps}
                >
                    <Avatar
                        src={`https://crafatar.com/renders/head/${uuid}?overlay`}
                        alt={`Player head of ${uuidToUsername[uuid] ?? "unknown"}`}
                    />
                    <Typography variant="body1">
                        {uuidToUsername[uuid]}
                    </Typography>
                </Stack>
            );
        },
        getOptionLabel: (option) => {
            if (option.startsWith("__search_term__")) {
                return option.replace("__search_term__", "");
            }
            return uuidToUsername[option] ?? option;
        },
        isOptionEqualToValue: (option, value) => {
            return (
                option === value ||
                uuidToUsername[option]?.toLowerCase() === value.toLowerCase()
            );
        },
        renderTags: (value, getTagProps) =>
            value.map((option: string, index: number) => {
                const uuid = option;
                const { key, ...tagProps } = getTagProps({ index });
                return (
                    <Chip
                        key={key}
                        {...tagProps}
                        label={
                            uuidToUsername[uuid] ?? (
                                <Skeleton variant="text" width={60} />
                            )
                        }
                        variant="outlined"
                        color="primary"
                        avatar={
                            <img
                                style={{
                                    backgroundColor: "rgba(0, 0, 0, 0)",
                                }}
                                src={`https://crafatar.com/renders/head/${uuid}?overlay`}
                                alt={`Player head of ${uuidToUsername[uuid] ?? "unknown"}`}
                            />
                        }
                    />
                );
            }),
    };
};

export const UserSearch: React.FC<UserSearchProps> = ({
    onSubmit,
    placeholder = "Search players",
    size = "small",
}) => {
    const queryClient = useQueryClient();
    const { addKnownAlias } = useKnownAliases();
    const {
        uuids,
        filterOptions,
        renderOption,
        getOptionLabel,
        isOptionEqualToValue,
    } = useUserSearchOptions();
    const [loading, setLoading] = React.useState(false);

    return (
        <Autocomplete
            freeSolo
            options={uuids}
            fullWidth
            size={size}
            // TODO: Clear the input when the user selects an option
            blurOnSelect
            selectOnFocus
            autoHighlight
            filterOptions={filterOptions}
            renderOption={renderOption}
            getOptionLabel={getOptionLabel}
            isOptionEqualToValue={isOptionEqualToValue}
            onChange={(_, value) => {
                if (!value) return; // Ignore clearing the input

                let actualValue = value;

                // Handle special search term option
                if (value.startsWith("__search_term__")) {
                    actualValue = value.replace("__search_term__", "");
                }

                // Allow UUIDs to be entered directly
                const valueAsNormalizedUUID = normalizeUUID(actualValue);
                if (valueAsNormalizedUUID) {
                    onSubmit(valueAsNormalizedUUID);
                    return;
                }

                setLoading(true);
                queryClient
                    .fetchQuery(getUUIDQueryOptions(actualValue, addKnownAlias))
                    .then(({ uuid }) => {
                        onSubmit(uuid);
                    })
                    .catch((error: unknown) => {
                        console.error("Failed to fetch username", error);
                    })
                    .finally(() => {
                        setLoading(false);
                    });
            }}
            renderInput={(params) => {
                return (
                    <TextField
                        {...params}
                        placeholder={placeholder}
                        slotProps={{
                            input: {
                                ...params.InputProps,
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search fontSize="small" />
                                    </InputAdornment>
                                ),
                                endAdornment: loading && (
                                    <InputAdornment position="end">
                                        <CircularProgress size={20} />
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />
                );
            }}
        />
    );
};

interface UserMultiSelectProps {
    uuids: readonly string[];
    onSubmit: (uuids: string[]) => void;
    placeholder?: string;
    size?: "small" | "medium";
}

export const UserMultiSelect: React.FC<UserMultiSelectProps> = ({
    uuids,
    onSubmit,
    placeholder = "Add players",
    size = "small",
}) => {
    const queryClient = useQueryClient();
    const { addKnownAlias } = useKnownAliases();
    const {
        uuids: options,
        filterOptions,
        renderOption,
        getOptionLabel,
        isOptionEqualToValue,
        renderTags,
    } = useUserSearchOptions<true>(uuids);
    const [loading, setLoading] = React.useState(false);

    return (
        <Autocomplete
            multiple
            freeSolo
            options={options}
            fullWidth
            size={size}
            autoHighlight
            filterOptions={filterOptions}
            renderOption={renderOption}
            getOptionLabel={getOptionLabel}
            isOptionEqualToValue={isOptionEqualToValue}
            renderTags={renderTags}
            value={[...uuids]}
            onChange={(_, newValues) => {
                setLoading(true);
                Promise.allSettled(
                    newValues.map((value) => {
                        // Allow UUIDs to be entered directly
                        const valueAsNormalizedUUID = normalizeUUID(value);
                        if (valueAsNormalizedUUID) {
                            return valueAsNormalizedUUID;
                        }

                        return queryClient
                            .fetchQuery(
                                getUUIDQueryOptions(value, addKnownAlias),
                            )
                            .then(({ uuid }) => {
                                return uuid;
                            })
                            .catch((error: unknown) => {
                                console.error(
                                    "Failed to fetch username",
                                    error,
                                );
                                throw error;
                            });
                    }),
                )
                    .then((results) => {
                        onSubmit(
                            results
                                .filter(
                                    (result) => result.status === "fulfilled",
                                )
                                .map((result) => result.value),
                        );
                    })
                    .catch((error: unknown) => {
                        console.error(
                            "Failed to settle all uuid promises",
                            error,
                        );
                    })
                    .finally(() => {
                        setLoading(false);
                    });
            }}
            renderInput={(params) => {
                return (
                    <TextField
                        {...params}
                        placeholder={placeholder}
                        slotProps={{
                            input: {
                                ...params.InputProps,
                                endAdornment: loading && (
                                    <InputAdornment position="end">
                                        <CircularProgress size={20} />
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />
                );
            }}
        />
    );
};
