import { createPublicCreditsHandler } from "../_shared/public-credits.js";
import { CREDITS_KEY } from "../_shared/credits.js";

export const onRequestGet = createPublicCreditsHandler(CREDITS_KEY);
