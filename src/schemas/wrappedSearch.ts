import { z } from "zod";

export const wrappedSearchSchema = z.object({
    year: z.coerce
        .number()
        .int()
        .min(2020)
        .max(new Date().getFullYear())
        .catch(new Date().getFullYear()),
});
