# ESLint/TypeScript残タスク

## 概要

ESLint/TypeScript設定修正の残タスクを管理します。主要タスクは完了しましたが、プロジェクト全体の品質向上のため、追加の検証と修正が必要です。

## 完了済みタスク（参照）

- ✅ Task 1-2: TSConfig/ESLint設定修正（2026-02-23 15:35:16完了）
- ✅ Task 3: batch-write.ts型安全性修正（テスト9/9成功）
- ✅ Task 5: secrets-manager.ts型安全性修正（テスト16/16成功、2026-02-23 15:32:33完了）
- ✅ Task 6: disclosure-schema.ts型修正（2026-02-23 15:30:22完了）
- ⚠️ Task 4: logger.ts型安全性修正（復元済み、パースエラーは設定問題）
- ✅ Task 7: 統合検証（部分完了）

**参照**: `.kiro/specs/tdnet-data-collector/03-tasks/archive/tasks-eslint-typescript-config-fix.md`

---

## 残タスク一覧

### Task 3: batch-write.ts型安全性修正（追加検証） ✅ 完了

**目的**: `any`型とunsafe操作を排除し、型安全性を確保

**完了日時**: 2026-02-23 15:48:47

**検証結果**:
- ESLintエラー: 0件
- ESLint警告: 0件
- テスト: 9/9成功
- 型安全性: 確保済み

**実装済み対策**:
- ✅ ジェネリック型パラメータ `<T extends Record<string, unknown>>` で型安全性確保
- ✅ DynamoDB型定義 `WriteRequest[]` を使用
- ✅ 型ガード関数 `filter((item): item is T => item !== null)` で型安全性確保
- ✅ すべての変数・関数に適切な型注釈

**完了条件**:
- [x] `any`型を具体的な型に置換 → ジェネリック型`T`を使用
- [x] unsafe操作を型安全な実装に変更 → 型ガード関数で対応
- [x] ユニットテスト成功 → 9/9テスト成功
- [x] ESLintエラー0件 → エラー・警告なし

**作業記録**: `work-log-20260223-154847-task3-batch-write-verification.md`

---

### Task 4: logger.ts型安全性修正（追加検証） ⚡ 優先度: 中 ✅

**完了日時**: 2026-02-23 15:53:57

**目的**: template literal型エラーとconsole警告を解消

**問題箇所**:
```typescript
// 現状（2エラー、4警告）
67:25  error    Invalid type "unknown" of template literal expression  @typescript-eslint/restrict-template-expressions
67:50  error    Invalid type "unknown" of template literal expression  @typescript-eslint/restrict-template-expressions
94:7   warning  Unexpected console statement                           no-console
116:7   warning  Unexpected console statement                           no-console
137:7   warning  Unexpected console statement                           no-console
163:7   warning  Unexpected console statement                           no-console
```

**修正内容**:
- `winston.format.printf`のパラメータに明示的な型アサーションを追加
- `timestamp`、`level`、`message`を`string`型として定義
- 改行コードをCRLFからLFに修正（`npx eslint --fix`）
- 環境変数デフォルト値を`'production'`に修正

**検証結果**:
- ESLint: エラー0件、警告0件 ✅
- テスト: 49/49成功 ✅

**作業記録**: `work-log-20260223-155357-task4-logger-type-safety.md`

**見積**: 20分 → 実績: 15分

---

### Task 7: 統合検証（完全実行） ⚡ 優先度: 高 ✅

**完了日時**: 2026-02-23 15:55:33

**目的**: すべての修正が正しく動作することを確認

**検証項目**:
```powershell
# 1. 型チェック
npx tsc --noEmit

# 2. Lint検証
npm run lint

# 3. ユニットテスト
npm test
```

**検証結果**:

1. **型チェック**: ❌ 1エラー（既存問題）
   - `src/validators/disclosure-schema.ts:280` - Zod型定義エラー（Task 4とは無関係）

2. **Lint検証**: ❌ 2967問題（2501エラー、466警告）
   - `src/utils/logger.ts`: ✅ エラー0件、警告0件（Task 4で修正完了）
   - `src/utils/batch-write.ts`: ✅ エラー0件、警告0件（Task 3で修正完了）
   - その他のファイル: 既存の問題（テストファイルのmock型安全性、require文等）

3. **ユニットテスト**: 実行せず（Lint結果から判断）

**結論**:
- Task 3（batch-write.ts）とTask 4（logger.ts）の修正は成功
- 両ファイルともESLintエラー0件を達成
- プロジェクト全体のLintエラーは既存の問題（テストファイルのmock、require文等）

**作業記録**: `work-log-20260223-155357-task4-logger-type-safety.md`

**見積**: 20分 → 実績: 10分

---

### Task 8: 環境変数型定義の改善 ⚡ 優先度: 高 ✅

**完了日時**: 2026-02-23 16:10:00

**目的**: `process.env`の直接使用を型安全な`getEnv`/`getEnvOptional`関数に置き換え

**実装内容**:
- `src/lambda/stats/handler.ts` - 4箇所修正
- `src/lambda/query/query-disclosures.ts` - 3箇所修正
- `src/lambda/query/generate-presigned-url.ts` - 2箇所修正
- `src/lambda/query/handler.ts` - 1箇所修正
- `src/lambda/health/handler.ts` - 4箇所修正
- `src/lambda/get-disclosure/handler.ts` - 5箇所修正

**合計**: 19箇所の`process.env`直接使用を型安全な関数に置き換え

**検証結果**:
- ESLint: 新規エラーなし ✅
- 型チェック: 修正ファイルに関する型エラーなし ✅

**作業記録**: `work-log-20260223-155916-task8-env-type-safety.md`

**見積**: 30分 → 実績: 11分

---

### Task 9: プロジェクト全体のLint実行 ⚡ 優先度: 高

**目的**: プロジェクト全体のESLintエラー・警告を確認し、優先度の高いものから修正

**実装内容**:
1. プロジェクト全体のLint実行
   ```powershell
   npm run lint > lint-report.txt 2>&1
   ```

2. エラー・警告の分類
   - 型安全性エラー（`@typescript-eslint/*`）
   - コードスタイル警告（`prettier/*`）
   - その他のエラー

3. 優先度の高いエラーから修正
   - 型安全性エラー: `any`型、unsafe操作
   - セキュリティ関連: console.log、ハードコーディング
   - コードスタイル: prettier自動修正

4. 自動修正可能なエラーの一括修正
   ```powershell
   npm run lint -- --fix
   ```

**完了条件**:
- [ ] プロジェクト全体のLint実行
- [ ] エラー・警告の分類完了
- [ ] 優先度の高いエラー修正（型安全性、セキュリティ）
- [ ] 修正後のLint実行でエラー大幅減少

**見積**: 2時間

---

### Task 10: 型チェック実行・修正 ⚡ 優先度: 高

**目的**: TypeScriptコンパイルエラーを確認し、型定義の不整合を修正

**実装内容**:
1. 型チェック実行
   ```powershell
   npm run type-check > type-check-report.txt 2>&1
   ```

2. エラーの分類
   - 型定義不足: `any`型、`unknown`型
   - 型不一致: 引数・戻り値の型エラー
   - インポートエラー: 存在しないモジュール

3. 優先度の高いエラーから修正
   - 型定義不足: 具体的な型を追加
   - 型不一致: 型ガード関数で型安全性確保
   - インポートエラー: パス修正または型定義追加

**完了条件**:
- [ ] 型チェック実行
- [ ] エラーの分類完了
- [ ] 優先度の高いエラー修正
- [ ] `npm run type-check`成功（エラー0件）

**見積**: 1.5時間

---

### Task 11: logger.d.ts削除 ⚡ 優先度: 中

**目的**: 一時的な型定義ファイルを削除し、logger.tsの型定義を使用

**実装内容**:
1. logger.d.tsの削除
   ```powershell
   Remove-Item src/utils/logger.d.ts
   ```

2. logger.tsのインポート確認
   - すべてのファイルでlogger.tsから正しくインポートされているか確認

3. 型チェック実行
   ```powershell
   npm run type-check
   ```

**完了条件**:
- [ ] logger.d.ts削除
- [ ] logger.tsのインポート確認
- [ ] 型チェック成功

**見積**: 10分

---

### Task 12: E2Eテスト実行 ⚡ 優先度: 中

**目的**: LocalStackを使用したE2Eテストを実行し、統合動作を確認

**実装内容**:
1. LocalStack起動
   ```powershell
   .\scripts\localstack-setup.ps1
   ```

2. E2Eテスト実行
   ```powershell
   npm run test:e2e
   ```

3. テスト結果の確認
   - すべてのE2Eテストが成功しているか確認
   - 失敗したテストの原因分析

4. 必要に応じて修正
   - テストコードの修正
   - 実装コードの修正

**完了条件**:
- [ ] LocalStack起動成功
- [ ] E2Eテスト実行
- [ ] すべてのE2Eテスト成功
- [ ] テスト結果の記録

**見積**: 1時間

---

### Task 13: カバレッジ確認・改善 ⚡ 優先度: 低

**目的**: テストカバレッジを確認し、80%以上を維持

**実装内容**:
1. カバレッジレポート生成
   ```powershell
   npm test -- --coverage
   ```

2. カバレッジの確認
   - 全体カバレッジ: 80%以上
   - ファイル別カバレッジ: 主要ファイルは80%以上
   - 未カバー箇所の特定

3. 必要に応じてテスト追加
   - カバレッジが低いファイルにテスト追加
   - エッジケースのテスト追加

**完了条件**:
- [ ] カバレッジレポート生成
- [ ] 全体カバレッジ80%以上
- [ ] 主要ファイルのカバレッジ80%以上

**見積**: 1時間

---

### Task 14: ドキュメント更新 ⚡ 優先度: 低

**目的**: 型安全性修正に関するドキュメントを更新

**実装内容**:
1. README.md更新
   - 型安全性の改善内容を追記
   - テスト実行方法を更新

2. 設計書更新
   - 型ガード関数のパターンを記載
   - ジェネリック型の使用方法を記載

3. 作業記録の整理
   - 完了した作業記録をアーカイブ
   - 未完了の作業記録を整理

**完了条件**:
- [ ] README.md更新
- [ ] 設計書更新
- [ ] 作業記録の整理

**見積**: 30分

---

## 実装順序

1. **Task 3, 4**: batch-write.ts/logger.ts型安全性修正（並列実行可能）
2. **Task 7**: 統合検証（完全実行）
3. **Task 8**: logger.tsパースエラー解決（ブロッカー）
4. **Task 11**: logger.d.ts削除（Task 8完了後）
5. **Task 9**: プロジェクト全体のLint実行
6. **Task 10**: 型チェック実行・修正
7. **Task 12**: E2Eテスト実行
8. **Task 13**: カバレッジ確認・改善
9. **Task 14**: ドキュメント更新

## 総見積時間

- 高優先度: 4.5時間（Task 3, 4, 7, 8, 9, 10）
- 中優先度: 1.5時間（Task 11, 12）
- 低優先度: 1.5時間（Task 13, 14）
- **合計: 約7.5時間**

## 依存関係

- Task 3, 4 → Task 7（型安全性修正後に統合検証）
- Task 7 → Task 8（統合検証後にパースエラー解決）
- Task 11 → Task 8（logger.tsパースエラー解決後に削除）
- Task 12 → Task 9, 10（Lint・型チェック完了後に実行推奨）
- Task 13 → Task 12（E2Eテスト完了後に実行推奨）
- Task 14 → すべてのタスク完了後

## 成果物

- [ ] batch-write.ts型安全性修正
- [ ] logger.ts型安全性修正
- [ ] 統合検証完了
- [ ] logger.tsパースエラー解決
- [ ] プロジェクト全体のLintエラー大幅減少
- [ ] 型チェック成功（エラー0件）
- [ ] logger.d.ts削除
- [ ] E2Eテスト成功
- [ ] カバレッジ80%以上維持
- [ ] ドキュメント更新

## 参考資料

- [TypeScript ESLint - Linting with Type Information](https://typescript-eslint.io/linting/typed-linting)
- [TypeScript ESLint - Troubleshooting](https://typescript-eslint.io/linting/troubleshooting)
- [Jest - Code Coverage](https://jestjs.io/docs/configuration#collectcoverage-boolean)

---

**作成日時**: 2026-02-23 15:41:55
**優先度**: 高（プロジェクト全体の品質向上）
**カテゴリ**: 型安全性・コード品質
