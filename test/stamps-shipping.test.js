import test from 'node:test';
import assert from 'node:assert/strict';
import {addressReady,buildShipment,normalizeAddress,normalizePackage,packageReady} from '../stamps-shipping.js';

test('normalizes Sole Rebel order addresses for Stamps.com',()=>{
  const address=normalizeAddress({name:'Customer',street:'123 Main St',street2:'Apt 4',city:'Ogden',state:'ut',zip:'84401'});
  assert.equal(address.address_line1,'123 Main St');
  assert.equal(address.address_line2,'Apt 4');
  assert.equal(address.state_province,'UT');
  assert.equal(address.country_code,'US');
  assert.equal(addressReady(address),true);
});

test('builds 4x6 PDF label payloads with tracking',()=>{
  const shipment=buildShipment({fromAddress:{name:'Sole Rebel',street:'1 Return Rd',city:'Ogden',state:'UT',zip:'84401'},toAddress:{name:'Customer',street:'2 Ship St',city:'Salt Lake City',state:'UT',zip:'84101'},pkg:{weight:4,length:10,width:7,height:1},serviceType:'usps_ground_advantage',orderNumber:'SR-1001'});
  assert.deepEqual(shipment.label_options,{label_size:'4x6',label_format:'pdf',label_output_type:'url'});
  assert.equal(shipment.delivery_confirmation_type,'tracking');
  assert.equal(shipment.references.reference1,'SR-1001');
  assert.equal(shipment.package.weight_unit,'ounce');
});

test('rejects empty package values',()=>{
  const pkg=normalizePackage({});
  assert.equal(packageReady(pkg),false);
});
