# 環境変数等のハードコード改善タスク

**作成日**: 2026-02-23
**ステータス**: 進行中
**優先度**: 中
**最終更新**: 2026-02-23

## 概要

プロジェクト全体で環境変数、設定値、リソース名等がハードコードされている箇所を特定し、設定ファイルや環境変数から取得するように改善する。

## 目的

- 環境間（dev/prod）での設定変更を容易にする
- デプロイ時の設定ミスを防ぐ
- 保守性と可読性を向上させる
- セキュリティリスクを低減する

## 進捗サマリー

| カテゴリ | 完了 | 未完了 | 合計 |
|---------|------|--------|------|
| 調査・方針策定 | 2 | 0 | 2 |
| Lambda設定値 | 4 | 1 | 5 |
| 定数・制限値 | 5 | 0 | 5 |
| 検証 | 0 | 1 | 1 |
| **合計** | **11** | **2** | **13** |

---

## 完了済みタスク

### タスク1: ハードコード箇所の網羅的調査

**ステータス**: ✅ 完了（2026-02-23）
**担当**: サブエージェント（4並列実行）
**完了日**: 2026-02-23

#### 作業内容

プロジェクト全体を4つのサブエージェントで並列調査し、ハードコードされている箇所を特定・分類しました。

#### 調査実施

1. **AWSリージョン・プロファイル調査** - サブエージェント1
2. **Lambda設定値・リソース名調査** - サブエージェント2
3. **その他の定数調査** - サブエージェント3
4. **外部API URL・ファイルサイズ調査** - サブエージェント4

#### 成果物

- ✅ ハードコード箇所一覧（207箇所特定）
- ✅ 分類別の影響範囲分析（7カテゴリ）
- ✅ 優先度付けされた改善計画（高62箇所、中19箇所、低126箇所）
- ✅ 作業記録ファイル（4ファイル）

#### 作業記録

- `work-log-20260223-081005-hardcode-aws-config-investigation.md`
- `work-log-20260223-081013-hardcode-lambda-resources-investigation.md`
- `work-log-20260223-081021-hardcode-constants-investigation.md`
- `work-log-20260223-081049-hardcode-urls-limits-investigation.md`

---

### タスク2: 対応方針の策定とタスク追加

**ステータス**: ✅ 完了（2026-02-23）
**担当**: Kiro AI Assistant
**完了日**: 2026-02-23

#### 作業内容

調査結果を基に、Lambda設定値のハードコード改善方針を策定し、具体的な改善タスク（タスク3-12）を作成しました。

#### 成果物

- ✅ 対応方針ドキュメント（作業記録）
- ✅ 改善タスクリスト（タスク3-12追加）
- ✅ 実装ガイドライン（steering file更新内容策定）

#### 作業記録

- `work-log-20260223-082844-hardcode-lambda-config-strategy.md`

---

### タスク3: environment-config.ts拡張

**ステータス**: ✅ 完了（2026-02-23）
**担当**: Kiro AI Assistant
**完了日**: 2026-02-23 14:06:05
**優先度**: 高

#### 作業内容

`cdk/lib/config/environment-config.ts`を拡張し、Step Functions用Lambda設定とruntime設定を追加しました。

#### 成果物

- ✅ `cdk/lib/config/environment-config.ts`（修正）
- ✅ `cdk/lib/config/__tests__/environment-config.test.ts`（テスト追加）
- ✅ TypeScriptコンパイル成功
- ✅ ユニットテスト成功（11 passed）

#### 作業記録

- `work-log-20260223-140605-task3-environment-config-extension.md`

---

### タスク4: ComputeStack修正（Step Functions Lambda）

**ステータス**: ✅ 完了（2026-02-23）
**担当**: Kiro AI Assistant
**完了日**: 2026-02-23
**優先度**: 高

#### 作業内容

`cdk/lib/stacks/compute-stack.ts`のStep Functions用Lambda 4関数の設定を`envConfig`から取得するように修正しました。

#### 成果物

- ✅ `cdk/lib/stacks/compute-stack.ts`（修正）
- ✅ `cdk/lib/stacks/__tests__/compute-stack.test.ts`（テスト修正）
- ✅ ユニットテスト実行成功（36/36テスト成功）
- ✅ CDK synth成功

#### 作業記録

- `work-log-20260223-140603-task4-compute-stack-step-functions.md`

---

### タスク5: ComputeStack修正（runtime統一）

**ステータス**: ✅ 完了（2026-02-23）
**担当**: Kiro AI Assistant
**完了日**: 2026-02-23
**優先度**: 中

#### 作業内容

`cdk/lib/stacks/compute-stack.ts`の全Lambda関数（13関数）のruntime設定を`envConfig.runtime`に統一しました。

#### 成果物

- ✅ `cdk/lib/stacks/compute-stack.ts`（修正）
- ✅ ユニットテスト実行成功（36/36テスト成功）
- ✅ CDK synth成功

#### 作業記録

- `work-log-20260223-140607-task5-compute-stack-runtime.md`

---

### タスク6: ユニットテスト更新

**ステータス**: ✅ 完了（2026-02-23）
**担当**: Kiro AI Assistant
**完了日**: 2026-02-23 14:15:41
**優先度**: 高

#### 作業内容

`cdk/lib/stacks/__tests__/compute-stack.test.ts`にStep Functions用Lambda設定とruntime設定の検証テストを追加しました（既存テストで十分であることを確認）。

#### 成果物

- ✅ すべてのユニットテストが成功（36/36テスト成功）

#### 作業記録

- `work-log-20260223-141541-task6-unit-test-update.md`

---

### タスク8: ファイルサイズ制限定数ファイル作成

**ステータス**: ✅ 完了（2026-02-23）
**担当**: Kiro AI Assistant
**完了日**: 2026-02-23 14:06:15
**優先度**: 高

#### 作業内容

`src/constants/file-limits.ts`を作成し、ファイルサイズ制限定数を定義。既存コードを修正して定数ファイルを参照するように変更しました。

#### 成果物

- ✅ `src/constants/file-limits.ts`
- ✅ 修正済み本番コード（3ファイル）
- ✅ 修正済みテストコード（3ファイル）
- ✅ ユニットテスト実行成功（69 passed）

#### 作業記録

- `work-log-20260223-140615-task8-file-limits-constants.md`

---

### タスク9: レート制限設定定数ファイル作成

**ステータス**: ✅ 完了（2026-02-23）
**担当**: Kiro AI Assistant
**完了日**: 2026-02-23 14:06:18
**優先度**: 高

#### 作業内容

`src/constants/rate-limits.ts`を作成し、レート制限設定定数を定義。既存コードを修正して定数ファイルを参照するように変更しました。

#### 成果物

- ✅ `src/constants/rate-limits.ts`
- ✅ 修正済み本番コード（5ファイル）
- ✅ ユニットテスト実行成功（93 passed）

#### 作業記録

- `work-log-20260223-140618-task9-rate-limits-constants.md`

---

### タスク10: HTTP設定定数ファイル作成

**ステータス**: ✅ 完了（2026-02-23）
**担当**: Kiro AI Assistant
**完了日**: 2026-02-23 14:06:21
**優先度**: 中

#### 作業内容

`src/constants/http-config.ts`を作成し、HTTP設定定数を定義。既存コードを修正して定数ファイルを参照するように変更しました。

#### 成果物

- ✅ `src/constants/http-config.ts`
- ✅ 修正済み本番コード（3ファイル）
- ✅ ユニットテスト実行成功（76 passed）

#### 作業記録

- `work-log-20260223-140621-task10-http-config-constants.md`

---

### タスク11: 定数エクスポートファイル作成

**ステータス**: ✅ 完了（2026-02-23）
**担当**: Kiro AI Assistant
**完了日**: 2026-02-23 14:06:24
**優先度**: 高

#### 作業内容

`src/constants/index.ts`を作成し、すべての定数ファイルをエクスポート。インポート文を簡略化しました。

#### 成果物

- ✅ `src/constants/index.ts`
- ✅ 簡略化されたインポート文
- ✅ TypeScriptコンパイル成功
- ✅ すべてのユニットテスト成功（55テスト）

#### 作業記録

- `work-log-20260223-140624-task11-constants-index.md`

---

### タスク12: ドキュメント更新（定数管理）

**ステータス**: ✅ 完了（2026-02-23）
**担当**: Kiro AI Assistant（実装）
**完了日**: 2026-02-23
**優先度**: 中

#### 作業内容

定数ファイルの使用方法、環境変数設定、実装ガイドラインをドキュメントに追加しました。

#### 成果物

- ✅ 更新済み`README.md`（定数ファイルの説明追加）
- ✅ 更新済み`.env.example`（定数設定セクション追加）
- ✅ 更新済みsteering files（2ファイル）
  - `tdnet-implementation-rules.md`: 定数管理ガイド追加
  - `tdnet-scraping-patterns.md`: 定数ファイル参照方法追加

#### 備考

作業ログは作成されていませんが、実装内容はすべて完了しています。

---

## 未完了タスク

### タスク7: E2Eテスト実行

**ステータス**: ⚠️ 未完了（作業途中で中断）
**担当**: -
**優先度**: 高

#### 作業内容

E2Eテストを実行し、Lambda設定変更後の動作を確認する。

#### 実行手順

1. **Docker Desktop起動確認**
   ```powershell
   docker ps
   ```

2. **LocalStack環境起動**
   ```powershell
   docker compose up -d
   ```

3. **LocalStack環境確認**
   ```powershell
   docker ps --filter "name=localstack"
   ```

4. **DynamoDB/S3リソース確認**
   ```powershell
   .\scripts\localstack-setup.ps1
   ```

5. **E2Eテスト実行**
   ```powershell
   npm run test:e2e
   ```

#### 確認項目

- [ ] E2Eテスト実行成功
- [ ] Step Functions実行成功
- [ ] Lambda関数のタイムアウト・メモリ設定が正しく適用されている
- [ ] エラーなく完了する

#### 作業記録

- `work-log-20260223-141640-task7-e2e-test.md`（作業途中で中断）

#### 現状

- ✅ Docker Desktop起動確認
- ⚠️ LocalStack環境確認（途中で記録が終了）
- ❌ DynamoDB/S3リソース確認（未実施）
- ❌ E2Eテスト実行（未実施）
- ❌ Step Functions実行確認（未実施）
- ❌ Lambda関数設定の確認（未実施）

#### 注意事項

tasks-step-functions-migration.mdのタスク6.1.1によると、LocalStack環境でのLambda関数デプロイが未完了のため、E2Eテストは実行できない可能性があります。本番環境での動作確認（タスク6.2）を優先することを推奨します。

---

### タスク13: ハードコード改善の検証

**ステータス**: [ ] 未着手
**担当**: -
**優先度**: 高
**依存**: タスク3-12完了後

#### 作業内容

タスク1で特定したハードコード箇所（207箇所）とタスク2で策定した対応方針に基づき、実施した改善（タスク3-12）が実際に問題を解消しているかを検証する。

#### 検証項目

##### 1. Lambda設定値の検証（タスク3-6の成果）

**検証対象**: タスク1で特定した高優先度11箇所

- [ ] **Step Functions用Lambda 4関数の設定**
  - [ ] `cdk/lib/stacks/compute-stack.ts`でハードコード値が削除されている
  - [ ] `environment-config.ts`から設定を取得している
  - [ ] CollectorInit: timeout 30秒, memorySize 256MB
  - [ ] CollectorFetch: timeout 60秒, memorySize 256MB
  - [ ] CollectorSave: timeout 120秒, memorySize 512MB
  - [ ] CollectorAggregate: timeout 30秒, memorySize 256MB

- [ ] **全Lambda関数のruntime設定**
  - [ ] 13関数すべてで`lambda.Runtime.NODEJS_20_X`のハードコードが削除されている
  - [ ] `envConfig.runtime`から取得している

- [ ] **ユニットテスト検証**
  - [ ] `cdk/lib/stacks/__tests__/compute-stack.test.ts`が成功する
  - [ ] 設定値が正しく適用されていることをテストで確認

##### 2. 定数ファイルの検証（タスク8-11の成果）

**検証対象**: タスク1で特定した高優先度30箇所

- [ ] **ファイルサイズ制限（6箇所）**
  - [ ] `src/constants/file-limits.ts`が存在する
  - [ ] `MIN_PDF_SIZE`, `MAX_PDF_SIZE`, `MAX_FILE_SIZE`が定義されている
  - [ ] 以下のファイルでハードコード値が削除され、定数ファイルを参照している:
    - [ ] `src/scraper/pdf-downloader.ts`
    - [ ] `src/models/disclosure.ts`
    - [ ] `src/validators/disclosure-schema.ts`

- [ ] **レート制限設定（5箇所）**
  - [ ] `src/constants/rate-limits.ts`が存在する
  - [ ] `TDNET_MIN_DELAY_MS`が定義されている
  - [ ] 以下のファイルでハードコード値が削除され、定数ファイルを参照している:
    - [ ] `src/lambda/collector/scrape-tdnet-list.ts`
    - [ ] `src/lambda/collector-fetch/handler.ts`
    - [ ] `src/lambda/collector/download-pdf.ts`
    - [ ] `src/lambda/collector/dependencies.ts`
    - [ ] `src/utils/rate-limiter.ts`

- [ ] **HTTP設定（3箇所）**
  - [ ] `src/constants/http-config.ts`が存在する
  - [ ] `HTTP_TIMEOUT_MS`, `USER_AGENT_FULL`, `USER_AGENT_SHORT`が定義されている
  - [ ] 以下のファイルでハードコード値が削除され、定数ファイルを参照している:
    - [ ] `src/lambda/collector/scrape-tdnet-list.ts`
    - [ ] `src/lambda/collector-fetch/handler.ts`
    - [ ] `src/scraper/pdf-downloader.ts`

- [ ] **定数エクスポート**
  - [ ] `src/constants/index.ts`が存在する
  - [ ] すべての定数ファイルがエクスポートされている

##### 3. ドキュメントの検証（タスク12の成果）

- [ ] **README.md**
  - [ ] 定数ファイルの説明が追加されている
  - [ ] `src/constants/`ディレクトリの説明がある
  - [ ] 使用方法のコード例がある

- [ ] **.env.example**
  - [ ] `TDNET_BASE_URL`のサンプルが追加されている
  - [ ] 定数設定セクションが追加されている
  - [ ] 環境変数で上書き可能な定数が明記されている

- [ ] **steering files**
  - [ ] `tdnet-implementation-rules.md`: 定数管理ガイドが追加されている
  - [ ] `tdnet-scraping-patterns.md`: 定数ファイル参照方法が追加されている

##### 4. 残存ハードコードの確認

**検証対象**: タスク1で特定した中・低優先度箇所（145箇所）

- [ ] **中優先度（19箇所）の確認**
  - [ ] AWSプロファイル名（10箇所）: 運用スクリプトで環境変数対応済みか確認
  - [ ] DLQ Processor設定（3箇所）: 現状維持でOKか確認
  - [ ] API Key Rotation設定（3箇所）: 現状維持でOKか確認
  - [ ] その他（3箇所）: 対応不要か確認

- [ ] **低優先度（126箇所）の確認**
  - [ ] テストコード内のハードコード: 現状維持でOKか確認
  - [ ] ドキュメント内のハードコード: 現状維持でOKか確認

#### 検証方法

##### 自動検証（推奨）

```powershell
# 1. TypeScriptコンパイル確認
npm run build

# 2. ユニットテスト実行
npm test

# 3. ハードコード値の検索（残存確認）
# Lambda設定値
rg "lambda\.Runtime\.NODEJS_20_X" cdk/lib/stacks/compute-stack.ts
rg "timeout.*:\s*\d+" cdk/lib/stacks/compute-stack.ts | rg -v "envConfig"
rg "memorySize.*:\s*\d+" cdk/lib/stacks/compute-stack.ts | rg -v "envConfig"

# 定数値
rg "10240|10\s*\*\s*1024" src/ --type ts | rg -v "constants|test"
rg "52428800|50\s*\*\s*1024\s*\*\s*1024" src/ --type ts | rg -v "constants|test"
rg "2000" src/ --type ts | rg -v "constants|test|retry"
rg "30000" src/ --type ts | rg -v "constants|test"
```

##### 手動検証

1. **ファイル確認**
   - 各定数ファイルが存在し、正しい値が定義されているか確認
   - 本番コードで定数ファイルをインポートしているか確認

2. **コード確認**
   - ハードコード値が削除されているか目視確認
   - インポート文が正しいか確認

3. **ドキュメント確認**
   - README.md、.env.example、steering filesの更新内容を確認

#### 成果物

- [ ] 検証結果レポート（作業記録に記載）
- [ ] 残存ハードコード一覧（発見時）
- [ ] 追加対応が必要な項目のリスト（発見時）

#### 完了条件

- [ ] すべての検証項目が確認されている
- [ ] タスク1で特定した高優先度62箇所のうち、対応対象（Lambda設定値11箇所、定数14箇所）がすべて解消されている
- [ ] ユニットテストがすべて成功している
- [ ] TypeScriptコンパイルが成功している
- [ ] 残存ハードコードが文書化されている（中・低優先度）
- [ ] 追加対応が必要な項目が特定されている（発見時）

#### 作業記録

- 作業開始時に作成: `work-log-[YYYYMMDD-HHMMSS]-task13-hardcode-verification.md`

---

## 調査結果（タスク1完了: 2026-02-23）

### 調査完了サマリー

4つのサブエージェントによる並列調査を実施し、プロジェクト全体のハードコード箇所を網羅的に特定しました。

| 調査項目 | 箇所数 | 優先度高 | 優先度中 | 優先度低 |
|---------|--------|---------|---------|---------|
| AWSリージョン・プロファイル | 123箇所 | 15箇所 | 10箇所 | 98箇所 |
| Lambda設定値・リソース名 | 30箇所 | 11箇所 | 3箇所 | 16箇所 |
| その他の定数 | 39箇所 | 30箇所 | 0箇所 | 9箇所 |
| 外部API URL・ファイルサイズ | 15箇所 | 6箇所 | 6箇所 | 3箇所 |
| **合計** | **207箇所** | **62箇所** | **19箇所** | **126箇所** |

### 詳細調査結果

各調査の詳細は以下の作業記録ファイルを参照:
- `work-log-20260223-081005-hardcode-aws-config-investigation.md` - AWSリージョン・プロファイル
- `work-log-20260223-081013-hardcode-lambda-resources-investigation.md` - Lambda設定値・リソース名
- `work-log-20260223-081021-hardcode-constants-investigation.md` - その他の定数
- `work-log-20260223-081049-hardcode-urls-limits-investigation.md` - 外部API URL・ファイルサイズ

---

## 関連ドキュメント

- `tdnet-implementation-rules.md`: 実装ルール
- `environment-variables.md`: 環境変数ガイド
- `scripts-guide.md`: 運用スクリプトガイド
- `cdk-implementation.md`: CDK実装ガイド

---

## 備考

- テストコード内のハードコードは、テスト用の固定値として妥当な場合が多いため、優先度は低い
- 既に`get-stack-outputs.ps1`で環境情報の自動取得が実装されているため、運用スクリプトの改善は比較的容易
- AWSプロファイル名は開発者ごとに異なる可能性があるため、環境変数または設定ファイルでの管理を推奨
