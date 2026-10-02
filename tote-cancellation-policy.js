export function cancellationPreview(b,{now=Date.now(),business=false}={}){
 const paid=Math.max(0,(b.collected_cents||0)-(b.refunded_cents||0));
 if(b.cancelled_at)return {allowed:true,alreadyCancelled:true,feeCents:b.cancellation_fee_cents||0,refundCents:0,reason:'This booking has already been cancelled. Any pending refund is shown in your booking details.'};
 if(!['requested','confirmed','cancelled'].includes(b.status))return {allowed:false,feeCents:0,refundCents:0,reason:'Your rental has started. Contact our team about any service issue; unused rental time is not automatically refundable.'};
 const start=b.rental_start_at?new Date(b.rental_start_at).getTime():null;
 const late=b.cancellation_policy==='24-hour-v2'&&start!==null&&start-now<24*60*60*1000;
 const fee=business||b.status==='cancelled'?0:late?Math.min(3500,paid):0;
 return {allowed:true,alreadyCancelled:false,feeCents:fee,refundCents:paid-fee,reason:business?'Business cancellation: full refund.':b.cancellation_policy==='refundable-deposit-v1'?'Original booking terms: your paid deposit is fully refundable.':late?'Less than 24 hours before the booked rental start: $35 cancellation fee, limited to the amount paid.':'At least 24 hours before the booked rental start: full refund.',startAt:b.rental_start_at||null};
}
