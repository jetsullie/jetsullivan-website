import { createAdminCreditsHandlers } from "../../_shared/admin-credits.js";
import { ACTING_CREDITS_KEY } from "../../_shared/credits.js";

const handlers = createAdminCreditsHandlers(ACTING_CREDITS_KEY);

export const onRequestGet = handlers.onRequestGet;
export const onRequestPost = handlers.onRequestPost;
export const onRequestPut = handlers.onRequestPut;
export const onRequestPatch = handlers.onRequestPatch;
export const onRequestDelete = handlers.onRequestDelete;
