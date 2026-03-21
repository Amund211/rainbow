import React from "react";
import { KnownAliasesContext } from "./context.ts";
import {
    addKnownAlias,
    persistKnownAliases,
    presentRecentKnownAliases,
    usePersistedKnownAliases,
} from "./helpers.ts";
import { isNormalizedUUID } from "#helpers/uuid.ts";

export const KnownAliasesProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const [persistedKnownAliases, refresh] = usePersistedKnownAliases();

    const addKnownAliasAndPersist = (alias: {
        uuid: string;
        username: string;
    }) => {
        if (!isNormalizedUUID(alias.uuid)) {
            throw new Error(`UUID not normalized: ${alias.uuid}`);
        }

        const newAliases = addKnownAlias(persistedKnownAliases, alias);
        persistKnownAliases(newAliases);
        refresh();
    };

    return (
        <KnownAliasesContext.Provider
            value={{
                knownAliases: presentRecentKnownAliases(persistedKnownAliases),
                addKnownAlias: addKnownAliasAndPersist,
            }}
        >
            {children}
        </KnownAliasesContext.Provider>
    );
};
