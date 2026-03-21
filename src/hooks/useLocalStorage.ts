import React from "react";

const makeSubscribe = (
    key: string,
    onSubscribe: (onStoreChange: () => void) => void,
    onUnsubscribe: () => void,
) => {
    return (onStoreChange: () => void) => {
        onSubscribe(onStoreChange);

        const listener = (e: StorageEvent) => {
            // `key` is `null` on clear -> process it
            // https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event#event_properties
            if (e.key !== key && e.key != null) return;

            onStoreChange();
        };

        window.addEventListener("storage", listener);

        return () => {
            onUnsubscribe();
            window.removeEventListener("storage", listener);
        };
    };
};

const makeGetSnapshot = (key: string) => {
    return () => {
        return localStorage.getItem(key);
    };
};

function noop() {
    // no-op
}

/**
 * @returns [value, refresh], where `value` is the current value of the localStorage item, and `refresh` is a function that can be called to imperatively refresh the value from the outside.
 */
export const useLocalStorage = (key: string): [string | null, () => void] => {
    // Keep the onStoreChange callback so we can imperatively refresh from the outside
    // T
    const [refresh, setRefresh] = React.useState<() => void>(() => noop);

    const subscribe = React.useMemo(() => {
        const onSubscribe = (onStoreChange: () => void) => {
            setRefresh(() => onStoreChange);
        };
        const onUnsubscribe = () => {
            setRefresh(() => noop);
        };
        return makeSubscribe(key, onSubscribe, onUnsubscribe);
    }, [key]);

    const getSnapshot = React.useMemo(() => makeGetSnapshot(key), [key]);

    return [React.useSyncExternalStore(subscribe, getSnapshot), refresh];
};
