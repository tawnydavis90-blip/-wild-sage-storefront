# Sin & Sage: direct Nalpac integration

This integration is restricted to Sin & Sage. It does not use Inventory Source, change Wild Sage merchandise, publish products, enable checkout, or send supplier orders.

## Connect

1. Ask Nalpac to enable **products and carriers API permissions** for the approved dropship account. Retail website credentials may differ from API credentials.
2. Set `NALPAC_USERNAME` and `NALPAC_PASSWORD` in the existing Render web service environment. Never put them in GitHub, browser JavaScript, screenshots, or supplier notes. The documented API requires ASCII credentials without colons.
3. Confirm the correct location with Nalpac. `NALPAC_LOCATION_ID` defaults to `15`; only `15` and `25` are accepted.
4. Deploy/restart after environment changes. Open `/sin-and-sage/dashboard.html`, sign in with the existing admin password, and select **Nalpac catalog → Test API access**. This tests carrier permission only. Importing a known SKU separately tests product permission.
5. Import up to 10 selected SKUs per request. Leading zeros are preserved. Products are stored as private drafts in `sin_sage_nalpac_products`, keyed by SKU and location. No public catalog endpoint is added.
6. Use **Refresh next 10 products** to check the least recently attempted SKUs. It updates name, UPC, wholesale cost, quantity, sellability and discontinued status. Failures preserve previous data, set availability false, and show an error. The dashboard displays up to 200 drafts.

Optional: `NALPAC_AUTO_SYNC=true` enables one batch of up to 10 oldest SKUs per hour while the service is running. It does not run immediately, guarantee freshness, or catch up during downtime. At 100 products a complete pass can take 10 hours. Keep it off for large catalogs until a bulk feed/scheduler is configured. Refresh is serialized per application process; use a single instance until a distributed job lock is added.

## What remains before launch

- Obtain credentials and verify this approved account can use the API; approval alone does not establish API access.
- Obtain Nalpac's full product attributes/image feed and confirm its actual schema and MAP requirements. The public feed page says downloading acknowledges signed MAP agreements; this integration does not download those feeds.
- SKU lookup is documented; a bulk-product API endpoint is not. Do not invent one.
- Configure retail pricing, product photographs/descriptions, category mapping, restrictions and publication review.
- Confirm dropship terms, shipping prices, returns, and approved payment processing.
- Implement and test order submission with duplicate protection and order/tracking reconciliation before opening checkout. No order submission capability exists in this client.

## API contract and validation

Source: https://api2.nalpac.com/Help (reviewed October 27, 2026).

- Fixed HTTPS host; server-side HTTP Basic authentication; GET only; redirects rejected; 10-second timeout.
- `GET /api/product/{sku}?stripDescriptionHTML=true&locationId=15` returns a product object with `Sku`, `Name`, `Upc`, `WholesalePrice`, `AvailableQuantity`, `Sellable`, `Discontinued`.
- `GET /api/carrier` returns `{ "Carriers": [...] }`. This lists shipping options and is not a shipping quote.
- Raw supplier response bodies and authorization values are never returned in errors.
- Authenticated dashboard routes use the existing signed admin session. Write actions reject cross-origin browser requests.
- Tests cover documented response normalization, auth, SKU validation, secret masking, draft persistence and failed refresh handling using isolated test data. They do not prove live Nalpac access.
