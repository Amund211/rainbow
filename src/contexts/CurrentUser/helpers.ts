import { isNormalizedUUID } from "#helpers/uuid.ts";
import { useLocalStorage } from "#hooks/useLocalStorage.ts";

const localStorageKey = "currentUser";

const parseStoredUUID = (stored: string | null): string | null => {
    if (stored === null) {
        return null;
    }

    if (!isNormalizedUUID(stored)) {
        return null;
    }

    return stored;
};

export const persistCurrentUser = (uuid: string | null): void => {
    if (uuid === null) {
        localStorage.removeItem(localStorageKey);
    } else {
        if (!isNormalizedUUID(uuid)) {
            throw new Error(`UUID not normalized: ${uuid}`);
        }

        localStorage.setItem(localStorageKey, uuid);
    }
};

export const usePersistedCurrentUser = (): string | null => {
    const stored = useLocalStorage(localStorageKey);

    return parseStoredUUID(stored);
};
