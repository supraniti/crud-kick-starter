# Example - Products Module

## Goal
- Provide an ecommerce products module for catalog CRUD and operational product states.

## Contract Snapshot
- Entities:
  - `product` (name, sku, slug, price, currency, stock, status, description, categoryId)
- UI:
  - catalog list + filters (status/category/stock)
  - product editor
  - quick status controls
- Actions:
  - `archive-product`
  - `restock-product`
- Settings:
  - default currency
  - stock warning threshold
  - price precision policy

## In Scope
1. Product CRUD with validation for sku/price/stock.
2. Filterable catalog view and edit workflow.
3. Product operational actions for archive/restock.

## Out Of Scope
1. Checkout/order pipeline.
2. Payment gateway integrations.
3. Complex pricing engines (discount rules, bundles).

## Acceptance Criteria (Sample)
1. User can manage product records through UI CRUD.
2. Sku uniqueness and price validation are enforced.
3. Stock/status actions update runtime and persistence consistently.
4. Verification lanes pass with no unresolved critical/high findings.

## Likely Extension Levels
1. Level 1: manifest schema/routes/settings declaration.
2. Level 2: module-local action handlers.
3. Level 3: shared price/slug helpers if reused by other modules.
4. Level 4: only by explicit waiver.
