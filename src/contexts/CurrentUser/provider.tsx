import React from "react";
import { CurrentUserContext } from "./context.ts";
import { persistCurrentUser, usePersistedCurrentUser } from "./helpers.ts";
import { isNormalizedUUID } from "#helpers/uuid.ts";

export const CurrentUserProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const [persistedCurrentUser, refresh] = usePersistedCurrentUser();

    const setCurrentUserAndPersist = (newUUID: string | null) => {
        if (newUUID !== null && !isNormalizedUUID(newUUID)) {
            throw new Error(`UUID not normalized: ${newUUID}`);
        }

        persistCurrentUser(newUUID);
        refresh();
    };

    return (
        <CurrentUserContext.Provider
            value={{
                currentUser: persistedCurrentUser,
                setCurrentUser: setCurrentUserAndPersist,
            }}
        >
            {children}
        </CurrentUserContext.Provider>
    );
};
