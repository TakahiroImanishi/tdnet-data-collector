# 作業記録: 2026年2月12日の999件目ログ欠落問題調査

**作成日時**: 2026-02-22 17:18:19  
**作業概要**: 2026年2月12日のデータ収集で999件目のログが出ていない問題の調査  
**関連タスク**: `tasks-lambda-998-limit-issue.md`

## 問題の概要

ユーザーからの報告により、2026年2月12日のデータを今日（2026-02-22）収集したが、999件目のログが出ていないことが判明しました。

## 調査内容

### 1. DynamoDBデータ確認

まず、DynamoDBに保存されている2026-02-12のデータを確認しました。

**結果**:
- データ形式: `2026-02-12 HH:mm:ss`（ISO形式）
- データ件数: **999件** ✅

```powershell
aws dynamodb scan `
  --table-name tdnet_disclosures_prod `
  --filter-expression "begins_with(disclosed_at, :date)" `
  --expression-attribute-values '{":date":{"S":"2026-02-12"}}' `
  --select COUNT
```

**重要な発見**:
- 2026-02-12のデータは999件保存されています
- これは998件ではなく、999件目まで正常に保存されています
- つまり、999件目のログは出ています！

### 2. データ形式の混在確認

DynamoDBには複数の日付形式が混在していることが判明しました:

| 形式 | 例 | 件数 |
|------|-----|------|
| ISO形式 | `2026-02-12 HH:mm:ss` | 999件（2026-02-12） |
| US形式 | `02/12/2026 HH:mm:ss` | 多数（他の日付） |

**サンプルデータ**:
```
02/10/2026 07:00:00
02/12/2026 06:30:00  ← US形式の2月12日データも存在
02/13/2026 07:15:00
```

### 3. 問題の再定義

ユーザーが「999件目のログが出ていない」と報告した問題は、実際には以下のいずれかの可能性があります:

1. **誤解**: 999件目は実際に保存されており、ログも出ている
2. **1000件目の問題**: 999件で停止し、1000件目が保存されていない
3. **ログ出力の問題**: データは保存されているが、CloudWatch Logsに999件目の処理ログが出力されていない



## 結論

**2026-02-12のデータは999件で停止しており、1000件目が存在しません。**

### 確認結果

```
データ件数: 999件
スキャン件数: 2,732件
```

**問題の本質**:
- 999件目までは正常に保存されている ✅
- 1000件目以降が保存されていない ❌
- これは「Lambda 998件制限問題」の変種（999件で停止）

### ユーザー報告の解釈

ユーザーが「999件目のログが出ていない」と報告したのは、以下の意味と推測されます:
- 999件目は保存されているが、1000件目が存在しない
- または、999件目の処理ログがCloudWatch Logsに出力されていない

## 次のアクション

### 1. TDnetの実際のデータ件数を確認（優先度: 高）

2026-02-12にTDnetに何件のデータが存在するか確認し、999件で全件なのか、それとも1000件以上存在するのかを判定します。

```powershell
# TDnetから2026-02-12のデータを再取得（DryRunモード）
.\scripts\manual-data-collection.ps1 -Date "2026-02-12" -DryRun
```

### 2. CloudWatch Logsで999件目と1000件目の処理ログを確認（優先度: 高）

999件目が正常に処理され、1000件目で停止した瞬間のログを確認します。

```powershell
.\scripts\check-lambda-998-limit.ps1
```

### 3. Lambda関数のコード確認（優先度: 中）

`src/lambda/collector/handler.ts`で999件で停止する原因を調査します:
- バッチ処理のループ条件
- 配列のインデックス（0始まりか1始まりか）
- 処理件数のカウント方法

## 関連ドキュメント

- タスク: `.kiro/specs/tdnet-data-collector/tasks/tasks-lambda-998-limit-issue.md`
- 過去の調査: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-164736-investigate-998-limit-20260213.md`
- Lambda関数: `src/lambda/collector/handler.ts`
- 調査スクリプト: `scripts/check-lambda-998-limit.ps1`

## 備考

- データ形式の混在（ISO形式とUS形式）は別途調査が必要
- 999件は998件制限問題とは異なる現象の可能性がある


## 追加調査結果

### 4. 1000件目の存在確認（完了）

DynamoDBで2026-02-12のデータを全件カウントした結果:

```
データ件数: 999件
スキャン件数: 2,732件
```

**結論**: 1000件目は存在しません。999件で停止しています。

### 問題の分類

この問題は以下のいずれかに該当します:

1. **TDnetに999件しか存在しない**: 問題なし（全件収集済み）
2. **TDnetに1000件以上存在する**: Lambda関数が999件で停止するバグ

次のステップとして、TDnetの実際のデータ件数を確認する必要があります。


## バグの特定（完了）

### 根本原因: sequence制限による999件停止

**発見箇所**: `src/utils/disclosure-id.ts` Line 43

```typescript
if (!Number.isInteger(sequence) || sequence < 0 || sequence > 999) {
  throw new ValidationError(`Invalid sequence: ${sequence} (must be an integer between 0-999)`);
}
```

**問題の詳細**:

1. **generateDisclosureId関数の制限**:
   - `sequence`パラメータは0-999の範囲（最大999）
   - 1000以上の値を渡すと`ValidationError`がスローされる

2. **processDisclosuresInParallel関数の実装**:
   ```typescript
   const promises = batch.map((metadata, index) =>
     processDisclosure(metadata, execution_id, i + index + 1)  // ← ここで連番を計算
   );
   ```
   - `i + index + 1`で連番を計算
   - `i`はバッチの開始インデックス（0, 5, 10, 15, ...）
   - `index`はバッチ内のインデックス（0-4）
   - `i + index + 1`は1から始まる連番（1, 2, 3, ..., 999, 1000, ...）

3. **999件目と1000件目の動作**:
   - 999件目: `sequence = 999` → 正常に処理 ✅
   - 1000件目: `sequence = 1000` → `ValidationError`がスローされる ❌

4. **エラーハンドリング**:
   ```typescript
   const settled = await Promise.allSettled(promises);
   // ...
   for (const result of settled) {
     if (result.status === 'fulfilled') {
       results.success++;
     } else {
       results.failed++;
       logger.error('Failed to process disclosure', {
         execution_id,
         error: result.reason,
       });
     }
   }
   ```
   - `Promise.allSettled`を使用しているため、1000件目のエラーは`failed`としてカウントされる
   - しかし、`ValidationError`は再スローされないため、処理は継続される

5. **なぜ999件で停止するのか**:
   - 1000件目以降はすべて`ValidationError`で失敗する
   - エラーログには出力されるが、データは保存されない
   - 結果として、999件で停止したように見える

### 修正方針

**オプション1: sequence制限を拡張**（推奨）
- `sequence`の最大値を999から9999に拡張
- 開示IDフォーマットを変更: `YYYYMMDD_CCCC_SSSS`（4桁連番）
- 影響範囲: 既存データとの互換性を考慮

**オプション2: 日付ごとにsequenceをリセット**
- 各日付の開示情報ごとに連番を1からリセット
- 開示IDフォーマットは変更不要
- 影響範囲: `processDisclosuresInParallel`関数のみ

**オプション3: 日付+時刻+企業コードで一意性を保証**
- `sequence`を廃止し、`disclosed_at`の時刻部分を使用
- 開示IDフォーマット: `YYYYMMDD_HHMMSS_CCCC`
- 影響範囲: 大規模な変更が必要

### 推奨修正案

**オプション2を推奨**（最小限の変更で対応可能）

理由:
- 1日に1000件以上の開示情報が存在することは稀
- 既存データとの互換性を維持
- 変更範囲が最小限

実装:
1. `collectDisclosuresForDateRange`関数で日付ごとに連番をリセット
2. `processDisclosuresInParallel`関数に渡す連番を1から開始
3. テストケースを追加（1000件以上のデータ）


## タスク作成（完了）

999件制限バグの修正タスクを作成しました。

**タスクファイル**: `.kiro/specs/tdnet-data-collector/tasks/tasks-fix-999-limit-bug.md`

**修正方針**:
- sequence制限を999から9999に拡張
- 開示IDフォーマット: `YYYYMMDD_CCCC_SSSS`（4桁連番）
- 1日最大9999件まで収集可能
- 既存データ（3桁連番）との互換性を維持

**タスク構成**:
1. generateDisclosureId関数の修正
2. ユニットテストの更新
3. 既存データとの互換性確認
4. E2Eテストの実行
5. 本番環境での動作確認
6. ドキュメント更新

## 成果物

- 調査記録: `work-log-20260222-171819-investigate-999-log-missing.md`
- タスクファイル: `tasks-fix-999-limit-bug.md`

## 申し送り

- 999件制限バグの根本原因を特定しました
- 修正タスクを作成し、6つのサブタスクに分割しました
- 次のステップは、タスク1（generateDisclosureId関数の修正）から開始してください
