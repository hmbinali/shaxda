import { WorkerEntrypoint } from "cloudflare:workers";
import { processPendingRatings } from "@shaxda/db/rating";

export class RatingsEntrypoint extends WorkerEntrypoint<
  Pick<App.Platform["env"], "DB">
> {
  processNow(): { accepted: true } {
    this.ctx.waitUntil(processPendingRatings(this.env.DB));
    return { accepted: true };
  }
}
