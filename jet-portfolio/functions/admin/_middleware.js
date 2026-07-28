import { requireOwner } from "../_shared/owner-access.js";

export const onRequest = requireOwner;
