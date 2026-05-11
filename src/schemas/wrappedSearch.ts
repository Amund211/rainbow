import { z } from "zod";

import { getWrappedYear } from "#helpers/wrapped.ts";

const currentWrappedYear = getWrappedYear();

// zod 4.4 made `.catch()` apply only to present-but-invalid input; missing
// object keys now throw `nonoptional`. To preserve the "missing or invalid
// URL param -> fallback to default" behavior, the field needs both
// `.catch(v)` (invalid) and `.default(v)` (missing).
export const wrappedSearchSchema = z.object({
    year: z.coerce
        .number()
        .int()
        .min(2025) // First full year with flashlight data from prism (started December 2024)
        .max(currentWrappedYear)
        .catch(currentWrappedYear)
        .default(currentWrappedYear),
});
