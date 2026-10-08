import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFindInput } from "../sole-rebel-finds.js";

test("normalizes an Other Finds listing", () => {
  assert.deepEqual(
    normalizeFindInput({
      title: "  Vintage jacket  ",
      description: "Great condition",
      price: "42.50",
      condition: "Vintage",
      quantity: 1,
      fulfillment: "both",
      shippingPrice: "8",
    }),
    {
      title: "Vintage jacket",
      description: "Great condition",
      price: 42.5,
      condition: "Vintage",
      quantity: 1,
      fulfillment: "both",
      shippingPrice: 8,
    },
  );
});

test("rejectable values normalize to invalid sentinels", () => {
  const item = normalizeFindInput({
    title: "Item",
    price: "not money",
    quantity: -2,
    fulfillment: "teleport",
    shippingPrice: -4,
  });
  assert.equal(item.price, -1);
  assert.equal(item.quantity, -1);
  assert.equal(item.fulfillment, "");
  assert.equal(item.shippingPrice, -1);
});
