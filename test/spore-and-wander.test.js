import test from 'node:test';
import assert from 'node:assert/strict';
import {printAreasFor} from '../scripts/spore-and-wander.js';
const template={variants:[{id:1,is_enabled:true,is_available:true},{id:2,is_enabled:false}],print_areas:[{variant_ids:[1,2],placeholders:[{position:'front'},{position:'back'}]}]};
const catalog={variants:[{id:1,placeholders:[{position:'front',width:7200,height:3900},{position:'back',width:7200,height:3900}]}]};
const uploads={front:{id:'branded',width:1620,height:971},back:{id:'pattern',width:1620,height:971}};
test('uses distinct face artwork, available variants, and full coverage',()=>{
  const areas=printAreasFor(template,catalog,uploads);
  assert.deepEqual(areas[0].variant_ids,[1]);
  assert.equal(areas[0].placeholders[0].images[0].id,'branded');
  assert.equal(areas[0].placeholders[1].images[0].id,'pattern');
  assert.equal(areas[0].placeholders[0].images[0].scale,1.01);
});
test('scales narrow artwork to cover the full printable height',()=>{
  const tall={variants:[{placeholders:[{position:'front',width:1000,height:1000},{position:'back',width:1000,height:1000}]}]};
  assert.ok(printAreasFor(template,tall,uploads)[0].placeholders[0].images[0].scale>1.68);
});
test('blocks unexpected print areas and missing geometry',()=>{
  assert.throws(()=>printAreasFor({...template,print_areas:[{variant_ids:[1],placeholders:[{position:'all'}]}]},catalog,uploads),/Review required/);
  assert.throws(()=>printAreasFor(template,{variants:[]},uploads),/Missing dimensions/);
});
test('combined weekender sheet uses two centered faces with opposite orientation',()=>{
  const combined={...template,print_areas:[{variant_ids:[1],placeholders:[{position:'front'}]}]};
  const sheet={variants:[{placeholders:[{position:'front',width:3825,height:4950}]}]};
  const images=printAreasFor(combined,sheet,uploads)[0].placeholders[0].images;
  assert.deepEqual(images.map(i=>[i.id,i.y,i.angle]),[['branded',0.25,0],['pattern',0.75,180]]);
});
