# 📊 Crypto Futures Liquidation Calculator – Complete & Accurate PRD

## 🎯 Goal
Build an **accurate liquidation price calculator** for crypto futures trading that:
- Works with **any leverage**
- Includes **maintenance margin**
- Is based on **position size**
- Supports **LONG & SHORT**
- Matches real exchange behavior (Binance/Bybit approx)

---

## 🧾 Required Inputs

### 🔹 User Inputs
| Name | Type | Example | Description |
|---|---|---|---|
| entryPrice (EP) | number | 77232 | Entry price |
| margin (IM) | number | 3.1765 | Invested margin |
| leverage (L) | number | 150 | Leverage |
| positionType | string | LONG / SHORT | Trade side |

### 🔹 Exchange Inputs
| Name | Type | Default | Description |
|---|---|---|---|
| maintenanceMarginRate (MMR) | number | 0.004 | 0.4%–0.5% |
| feeRate | number | 0 | Optional |

---

## 🧮 Core Calculations (Step-by-Step)

---

### 1️⃣ Position Size
```js
positionSize = margin * leverage
