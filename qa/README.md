# Current booking deposit workflow

New online bookings check date-based capacity, temporarily hold stock while customers pay a $35 booking deposit, and credit that payment toward the final invoice. Unpaid holds expire after 45 minutes; checkout links expire after 31 minutes. Verified payments reserve the stock until return. Paid checkouts arriving after a booking has expired are refunded instead of overbooking inventory.

Private booking links let customers verify payments and cancel booking requests. Cancellation previews the refund under the terms accepted for that booking, with idempotency protection. Staff record returns; each damaged tote adds $8 to the final invoice. The final balance is rental fees plus damage plus staff-entered tax, minus payments received. Final balance checkout is available after returns are recorded. Inventory and payment actions are tested in an isolated database with mocked Stripe, never live charges.

The earlier security-deposit flow below remains available only for existing bookings.

# Tote rental integration checks

Run `npm install` followed by `npm run test:totes:integration`. Tests use isolated PGlite databases and a fake Stripe client. They never write to the hosted database or charge a card.

Production uses the existing STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. The existing signed Stripe endpoint at /api/webhooks/stripe routes tote events separately from apparel fulfillment. Subscribe the endpoint to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.refunded, refund.created, refund.updated, and refund.failed. The staff Refresh Stripe payment action also reconciles payment and refund state from the Stripe API.

Staff enter owned and damaged inventory, service area, refundable security deposit, and deposit/cancellation terms in Inventory & settings. Confirm a booking to reserve stock, then review its tax amount and create a payment link. Checkout charges rental fees, entered tax, and the deposit as separate items. Deposits and tax are excluded from rental revenue in HQ. After return, inspection, and cleaning completion, staff can refund the full security deposit. Partial deductions and rental-fee refunds are handled in Stripe and reconciled by webhook or the refresh action. No card holds, automatic damage charges, or automatic tax calculation are enabled by this flow.

Wild Roots cancellations: new online bookings accept the 24-hour policy and record the selected rental start time in America/Denver. Customer cancellation requires an up-to-date refund preview. A $35 late cancellation fee is capped at the amount paid; original bookings remain fully refundable. Admin business cancellation refunds all payments before equipment goes out. Cancelled stock is released immediately; Stripe refunds can remain pending, and their status is refreshed on the private management page. Payment collection remains the $35 credited deposit plus the inspected final balance.
