import cloudflareAccessPlugin from "@cloudflare/pages-plugin-cloudflare-access";

const AUTHORIZED_EMAIL = "jetsullivan1@gmail.com";

export const requireOwner = async (context) => {
	const domain = context.env.CF_ACCESS_DOMAIN;
	const aud = context.env.CF_ACCESS_AUD;

	if (
		typeof domain !== "string" ||
		!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(domain) ||
		typeof aud !== "string" ||
		aud.length < 10
	) {
		return new Response("Admin authentication is not configured.", {
			status: 503,
			headers: { "Cache-Control": "no-store" },
		});
	}

	const validateAccess = cloudflareAccessPlugin({ domain, aud });
	const continueRequest = context.next;

	return validateAccess({
		...context,
		next: async () => {
			const email =
				context.data.cloudflareAccess?.JWT?.payload?.email?.toLowerCase();

			if (email !== AUTHORIZED_EMAIL) {
				return new Response("Forbidden", {
					status: 403,
					headers: { "Cache-Control": "no-store" },
				});
			}

			if (!["GET", "HEAD", "OPTIONS"].includes(context.request.method)) {
				const requestOrigin = context.request.headers.get("Origin");
				const expectedOrigin = new URL(context.request.url).origin;
				if (requestOrigin !== expectedOrigin) {
					return new Response("Forbidden", {
						status: 403,
						headers: { "Cache-Control": "no-store" },
					});
				}
			}

			const response = await continueRequest();
			const securedResponse = new Response(response.body, response);
			securedResponse.headers.set("Cache-Control", "no-store");
			securedResponse.headers.set(
				"Content-Security-Policy",
				"default-src 'self'; base-uri 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' blob: data:; media-src 'self' blob:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
			);
			securedResponse.headers.set("Referrer-Policy", "no-referrer");
			securedResponse.headers.set("X-Content-Type-Options", "nosniff");
			securedResponse.headers.set("X-Frame-Options", "DENY");
			return securedResponse;
		},
	});
};
