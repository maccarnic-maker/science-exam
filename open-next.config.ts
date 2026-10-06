import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Exam state is stored in D1, never in the Next.js incremental cache.
export default defineCloudflareConfig();
