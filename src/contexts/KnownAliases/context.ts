import React from "react";

export interface KnownAliasesContextValue {
    knownAliases: Record<string, string[] | undefined>;
    addKnownAlias: (alias: { readonly uuid: string; readonly username: string }) => void;
}

export const KnownAliasesContext = React.createContext<KnownAliasesContextValue | null>(
    null,
);
