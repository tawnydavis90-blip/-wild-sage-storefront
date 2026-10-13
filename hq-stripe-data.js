import { printifyOrdersByExternalId } from './printify-admin-data.js';

export async function listPaidWildSageSessions(stripe, options = {}) {
  if (!stripe) return [];
  const sessions = [];
  let starting_after;
  for (let page = 0; page < 100; page++) {
    const result = await stripe.checkout.sessions.list({ ...options, limit: 100, ...(starting_after ? { starting_after } : {}) });
    sessions.push(...result.data.filter(s => s.payment_status === 'paid' && !String(s.id).startsWith('cs_test_') && s.metadata?.wild_sage_test !== 'true' && s.metadata?.do_not_fulfill !== 'true'));
    if (!result.has_more) return sessions;
    if (!result.data.length) throw new Error('Stripe returned an incomplete order feed.');
    starting_after = result.data.at(-1).id;
  }
  throw new Error('Stripe order history exceeded the page limit; the feed is incomplete.');
}

export async function loadHqOrderSources(stripe, loadPrintify = printifyOrdersByExternalId) {
  let printifyError = null;
  const [sessions, byExternal] = await Promise.all([
    listPaidWildSageSessions(stripe),
    loadPrintify().catch(error => {
      printifyError = error.message;
      return new Map();
    })
  ]);
  return { sessions, byExternal, printifyError };
}
