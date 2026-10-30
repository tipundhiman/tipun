import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/play-billing.js',import.meta.url),'utf8');
test('Verified Android Digital Goods API can preview real Play regional prices without a payment',async()=>{
 let calls=0,requests=0,checkouts=0;
 const sandbox={
  window:{
   getDigitalGoodsService:async store=>{
    assert.equal(store,'https://play.google.com/billing');calls++;
    return {getDetails:async ids=>{
     assert.deepEqual(Array.from(ids),['rhymeorbit_premium','rhymeorbit_pro']);
     return [
      {itemId:'rhymeorbit_premium',price:{currency:'INR',value:600}},
      {itemId:'rhymeorbit_pro',price:{currency:'USD',value:17.99}},
      {itemId:'unexpected_plan',price:{currency:'USD',value:99}}
     ];
    }}
   }
  },
  navigator:{language:'en-IN'},
  fetch:async()=>{requests++;throw Error('No need to fetch the checkout endpoint')},
  Intl,PaymentRequest:class{constructor(){checkouts++}}
 };
 vm.runInNewContext(source,sandbox);
 const result=await sandbox.window.roPlayBilling.previewProducts(['rhymeorbit_premium','rhymeorbit_pro']);
 assert.equal(result.supported,true);
 assert.equal(result.products.length,2);
 assert.equal(result.products[0].productId,'rhymeorbit_premium');
 assert.match(result.products[0].priceText,/600/);
 assert.match(result.products[1].priceText,/17\.99/);
 assert.equal(sandbox.window.roPlayBilling.readyForCheckout(),false);
 assert.equal(calls,1);
 assert.equal(requests,0);
 assert.equal(checkouts,0);
});
test('Ordinary browsers return no Play billing preview and never charge',async()=>{
 const sandbox={window:{},navigator:{language:'en'},Intl};
 vm.runInNewContext(source,sandbox);
 const result=await sandbox.window.roPlayBilling.previewProducts(['rhymeorbit_premium']);
 assert.equal(result.supported,false);
 assert.deepEqual(Array.from(result.products),[]);
});
test('Never trust malformed product IDs or unknown store responses as priced subscriptions',async()=>{
 let detailsCalled=false;
 const sandbox={
  window:{getDigitalGoodsService:async()=>({getDetails:async()=>{
   detailsCalled=true;
   return [{itemId:'different',price:{currency:'INR',value:100}}];
  }})},
  navigator:{language:'en'},Intl
 };
 vm.runInNewContext(source,sandbox);
 const result=await sandbox.window.roPlayBilling.previewProducts(['rhymeorbit_premium']);
 assert.equal(detailsCalled,true);
 assert.equal(result.products.length,0);
 const bad=await sandbox.window.roPlayBilling.previewProducts(['../secrets']);
 assert.equal(bad.products.length,0);
});
