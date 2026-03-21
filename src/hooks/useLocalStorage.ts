import React from "react";

const makeSubscribe = (
    key: string,
    onSubscribe: (callback: () => void) => void,
    onUnsubscribe: () => void,
) => {
    return (callback: () => void) => {
        onSubscribe(callback);

        const listener = (e: StorageEvent) => {
            // `key` is `null` on clear -> process it
            // https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event#event_properties
            if (e.key !== key && e.key != null) return;

            callback();
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

export const useLocalStorage = (key: string): [string | null, () => void] => {
    const [refresh, setRefresh] = React.useState<() => void>(() => () => {
        // no-op
    });

    const subscribe = React.useMemo(
        () =>
            makeSubscribe(
                key,
                (callback: () => void) => {
                    setRefresh(() => callback);
                },
                () => {
                    setRefresh(() => () => {
                        // no-op
                    });
                },
            ),
        [key],
    );
    const getSnapshot = React.useMemo(() => makeGetSnapshot(key), [key]);

    return [React.useSyncExternalStore(subscribe, getSnapshot), refresh];
};
