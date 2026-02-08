# アーキテクチャ設計書と実装の差分レポート

**作成日時**: 2026-02-08 15:44:59  
**レビュー対象**: CDK実装 vs 設計書  
**関連作業記録**: `work-log-20260208-154459-architecture-design-review.md`

---

## エグゼクティブサマリー

CDK実装と設計書の間に7つの差分を発見しました。うち5つは重大な差分で、設計書の更新が必要です。

---

## 重大な差分 (Critical)

### 1. 設計書のファイルパスが不正確

**問題:**
- タスク指示: `.kiro/specs/tdnet-data-collector/design/architecture.md`
- 実際の場所: `.kiro/specs/tdnet-data-collector/docs/design.md`
- `design/`ディレクトリは存在しない

**影響:** タスク指示が不正確で、設計書を見つけられない

**推奨アクション:** タスク指示のパスを修正

---

### 2. DynamoDB GSIの命名不一致

**設計書:**
```typescript
GSI_DateRange
  - パーティションキー: date_partition (YYYY-MM-DD形式)
  - ソートキー: disclosed_at
```

**実装:**
```typescript
GSI_DatePartition
  - パーティションキー: date_partition
  - ソートキー: disclosed_at
```

**影響:** 
- 命名のみの差異、機能は同じ
- 設計書を参照してクエリを実装する際に混乱を招く

**推奨アクション:** 設計書を実装に合わせて`GSI_DatePartition`に修正

---

### 3. Lambda関数の数が不一致

**設計書:** 3個のLambda関数
1. Collector
2. Query
3. Export

**実装:** 7個のLambda関数
1. `tdnet-collector` - データ収集 (15分, 512MB)
2. `tdnet-query` - データクエリ (30秒, 256MB)
3. `tdnet-export` - データエクスポート (5分, 512MB)
4. `tdnet-collect` - 収集トリガー (30秒, 256MB)
5. `tdnet-collect-status` - 収集状態取得 (30秒, 256MB)
6. `tdnet-export-status` - エクスポート状態取得 (30秒, 256MB)
7. `tdnet-pdf-download` - PDF署名付きURL生成 (30秒, 256MB)

**影響:** 
- 設計書が実装の全体像を反映していない
- API設計の詳細化により追加された関数が記載されていない

**推奨アクション:** 設計書に7個すべてのLambda関数を記載

---

### 4. API Keyの環境変数設定方法の不一致 (セキュリティ)

**設計書の推奨:**
```typescript
API_KEY_SECRET_ARN: apiKeyValue.secretArn  // ARNのみを環境変数に設定
```

**実装の不一致:**

✅ **正しい実装 (queryFunction, exportFunction):**
```typescript
environment: {
  API_KEY_SECRET_ARN: apiKeyValue.secretArn,  // ARNのみ
}
```

❌ **セキュリティリスクのある実装 (exportStatusFunction, pdfDownloadFunction):**
```typescript
environment: {
  API_KEY: apiKeyValue.secretValue.unsafeUnwrap(),  // 値を直接展開
}
```

**影響:** 
- **セキュリティベストプラクティス違反**
- 環境変数にAPIキーの値を直接設定すると、CloudWatch Logsやコンソールで露出するリスクがある
- Secrets Managerを使用する意味が薄れる

**推奨アクション:** 
1. すべてのLambda関数で`API_KEY_SECRET_ARN`を使用するよう実装を修正
2. 設計書にセキュリティベストプラクティスを明記

---

### 5. date_partitionの形式が不明確

**設計書の記述:**
```typescript
date_partition: String (YYYY-MM-DD形式)  // 日単位でパーティション分割
```

**実装のコメント:**
```typescript
// GSI: DatePartition - 月単位の効率的なクエリ（YYYY-MM形式）
```

**影響:** 
- 設計書と実装コメントで形式が異なる
- 実際のデータモデルでは`YYYY-MM`形式を使用している可能性が高い
- クエリ実装時に混乱を招く

**推奨アクション:** 
1. 実際のデータモデルを確認
2. 設計書を正しい形式に統一（おそらく`YYYY-MM`形式）

---

## 軽微な差異 (Minor)

### 6. CloudFormation Outputsの詳細度

**設計書:** 簡略化された記載

**実装:** 詳細なOutputsが定義されている
- テーブル名、バケット名、関数名、ARN、エンドポイントURLなど

**影響:** 設計書が実装の詳細を反映していない

**推奨アクション:** 設計書にOutputsの一覧を追加

---

### 7. IAM権限の詳細度

**設計書:** 簡略化された記載

**実装:** CloudWatch PutMetricData権限が明示的に付与されている

**影響:** 設計書が実装の詳細を反映していない

**推奨アクション:** 設計書にIAM権限の詳細を追加

---

## API Gatewayエンドポイントの完全なリスト

**実装されているエンドポイント:**

1. `GET /disclosures` → queryFunction
   - 開示情報のクエリ（最大100件）
   
2. `POST /exports` → exportFunction
   - 大量データの非同期エクスポート
   
3. `GET /exports/{export_id}` → exportStatusFunction
   - エクスポート状態の取得
   
4. `POST /collect` → collectFunction
   - オンデマンドデータ収集
   
5. `GET /collect/{execution_id}` → collectStatusFunction
   - 収集実行状態の取得
   
6. `GET /disclosures/{disclosure_id}/pdf` → pdfDownloadFunction
   - PDFファイルの署名付きURL取得

---

## 推奨される設計書の更新内容

### 優先度: High

1. **Lambda関数リストの更新**
   - 7個すべての関数を記載
   - 各関数の役割、タイムアウト、メモリサイズを明記

2. **API Keyのセキュリティベストプラクティスを明記**
   - すべての関数で`API_KEY_SECRET_ARN`を使用
   - `unsafeUnwrap()`の使用を避ける理由を説明

3. **date_partitionの形式を明確化**
   - 実際の形式（YYYY-MMまたはYYYY-MM-DD）を確認して統一

### 優先度: Medium

4. **DynamoDB GSI名の修正**
   - `GSI_DateRange` → `GSI_DatePartition`

5. **API Gatewayエンドポイントの完全なリスト**
   - 6個すべてのエンドポイントを記載

### 優先度: Low

6. **CloudFormation Outputsの追加**
   - 実装されているOutputsを設計書に反映

7. **IAM権限の詳細を追加**
   - CloudWatch PutMetricData権限などを明記

---

## 次のステップ

1. ✅ 差分レポートを作成（このファイル）
2. ⏳ 設計書を更新
3. ⏳ セキュリティリスクのある実装を修正（API Key環境変数）
4. ⏳ date_partitionの実際の形式を確認
5. ⏳ 作業記録を完成させてコミット

---

## 参考資料

- **CDK実装**: `cdk/lib/tdnet-data-collector-stack.ts` (1193行)
- **設計書**: `.kiro/specs/tdnet-data-collector/docs/design.md` (3106行)
- **作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260208-154459-architecture-design-review.md`
