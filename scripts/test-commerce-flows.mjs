import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {createTestLoader,testDatabase} from './test-module-loader.mjs';
// No .env files or real clients are loaded. Unknown dependencies/network fail closed.
const stripe=new Stripe('sk_test_isolated_not_a_real_key');
const webhookSecret='whsec_isolated_fixture';
const silent={error:()=>{},warn:()=>{},log:()=>{}};
let db=testDatabase(),recoveries=[],completed=[],chargeReads=[],refunds=[],sent=[];
const fakeStripe={
 webhooks:stripe.webhooks,
 accounts:{retrieve:async()=>({details_submitted:true,charges_enabled:true,payouts_enabled:true,metadata:{maskines_charge_model:'direct_charge_v1',maskines_fees_collector:'stripe',maskines_losses_collector:'stripe'}})},
 charges:{retrieve:async(...args)=>{chargeReads.push(args);return {id:'ch_mock',amount:1000};}},
 refunds:{create:async(...args)=>{refunds.push(args);return {id:'re_mock',status:'succeeded'};}}
};
const company={id:'company',owner_user_id:'seller',name:'Fixture company',verification_status:'approved',stripe_account_id:'acct_mock',stripe_details_submitted:true,stripe_charges_enabled:true,stripe_payouts_enabled:true,shipping_price_strategy:'sum'};
const loader=createTestLoader({
 '@/lib/stripe':{getStripe:()=>fakeStripe},
 '@/lib/supabase-admin':{getSupabaseAdmin:()=>db.admin,requireUserFromRequest:async()=>{throw new Error('Kirjautuminen vaaditaan');}},
 '@/lib/company-verification-payment':{COMPANY_VERIFICATION_PAYMENT_KIND:'verification',completeCompanyVerificationPayment:async()=>{}},
 '@/lib/company-verification-email':{sendCompanyVerificationReceipt:async()=>{}},
 '@/lib/commerce/stripe-connect':{updateCompanyStripeState:async()=>{}},
 '@/lib/commerce/stripe-transfer-recovery':{recoverSellerTransfers:async args=>recoveries.push(args)},
 '@/lib/commerce/complete-paid-checkout':{completePaidCheckoutSession:async args=>completed.push(args)},
 '@/lib/commerce/emails':{sendFulfillmentUpdateEmail:async args=>sent.push(args)},
 '@/lib/commerce/server':{
   normalizeText:(value,max=500)=>String(value??'').trim().slice(0,max),
   isEmail:value=>/^[^@]+@[^@]+\.[^@]+$/.test(value),
   requireCommerceUser:async()=>({admin:db.admin,user:{id:'seller'}}),
   getOwnedCompany:async()=>company,
   errorResponse:(error)=>Response.json({error:error.message},{status:500})
 },
 '@/lib/email-template':{normalizeEmailLocale:value=>['fi','en','sv','no'].includes(value)?value:'fi'},
 '@/lib/site-url':{absoluteSiteUrl:path=>'http://localhost:3000'+path}
},{process:{env:{STRIPE_SECRET_KEY:'sk_test_isolated',STRIPE_WEBHOOK_SECRET:webhookSecret}},console:silent});
const webhook=loader('app/api/commerce/stripe/webhook/route.ts');
let sequence=0;
async function event(type,object,extra={}) {
 const payload=JSON.stringify({id:'evt_'+(++sequence),object:'event',type,livemode:false,data:{object},...extra});
 return webhook.POST(new Request('http://localhost/api/commerce/stripe/webhook',{method:'POST',headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload,secret:webhookSecret})},body:payload}));
}
assert.equal((await webhook.POST(new Request('http://localhost/',{method:'POST',body:'bad'}))).status,400);
assert.equal((await event('account.updated',{}, {livemode:true})).status,200);
assert.equal(db.calls.length,0,'wrong mode never touches DB');
await event('checkout.session.completed',{payment_status:'unpaid'});
assert.equal(completed.length,0);
await event('checkout.session.completed',{payment_status:'paid',metadata:{order_id:'o'},payment_intent:'pi_mock'});
assert.equal(completed.length,1);
db=testDatabase({orders:[{id:'paid',payment_status:'paid'},{id:'refunded',payment_status:'refunded'},{id:'pending',payment_status:'pending'}]});
for(const id of ['paid','refunded','pending']) await event('checkout.session.async_payment_failed',{metadata:{order_id:id}});
assert.deepEqual(db.tables.orders.map(row=>row.payment_status),['paid','refunded','failed'],'late failures cannot overwrite settled orders');
db=testDatabase({orders:[{id:'o',stripe_payment_intent_id:'pi_mock',payment_status:'paid'}]});
await event('charge.refunded',{payment_intent:'pi_mock',amount:1000,amount_refunded:400,metadata:{order_id:'o'}},{account:'acct_mock'});
assert.equal(db.tables.orders[0].payment_status,'partially_refunded');
assert.equal(recoveries.length,0,'direct seller refunds never reverse platform transfers');
await event('charge.refunded',{payment_intent:'pi_mock',amount:1000,amount_refunded:1000,metadata:{order_id:'o'}},{account:'acct_mock'});
assert.equal(db.tables.orders[0].payment_status,'refunded');
assert.equal(db.tables.orders[0].fulfillment_status,'cancelled');
await event('charge.refunded',{payment_intent:'pi_mock',amount:1000,amount_refunded:1000,metadata:{order_id:'o'}});
assert.equal(recoveries.length,1,'platform refund recovers transfers');
const before=recoveries.length;
await event('charge.dispute.created',{id:'dp_mock',payment_intent:'pi_mock',charge:'ch_mock',amount:1000},{account:'acct_mock'});
assert.deepEqual(chargeReads.at(-1),['ch_mock',{}, {stripeAccount:'acct_mock'}]);
assert.equal(recoveries.length,before,'direct disputes do not touch platform transfers');
const duplicateId='evt_duplicate';
await event('account.updated',{}, {id:duplicateId});
const duplicate=await event('account.updated',{}, {id:duplicateId});
assert.equal((await duplicate.json()).duplicate,true);
console.log('PASS signed webhooks: signature, mode isolation, unpaid/paid routing, duplicates, late failure, partial/full refund, Connect dispute context.');

const checkout=loader('app/api/commerce/checkout/route.ts');
const body={customerName:'Fixture Buyer',customerEmail:'buyer@example.invalid',customerAddress:'Testikatu 1',customerPostalCode:'00100',customerCity:'Helsinki',customerCountry:'FI',items:[{productId:'p',quantity:1}],shippingMethod:'pickup'};
const post=values=>checkout.POST(new Request('http://localhost/api/commerce/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,...values})}));
db=testDatabase({products:[{id:'p',name:'Fixture',company_id:'company',company,active:true,stock_quantity:0}]});
assert.equal((await post({})).status,409);
assert.equal(db.calls.filter(c=>c.operation!=='select').length,0,'sold out does not create an order');
for(const quantity of [0,-1,0.5,1001,'invalid']) assert.equal((await post({items:[{productId:'p',quantity}]})).status,400);
assert.equal((await post({items:[{productId:'p',quantity:600},{productId:'p',quantity:600}]})).status,400);
assert.equal((await post({buyerType:'company'})).status,401);
db.tables.products[0].stock_quantity=1;
assert.equal((await post({items:[{productId:'p',quantity:1},{productId:'p',quantity:1}]})).status,409,'duplicate lines checked together');
const validation=loader('lib/commerce/validation.ts');
const product={shipping_price_cents:700,shipping_price_fi_cents:700,shipping_price_se_cents:1500,shipping_price_no_cents:2300,max_shipping_quantity:2};
for(const [country,price] of [['FI',1400],['SE',3000],['NO',4600]]) assert.equal(validation.calculateProductShippingPrice(product,3,country),price);
assert.equal(validation.calculateCartShippingPrice([{product,quantity:3},{product,quantity:1}],'sum'),2100);
assert.equal(validation.calculateCartShippingPrice([{product,quantity:3},{product,quantity:1}],'highest'),1400);
console.log('PASS checkout: sold-out, invalid/duplicate quantities, company authentication, FI/SE/NO shipping and parcel/strategy totals.');

const orders=loader('app/api/commerce/orders/route.ts');
const order={id:'o',company_id:'company',payment_status:'paid',fulfillment_status:'unfulfilled',shipping_method:'posti',total_cents:1000,stripe_payment_intent_id:'pi_mock',stripe_transfer_status:'direct_charge',customer_user_id:'seller'};
const patch=values=>orders.PATCH(new Request('http://localhost/api/commerce/orders',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:'o',...values})}));
db=testDatabase({orders:[{...order,payment_status:'pending'}]});
assert.equal((await patch({fulfillment_status:'shipped',posti_tracking_code:'TEST'})).status,409);
db=testDatabase({orders:[order]});
assert.equal((await patch({fulfillment_status:'shipped'})).status,400);
assert.equal((await patch({fulfillment_status:'shipped',posti_tracking_code:'TEST'})).status,200);
assert.equal(sent.length,1);
assert.equal((await patch({fulfillment_status:'shipped',posti_tracking_code:'TEST'})).status,200);
assert.equal(sent.length,1,'repeated shipment does not send duplicate email');
assert.equal((await patch({fulfillment_status:'cancelled'})).status,409);
db=testDatabase({orders:[order]});
assert.equal((await patch({fulfillment_status:'cancelled'})).status,200);
assert.equal(refunds.length,1);
assert.equal(refunds[0][0].amount,1000);
assert.equal(refunds[0][0].refund_application_fee,false);
assert.equal(refunds[0][1].stripeAccount,'acct_mock');
assert.equal(refunds[0][1].idempotencyKey,'company-cancel-order-direct-o');
db=testDatabase({orders:[{...order,company_id:'another_company'}]});
assert.equal((await patch({fulfillment_status:'cancelled'})).status,404);
assert.equal(refunds.length,1,'non-owner cannot refund');
console.log('PASS fulfillment/refund route: paid-only, tracking required, duplicate notifications, shipped cancellation guard, direct refund amount/account/idempotency, ownership.');
console.log('All calls used isolated fixtures. No Stripe/network requests, payments, refunds, emails, shipments or production writes were made.');
