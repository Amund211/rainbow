import { z } from "zod";

// Fall back to the current time for a missing or malformed date so a shared or
// hand-edited link degrades to the NoSession view rather than tripping the
// router's error boundary. In-app links always pass a valid date.
const defaultDetailDate = new Date();

export const detailSearchSchema = z.object({
    date: z.coerce.date().catch(defaultDetailDate).default(defaultDetailDate),
});
