// Carry the address used for the delivery quote into Stripe-hosted Checkout.
// Always create a fresh customer: guest input must never update someone else's record.
export function checkoutCustomerDetails(address) {
  const name = String(address.name || '').trim();
  if (!name) throw new Error('Add your full name before opening checkout.');
  const rawPhone = String(address.phone || '').trim();
  const digits = rawPhone.replace(/\D/g, '');
  const phone = rawPhone.startsWith('+') ? `+${digits}` :
    digits.length === 10 ? `+1${digits}` :
    digits.length === 11 && digits.startsWith('1') ? `+${digits}` : '';
  if (!phone) throw new Error('Enter a 10-digit phone number or include the international country code.');
  const shippingAddress = {
    line1: address.address1, line2: address.address2 || '',
    city: address.city, state: address.region,
    postal_code: address.zip, country: address.country || 'US'
  };
  return {name, phone, address: shippingAddress,
    shipping: {name, phone, address: shippingAddress}};
}
