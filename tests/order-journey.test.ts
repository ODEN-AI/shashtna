import assert from "node:assert/strict";
import { test } from "node:test";

const journey = await import("@/src/lib/order-journey");

const states = (stage: Parameters<typeof journey.journeySteps>[0]) =>
  journey.journeySteps(stage).map((step) => `${step.key}:${step.state}`);

test("order status and proof map onto the customer journey", () => {
  assert.equal(journey.orderStage("SUBMITTED", false), "PAYMENT_PENDING");
  assert.equal(journey.orderStage("AWAITING_PAYMENT", false), "PAYMENT_PENDING");
  assert.equal(journey.orderStage("PENDING", false), "PAYMENT_PENDING"); // legacy value
  assert.equal(journey.orderStage("SUBMITTED", true), "UNDER_REVIEW");
  assert.equal(journey.orderStage("PAID", true), "PAID");
  assert.equal(journey.orderStage("FULFILLING", false), "PAID");
  assert.equal(journey.orderStage("COMPLETED", true), "ACTIVATED");
  assert.equal(journey.orderStage("ACCEPTED", false), "ACTIVATED"); // legacy value
  assert.equal(journey.orderStage("CANCELLED", true), "CANCELLED");
  assert.equal(journey.orderStage("REJECTED", false), "REJECTED");
});

test("uploading a proof never counts as paid", () => {
  assert.notEqual(journey.orderStage("SUBMITTED", true), "PAID");
  assert.equal(journey.needsPayment(journey.orderStage("SUBMITTED", true)), false);
  assert.equal(journey.needsPayment(journey.orderStage("SUBMITTED", false)), true);
});

test("journey steps show done / current / upcoming", () => {
  assert.deepEqual(states("PAYMENT_PENDING"), ["SELECT:done", "PAY:current", "PROOF:upcoming", "REVIEW:upcoming"]);
  assert.deepEqual(states("UNDER_REVIEW"), ["SELECT:done", "PAY:done", "PROOF:done", "REVIEW:current"]);
  assert.deepEqual(states("PAID"), ["SELECT:done", "PAY:done", "PROOF:done", "REVIEW:current"]);
  assert.deepEqual(states("ACTIVATED"), ["SELECT:done", "PAY:done", "PROOF:done", "REVIEW:done"]);
  assert.deepEqual(states("PACKAGE_SELECTED"), ["SELECT:current", "PAY:upcoming", "PROOF:upcoming", "REVIEW:upcoming"]);
});
