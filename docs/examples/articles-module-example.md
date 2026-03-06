# Example - Articles Module

## Goal
- Provide a WordPress-like articles module with editorial CRUD and publish lifecycle.

## Contract Snapshot
- Entities:
  - `article` (title, slug, excerpt, body, status, authorId, publishedAt, tags)
  - optional `category`
- UI:
  - list + filter by status/tag
  - editor form
  - detail preview
- Actions:
  - `publish`
  - `unpublish`
  - `schedule-publish`
- Settings:
  - default status
  - slug policy
  - excerpt length

## In Scope
1. Article CRUD with draft/published states.
2. Slug generation and uniqueness validation.
3. Basic editorial actions (`publish`, `unpublish`).

## Out Of Scope
1. Rich-media asset pipeline.
2. Full revision history and diff viewer.
3. SEO analytics integrations.

## Acceptance Criteria (Sample)
1. User can create, edit, and delete articles in UI.
2. Publish action transitions status deterministically.
3. Filtered list and detail view reflect persisted state.
4. Required verification lanes pass.

## Likely Extension Levels
1. Level 1: manifest schema/routes/settings declaration.
2. Level 2: module-local editor and action adapter.
3. Level 3: shared slug/validation helper only if reused.
4. Level 4: avoid unless core gap is proven.
