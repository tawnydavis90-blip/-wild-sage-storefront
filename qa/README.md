# Tote rental integration checks

Run `npm install` followed by `npm run test:totes:integration`. Tests use isolated PGlite databases and a fake Stripe client. They never write to the hosted database or charge a card.

Production uses the existing STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. The existing signed Stripe endpoint at /api/webhooks/stripe routes tote events separately from apparel fulfillment. Subscribe the endpoint to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.refunded, refund.created, refund.updated, and refund.failed. The staff Refresh Stripe payment action also reconciles payment and refund state from the Stripe API.

Staff enter owned and damaged inventory, service area, refundable security deposit, and deposit/cancellation terms in Inventory & settings. Confirm a booking to reserve stock, then review its tax amount and create a payment link. Checkout charges rental fees, entered tax, and the deposit as separate items. Deposits and tax are excluded from rental revenue in HQ. After return, inspection, and cleaning completion, staff can refund the full security deposit. Partial deductions and rental-fee refunds are handled in Stripe and reconciled by webhook or the refresh action. No card holds, automatic damage charges, or automatic tax calculation are enabled by this flow.
