import { createPublicCreditsHandler } from "../_shared/public-credits.js";
import { ACTING_CREDITS_KEY } from "../_shared/credits.js";

export const onRequestGet = createPublicCreditsHandler(ACTING_CREDITS_KEY);
