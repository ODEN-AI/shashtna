import assert from "node:assert/strict";
import { test } from "node:test";

const { daysLeftAr, daysLeftEn } = await import("@/app/ui/days-text");

test("Arabic days left agrees with the number", () => {
  assert.equal(daysLeftAr(1), "باقي يوم واحد");
  assert.equal(daysLeftAr(2), "باقي يومان");
  assert.equal(daysLeftAr(3), "باقي 3 أيام");
  assert.equal(daysLeftAr(5), "باقي 5 أيام");
  assert.equal(daysLeftAr(10), "باقي 10 أيام");
  assert.equal(daysLeftAr(11), "باقي 11 يومًا");
  assert.equal(daysLeftAr(30), "باقي 30 يومًا");
  assert.equal(daysLeftAr(99), "باقي 99 يومًا");
  assert.equal(daysLeftAr(100), "باقي 100 يوم");
  assert.equal(daysLeftAr(101), "باقي 101 يوم");
  assert.equal(daysLeftAr(305), "باقي 305 أيام");
  assert.equal(daysLeftAr(365), "باقي 365 يومًا");
  assert.equal(daysLeftAr(0), "ينتهي اليوم");
  assert.equal(daysLeftAr(-3), "ينتهي اليوم", "never negative");
});

test("English days left", () => {
  assert.equal(daysLeftEn(1), "1 day left");
  assert.equal(daysLeftEn(5), "5 days left");
  assert.equal(daysLeftEn(0), "ends today");
});
