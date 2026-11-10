import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

for (const file of ['public/app.js','public/collection-storefront.js']) {
  test(`${file}: only records an addition after cart persistence succeeds`,()=>{
    const line=readFileSync(file,'utf8').split('\n').find(x=>x.startsWith('function addToCart(')||x.includes('window.addToCart='));
    const events=[],state={cart:[]}; let fail=false;
    const context={state,window:{dispatchEvent:e=>events.push(e)},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},productImage:()=>'',saveCart:()=>{if(fail)throw Error('Storage full');}};
    vm.createContext(context);vm.runInContext(line,context);
    const add=context.addToCart||context.window.addToCart;
    add({id:'shirt'},null); assert.equal(events.length,0);
    add({id:'shirt',title:'Shirt'},{id:1,price:25,title:'M'},1);
    assert.equal(events.length,1); assert.equal(events[0].detail.productId,'shirt');
    assert.equal(state.cart[0].quantity,1);
    fail=true;assert.throws(()=>add({id:'shirt'},{id:1},1),/Storage full/);
    assert.equal(events.length,1);
  });
}
test('analytics ignores quick-add and checkout clicks until confirmed events arrive',()=>{
  const winEvents={},docEvents={},sent=[];
  const storage={getItem:()=>null,setItem:()=>{}};
  const context={window:{localStorage:storage,sessionStorage:storage,addEventListener:(t,f)=>winEvents[t]=f},document:{addEventListener:(t,f)=>docEvents[t]=f},navigator:{sendBeacon:(_url,blob)=>{sent.push(blob);return true;}},location:{pathname:'/'},Blob};
  vm.runInNewContext(readFileSync('public/analytics-client.js','utf8'),context);
  docEvents.click({target:{closest:selector=>selector==='.quick-add'||selector==='#checkoutBtn'?{}:null}});
  assert.equal(sent.length,1);
  winEvents['wildsage:cart-added']({detail:{productId:'shirt'}});
  winEvents['wildsage:checkout-ready']();
  return Promise.all(sent.map(b=>b.text())).then(rows=>{
    const events=rows.map(JSON.parse);
    assert.deepEqual(events.map(x=>x.type),['page_view','add_to_bag','checkout_start']);
    assert.equal(events[1].productId,'shirt');
    assert.equal(events[1].trackingVersion,2);
  });
});
