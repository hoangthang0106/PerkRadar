import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categoryLabel, diagnosticLabel, sourceLabel } from "../src/lib/ui-labels";
import { CATEGORIES } from "../src/lib/types";

describe("English-first PerkRadar UI", () => {
  it("presents all stored categories in English without changing canonical data", () => {
    assert.deepEqual(CATEGORIES, [
      "免费白嫖", "限免", "低价优惠", "会员订阅", "游戏", "其他",
    ]);
    assert.deepEqual(CATEGORIES.map(categoryLabel), [
      "Freebies", "Free for a Limited Time", "Discounts",
      "Memberships & Subscriptions", "Games", "Other",
    ]);
  });
  it("uses English source labels with stable source IDs", () => {
    assert.equal(sourceLabel("linuxdo", "LINUX DO福利羊毛"), "LINUX DO · Freebies");
    assert.equal(sourceLabel("appinn", "小众软件"), "Appinn · Software");
    assert.equal(sourceLabel("epic", "Epic"), "Epic Games");
    assert.equal(sourceLabel("future-source", "Original name"), "Original name");
  });
  it("translates operational diagnostics without changing original API errors", () => {
    assert.equal(diagnosticLabel("连续失败 3 轮"), "3 consecutive failures");
    assert.equal(diagnosticLabel("解析条数骤降至 5"), "parsed item count dropped to 5");
    assert.equal(diagnosticLabel("未能解析 RSS/Atom"), "Unable to parse RSS/Atom feed");
    assert.equal(diagnosticLabel("V2EX推广 连续失败 3 轮"), "V2EX · Promotions 3 consecutive failures");
  });
});
