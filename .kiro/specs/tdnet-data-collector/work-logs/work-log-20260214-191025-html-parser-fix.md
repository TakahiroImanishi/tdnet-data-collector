# Work Log: HTML Parser Fix for Actual TDnet Structure

**Task**: 31.2.6.1 HTMLパーサーの修正（Critical）
**Started**: 2026-02-14 19:10:25
**Status**: In Progress

## Objective
実際のTDnet HTML構造に合わせてHTMLパーサーを修正する。

## Current Implementation Analysis

### Files to Modify
1. `src/scraper/html-parser.ts` - CSSセレクタとパースロジック
2. `src/lambda/collector/scrape-tdnet-list.ts` - Shift_JISエンコーディング対応

### Current Parser Assumptions
- Uses CSS selector: `table.disclosure-list`
- Expects table rows with 6 cells:
  - Cell 0: company_code
  - Cell 1: company_name
  - Cell 2: disclosure_type
  - Cell 3: title
  - Cell 4: disclosed_at
  - Cell 5: pdf_url (link in anchor tag)

## Investigation Steps

### Step 1: Fetch Real TDnet HTML
Need to fetch actual HTML from TDnet to understand the real structure.

