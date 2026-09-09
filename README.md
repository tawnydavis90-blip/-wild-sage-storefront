# Wild Sage Apparel — Custom Printify Storefront

A standalone storefront starter that reads products from a Printify shop through a server-side API proxy.

## What works now
- Branded responsive storefront
- Live Printify product list when the token is configured
- Automatic Printify shop discovery (Shop ID optional)
- `/api/setup-status` connection check
- Product variants and Printify mockup images
- Category/tag filtering
- Product detail modal
- Local cart interaction
- Server endpoint for Printify shipping quotes
- Guarded server endpoint for Printify order creation (requires verified payment proof)
- Webhook receiver placeholder
- Demo catalog fallback so the design can be previewed before connecting Printify

## Setup
1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. In Printify, create a Personal Access Token under **My Profile → Connections** and keep it private.
4. Put the token in `PRINTIFY_API_TOKEN`.
5. `PRINTIFY_SHOP_ID` is now optional. If you leave it blank, the server automatically discovers the first shop available to that token.
6. Run:
   ```bash
   npm install
   npm start
   ```
7. Open `http://localhost:3000`.

## Production checklist
- Add a payment processor (recommended: Stripe Checkout/Payment Intents) and verify payment server-side.
- Only after a verified payment event, call `/api/orders` with a server-generated payment proof. Do **not** trust `payment.verified` from a browser in production; replace the starter guard with payment-provider webhook verification.
- Add a database for carts/orders/customer-service records.
- Validate Printify webhook signatures using the latest Printify documentation and your webhook secret.
- Add legal pages: privacy, returns/refunds, shipping, terms, accessibility/contact.
- Configure a domain and HTTPS deployment.
- Add tax handling based on your payment/tax setup.

## Printify endpoints used
- `GET /v1/shops/{shop_id}/products.json`
- `GET /v1/shops/{shop_id}/products/{product_id}.json`
- `POST /v1/shops/{shop_id}/orders/shipping.json`
- `POST /v1/shops/{shop_id}/orders.json`

The Printify token never belongs in browser JavaScript.
