import assert from "node:assert/strict";
import test from "node:test";
import { isValidJalaaliDate, toGregorian, toJalaali } from "jalaali-js";

test("converts dates between Gregorian and Jalaali", () => {
  assert.deepEqual(toJalaali(2026, 8, 15), { jy: 1405, jm: 5, jd: 24 });
  assert.deepEqual(toGregorian(1405, 5, 24), { gy: 2026, gm: 8, gd: 15 });
});

test("rejects impossible Jalaali dates", () => {
  assert.equal(isValidJalaaliDate(1404, 12, 30), false);
  assert.equal(isValidJalaaliDate(1405, 5, 24), true);
});
