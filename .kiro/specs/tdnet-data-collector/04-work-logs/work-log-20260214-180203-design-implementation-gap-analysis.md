# 作業記録: 設計と実装の差分チェック

**作業ID**: work-log-20260214-180203-design-implementation-gap-analysis  
**開始日時**: 2026-02-14 18:02:03  
**担当**: Kiro AI Assistant  
**関連タスク**: ユーザーリクエスト - 設計と実装の差分チェック

## 作業概要

設計ドキュメント（design.md、requirements.md）と実装コードの差分を確認し、設計意図と実装の乖離を特定する。

## 実施内容

### 1. ドキュメント確認

- [x] requirements.md 読み込み完了
- [x] design.md 読み込み完了（一部切り捨て、必要に応じて追加読み込み）
- [x] tasks.md 読み込み完了（一部切り捨て、必要に応じて追加読み込み）
- [x] stack-split-design.md 読み込み完了

### 2. 主要な差分の特定

#### 2.1 認証方式の変更（Critical）

**設計書（design.md）の記載:**
```
API Gateway: 使用量プランとAPIキー機能で認証
Lambda関数: 認証処理なし（API Gatewayで認証済み）

認証方式の変更履歴（2026-02-14）:
- 変更前: API Gateway + Lambda二重認証（両方でSecrets Manager使用）
- 変更後: API Gateway認証のみ（Lambda関数では認証処理なし）
- 理由: API GatewayとLambda関数で異なるAPIキーを使用していた（設計ミス）
- 理由: 二重認証は冗長であり、API Gateway認証のみで十分
- 理由: Secrets Managerの使用を削減してコスト最適化（$0.81/月 → $0.40/月）
```

**確認事項:**
- Lambda関数（Query、Export、Collect等）でSecrets Manager APIキー検証が削除されているか？
- API Gateway設定でAPIキー認証が正しく設定されているか？
- Secrets Manager使用量が削減されているか？

#### 2.2 スタック分割設計（Major）

**設計書（stack-split-design.md）の記載:**
```
単一の巨大なスタックを4つの独立したスタックに分割:
1. TdnetFoundation-{env} (基盤層)
2. TdnetCompute-{env} (コンピュート層)
3. TdnetApi-{env} (API層)
4. TdnetMonitoring-{env} (監視層)
```

**確認事項:**
- CDKコードが4つのスタックに分割されているか？
- スタック間の依存関係が正しく設定されているか？
- デプロイスクリプト（deploy-split-stacks.ps1）が存在するか？

#### 2.3 Lambda関数の数（Minor）

**設計書（design.md）の記載:**
```
注: 実装では7個のLambda関数が存在
1. Collector: データ収集（TDnetスクレイピング、PDF保存）
2. Query: データクエリ（DynamoDB検索、CSV/JSON変換）
3. Export: データエクスポート（大量データの非同期エクスポート）
4. Collect: 収集トリガー（POST /collect エンドポイント）
5. Collect Status: 収集状態取得（GET /collect/{execution_id} エンドポイント）
6. Export Status: エクスポート状態取得（GET /exports/{export_id} エンドポイント）
7. PDF Download: PDF署名付きURL生成（GET /disclosures/{disclosure_id}/pdf エンドポイント）
```

**確認事項:**
- 実装に7個のLambda関数が存在するか？
- 各Lambda関数の責務が設計書と一致しているか？

#### 2.4 DynamoDBテーブル構造（Minor）

**設計書（design.md）の記載:**
```
テーブル1: tdnet_disclosures（開示情報）
- GSI_DatePartition: パーティションキー=date_partition (YYYY-MM形式)
- 注意: 設計当初はYYYY-MM-DD形式を想定していたが、実装時にYYYY-MM形式に変更（クエリ効率向上のため）
```

**確認事項:**
- date_partitionがYYYY-MM形式で実装されているか？
- GSI_DatePartitionが正しく設定されているか？

#### 2.5 S3バケット構造（Minor）

**設計書（design.md）の記載:**
```
バケット1: tdnet-data-collector-pdfs-{account-id}（PDFファイル）
Object Lock設定:
- バケット全体で有効化（objectLockEnabled: true）
- pdfs/プレフィックス: GOVERNANCE mode、1年間保持
- temp/プレフィックス: Object Lock非適用
- exports/プレフィックス: Object Lock非適用
```

**確認事項:**
- Object Lock設定が実装されているか？
- ライフサイクルポリシーが設計書と一致しているか？

### 3. 実装コードの確認

次のステップで実装コードを確認します。



## 発見された差分

### 1. 認証方式の実装状況（Critical）

**結果: ✅ 設計と実装が一致**

Lambda関数（Query、Export、Collect）のコードを確認した結果：
- **Query Handler**: Secrets Manager APIキー検証コードは存在しない
- **Export Handler**: Secrets Manager APIキー検証コードは存在しない
- **Collect Handler**: Secrets Manager APIキー検証コードは存在しない

ただし、**テストコードには古い実装が残存**：
- `src/lambda/query/__tests__/handler.e2e.test.ts`: Secrets Managerモック使用
- `src/lambda/query/__tests__/date-range-validation.property.test.ts`: Secrets Managerモック使用
- `src/lambda/export/__tests__/handler.e2e.test.ts`: Secrets Managerモック使用
- `src/lambda/export/__tests__/handler.test.ts`: Secrets Managerモック使用
- `src/lambda/collect/__tests__/handler.test.ts`: Secrets Managerモック使用

**推奨アクション:**
- テストコードからSecrets Managerモックを削除
- API Gateway認証のみをテストするように修正

### 2. CDKスタック構造の確認

次のステップでCDKコードを確認します。



### 2. CDKスタック構造の確認

**結果: ✅ 設計と実装が一致**

CDKコードを確認した結果：
- **4つのスタックに分割済み**: Foundation、Compute、API、Monitoring
- **エントリーポイント**: `cdk/bin/tdnet-data-collector-split.ts`
- **スタック間の依存関係**: 正しく設定されている
  - Compute → Foundation
  - API → Compute
  - Monitoring → Compute

**確認済み:**
- ✅ TdnetFoundation-{env} (基盤層)
- ✅ TdnetCompute-{env} (コンピュート層)
- ✅ TdnetApi-{env} (API層)
- ✅ TdnetMonitoring-{env} (監視層)

### 3. Lambda関数の数の確認

次のステップでLambda関数の数を確認します。



### 3. Lambda関数の数の確認

**結果: ⚠️ 設計と実装に差異あり**

**設計書（design.md）の記載:**
```
注: 実装では7個のLambda関数が存在
1. Collector: データ収集
2. Query: データクエリ
3. Export: データエクスポート
4. Collect: 収集トリガー
5. Collect Status: 収集状態取得
6. Export Status: エクスポート状態取得
7. PDF Download: PDF署名付きURL生成
```

**実装（compute-stack.ts）:**
```
1. Collector Function
2. Query Function
3. Export Function
4. Collect Function
5. Collect Status Function
6. Export Status Function
7. PDF Download Function
8. Health Function ← 設計書に記載なし
9. Stats Function ← 設計書に記載なし
```

**差分:**
- 実装には9個のLambda関数が存在（設計書は7個）
- Health Function（ヘルスチェック）が追加されている
- Stats Function（統計情報取得）が追加されている

**推奨アクション:**
- 設計書（design.md）を更新して、Health FunctionとStats Functionを追加
- または、これらの関数が不要であれば削除を検討

### 4. DynamoDBテーブル構造の確認

次のステップでDynamoDBテーブル構造を確認します。



### 4. DynamoDBテーブル構造の確認

**結果: ⚠️ 設計と実装に差異あり**

**設計書（design.md）の記載:**
```
テーブル1: tdnet_disclosures（開示情報）
- GSI_CompanyCode_DiscloseDate
- GSI_DatePartition

テーブル2: tdnet_executions（実行状態）
- GSI_Status_StartedAt
```

**実装（foundation-stack.ts）:**
```
テーブル1: tdnet_disclosures
- ✅ GSI_CompanyCode_DiscloseDate
- ✅ GSI_DatePartition

テーブル2: tdnet_executions
- ✅ GSI_Status_StartedAt

テーブル3: tdnet_export_status ← 設計書に記載なし
- GSI_Status_RequestedAt
```

**差分:**
- 実装には3つのDynamoDBテーブルが存在（設計書は2つ）
- tdnet_export_status テーブルが追加されている
- エクスポート状態を別テーブルで管理している（設計書ではtdnet_executionsに統合）

**date_partition形式:**
- ✅ YYYY-MM形式で実装されている（設計書と一致）

**推奨アクション:**
- 設計書（design.md）を更新して、tdnet_export_statusテーブルを追加
- または、tdnet_executionsテーブルに統合することを検討

### 5. S3バケット構造の確認

次のステップでS3バケット構造を確認します。



### 5. S3バケット構造の確認

**結果: ⚠️ Object Lock設定が未実装**

**設計書（design.md）の記載:**
```
バケット1: tdnet-data-collector-pdfs-{account-id}
Object Lock設定:
- バケット全体で有効化（objectLockEnabled: true）
- pdfs/プレフィックス: GOVERNANCE mode、1年間保持
- temp/プレフィックス: Object Lock非適用
- exports/プレフィックス: Object Lock非適用

ライフサイクルポリシー:
- temp/: 1日経過後に自動削除
- exports/: 7日経過後に自動削除
- pdfs/: 90日経過後にS3 Standard-IA、365日経過後にGlacier
```

**実装（foundation-stack.ts）:**
```
バケット1: tdnet-data-collector-pdfs
- ✅ ライフサイクルポリシー: 90日後Standard-IA、365日後Glacier
- ❌ Object Lock設定: 未実装
- ❌ temp/プレフィックスの自動削除: 未実装
- ❌ exports/プレフィックスの自動削除: 未実装（別バケットに分離）

バケット2: tdnet-data-collector-exports
- ✅ ライフサイクルポリシー: 7日後に自動削除

バケット3: tdnet-dashboard
- ✅ 実装済み

バケット4: tdnet-cloudtrail-logs
- ✅ ライフサイクルポリシー: 90日後Glacier、2555日後削除
```

**差分:**
- Object Lock設定が未実装（設計書では有効化）
- temp/プレフィックスの自動削除が未実装
- エクスポートファイルは別バケットに分離（設計書では同一バケット）

**推奨アクション:**
- Object Lock設定を実装するか、設計書から削除
- temp/プレフィックスの自動削除を実装
- 設計書を更新して、エクスポートバケットの分離を反映

## 差分サマリー

### Critical（重要度: 高）

1. **テストコードのSecrets Manager依存削除**
   - 影響: テストコードが古い実装に依存
   - 対応: テストコードからSecrets Managerモックを削除

### Major（重要度: 中）

2. **Lambda関数の数の不一致**
   - 設計書: 7個
   - 実装: 9個（Health Function、Stats Function追加）
   - 対応: 設計書を更新

3. **DynamoDBテーブルの数の不一致**
   - 設計書: 2個
   - 実装: 3個（tdnet_export_status追加）
   - 対応: 設計書を更新

### Minor（重要度: 低）

4. **Object Lock設定の未実装**
   - 設計書: 有効化
   - 実装: 未実装
   - 対応: 実装するか設計書から削除

5. **temp/プレフィックスの自動削除未実装**
   - 設計書: 1日後削除
   - 実装: 未実装
   - 対応: 実装するか設計書から削除

## 推奨アクション

### 即座に実施（Critical）

1. テストコードからSecrets Managerモックを削除
   - 対象ファイル:
     - `src/lambda/query/__tests__/handler.e2e.test.ts`
     - `src/lambda/query/__tests__/date-range-validation.property.test.ts`
     - `src/lambda/export/__tests__/handler.e2e.test.ts`
     - `src/lambda/export/__tests__/handler.test.ts`
     - `src/lambda/collect/__tests__/handler.test.ts`

### Phase 4で実施（Major）

2. 設計書（design.md）を更新
   - Lambda関数の数を7個→9個に更新
   - Health Function、Stats Functionを追加
   - DynamoDBテーブルの数を2個→3個に更新
   - tdnet_export_statusテーブルを追加

### 検討事項（Minor）

3. Object Lock設定の実装可否を判断
   - 実装する場合: CDKコードを更新
   - 実装しない場合: 設計書から削除

4. temp/プレフィックスの自動削除の実装可否を判断
   - 実装する場合: ライフサイクルポリシーを追加
   - 実装しない場合: 設計書から削除



## 完了日時

2026-02-14 18:15:00

## 成果物

- 設計と実装の差分チェック完了
- 5つの主要な差分を特定
- 推奨アクションを3つの優先度に分類

## 申し送り事項

### 即座に実施すべき項目（Critical）

1. **テストコードのSecrets Manager依存削除**
   - 5つのテストファイルを更新
   - API Gateway認証のみをテストするように修正
   - 推定工数: 2-3時間

### Phase 4で実施すべき項目（Major）

2. **設計書（design.md）の更新**
   - Lambda関数の数を7個→9個に更新
   - DynamoDBテーブルの数を2個→3個に更新
   - 推定工数: 1-2時間

### 検討事項（Minor）

3. **Object Lock設定の実装可否判断**
   - 実装する場合: CDKコード更新（推定工数: 3-4時間）
   - 実装しない場合: 設計書から削除（推定工数: 30分）

4. **temp/プレフィックスの自動削除実装可否判断**
   - 実装する場合: ライフサイクルポリシー追加（推定工数: 1-2時間）
   - 実装しない場合: 設計書から削除（推定工数: 30分）

## 次のステップ

1. ユーザーに差分サマリーを報告
2. Critical項目の実施可否を確認
3. Major項目の実施タイミングを確認
4. Minor項目の実装可否を確認



## タスク追加完了

### 追加したタスク

**タスク31.7: 設計と実装の差分解消**

以下の4つのサブタスクを追加しました：

1. **31.7.1 テストコードのSecrets Manager依存削除（Critical）**
   - 優先度: 🔴 Critical
   - 推定工数: 2-3時間
   - 対象: 5つのテストファイル

2. **31.7.2 設計書の更新（Major）**
   - 優先度: 🟡 Medium
   - 推定工数: 2時間
   - 対象: design.md

3. **31.7.3 Object Lock設定の実装可否判断（Minor）**
   - 優先度: 🟢 Low
   - 推定工数: 30分〜4時間（選択肢による）

4. **31.7.4 temp/プレフィックス自動削除の実装可否判断（Minor）**
   - 優先度: 🟢 Low
   - 推定工数: 30分〜2時間（選択肢による）

### タスクの配置

- Phase 4の最後（タスク31.6の後）に追加
- Phase 5の前に配置
- 本番デプロイ後の改善タスクとして位置づけ

### 次のステップ

ユーザーに確認を求める：
1. Critical項目（31.7.1）を即座に実施するか？
2. Major項目（31.7.2）をいつ実施するか？
3. Minor項目（31.7.3、31.7.4）の実装可否を判断するか？

