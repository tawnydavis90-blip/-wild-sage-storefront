export async function completePaidOrder({
  session,
  getOrderNumber,
  fulfill,
  loadEmailSession,
  sendEmails,
  logger = console
}) {
  const orderNumber = await getOrderNumber(session.id);
  const printifyOrder = await fulfill(session);
  let emailResult = null;

  try {
    const emailSession = await loadEmailSession(session.id);
    emailResult = await sendEmails({ session: emailSession, orderNumber, printifyOrder });
    if (emailResult.failed?.length) logger.error('Transactional email failure:', emailResult.failed);
    else if (emailResult.skipped) logger.warn('Transactional email skipped: no recipients configured.');
    else logger.log('Transactional emails sent:', emailResult.sent.map(item => item.kind).join(', '));
  } catch (error) {
    logger.error('Transactional email failure (fulfillment already succeeded):', error);
  }

  return { orderNumber, printifyOrder, emailResult };
}
