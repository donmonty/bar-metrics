// Auth.js v5's standard App Router mount point (issue #11). The actual
// config lives in `lib/auth` — this file only re-exports its handlers.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
