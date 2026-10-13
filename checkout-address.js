// Carry the address used for the delivery quote into Stripe-hosted Checkout.
// Always create a fresh customer: guest input must never update someone else's record.
export function checkoutCustomerDetails(address) {
  const name = String(address.name || '').trim();
  if (!name) throw new Error('Add your full name before opening checkout.');
  const shippingAddress = {
    line1: address.address1, line2: address.address2 || '',
    city: address.city, state: address.region,
    postal_code: address.zip, country: address.country || 'US'
  };
  return {name, phone: address.phone, address: shippingAddress,
    shipping: {name, phone: address.phone, address: shippingAddress}};
}
