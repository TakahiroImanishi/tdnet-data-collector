# デプロイ方式の比較

**作成日**: 2026-02-14  
**目的**: 単一スタックと分割スタックのデプロイ方式を比較し、適切な選択をサポート

---

## 概要

TDnet Data Collectorでは、2つのデプロイ方式を提供しています：

1. **単一スタックデプロイ** - 従来の方式
2. **分割スタックデプロイ** - 推奨方式（2026-02-14追加）

## 比較表

| 項目 | 単一スタック | 分割スタック（推奨） |
|------|------------|-------------------|
| **スタック数** | 1つ | 4つ（Foundation, Compute, API, Monitoring） |
| **初回デプロイ時間** | 15-20分 | 12-18分 |
| **更新デプロイ時間** | 15-20分 | 2-5分（変更箇所のみ） |
| **ロールバック時間** | 15-20分 | 2-5分（変更箇所のみ） |
| **ロールバック影響範囲** | 全リソース | 変更したスタックのみ |
| **並列開発** | 困難 | 容易 |
| **デプロイスクリプト** | `scripts/deploy.ps1` | `scripts/deploy-split-stacks.ps1` |
| **エントリーポイント** | `cdk/bin/tdnet-data-collector.ts` | `cdk/bin/tdnet-data-collector-split.ts` |

## 詳細比較

### 1. デプロイ時間

#### 単一スタック

```
全リソースを一度にデプロイ: 15-20分
├─ DynamoDB Tables: 3-4分
├─ S3 Buckets: 2-3分
├─ Lambda Functions: 5-7分
├─ API Gateway: 2-3分
└─ Monitoring: 3-4分
```

**問題点**:
- Lambda関数のみ変更しても全体で15-20分かかる
- API設定のみ変更しても全体で15-20分かかる

#### 分割スタック

```
初回デプロイ: 12-18分（依存関係順）
├─ Foundation Stack: 5-7分
├─ Compute Stack: 3-5分
├─ API Stack: 2-3分
└─ Monitoring Stack: 2-3分

更新デプロイ: 2-5分（変更箇所のみ）
├─ Lambda関数のみ変更 → Compute Stack: 3-5分
├─ API設定のみ変更 → API Stack: 2-3分
└─ 監視設定のみ変更 → Monitoring Stack: 2-3分
```

**利点**:
- 変更箇所のみデプロイで70-90%時間短縮
- 開発サイクルの高速化

### 2. ロールバック

#### 単一スタック

```powershell
# 全リソースをロールバック（15-20分）
aws cloudformation rollback-stack --stack-name TdnetDataCollectorStack-prod
```

**問題点**:
- Lambda関数の変更に問題があっても、全リソースがロールバックされる
- DynamoDB、S3、API Gatewayなど、問題のないリソースも影響を受ける

#### 分割スタック

```powershell
# 問題のあるスタックのみロールバック（2-5分）
aws cloudformation rollback-stack --stack-name TdnetCompute-prod
```

**利点**:
- 影響範囲を最小化
- 他のスタックは正常稼働を継続
- ロールバック時間を大幅短縮

### 3. 並列開発

#### 単一スタック

**制約**:
- 複数の開発者が同時に変更すると競合が発生
- デプロイ順序の調整が必要
- 1つの変更が全体に影響

**例**:
```
開発者A: Lambda関数を変更 → デプロイ待ち
開発者B: API設定を変更 → 開発者Aのデプロイ完了まで待機
```

#### 分割スタック

**利点**:
- 各スタックが独立しているため、並列作業が可能
- デプロイの競合が発生しにくい
- チーム間の調整コストが低い

**例**:
```
開発者A: Lambda関数を変更 → Compute Stackをデプロイ
開発者B: API設定を変更 → API Stackをデプロイ（並行実行可能）
```

### 4. コスト

#### 単一スタック

- CloudFormationスタック: 1つ（無料）
- デプロイ時間: 15-20分 × 月10回 = 150-200分/月

#### 分割スタック

- CloudFormationスタック: 4つ（無料）
- デプロイ時間: 2-5分 × 月10回 = 20-50分/月

**コスト削減**:
- デプロイ時間: 約75%削減
- 開発者の待ち時間: 約75%削減
- CI/CDパイプラインの実行時間: 約75%削減

### 5. 複雑性

#### 単一スタック

**シンプル**:
- 1つのスタックファイル
- 1つのエントリーポイント
- 依存関係管理が不要

**問題点**:
- スタックファイルが巨大（1426行）
- 変更の影響範囲が不明確
- デバッグが困難

#### 分割スタック

**構造化**:
- 4つのスタックファイル（各100-300行）
- 明確な責任分離
- 依存関係が明示的

**追加の複雑性**:
- スタック間の依存関係管理
- CloudFormation Exportsの使用
- デプロイスクリプトの複雑化

**対策**:
- 自動化スクリプト（`deploy-split-stacks.ps1`）で複雑性を隠蔽
- 詳細なドキュメント（`stack-split-design.md`）を提供

## 推奨事項

### 新規プロジェクト

**推奨**: 分割スタックデプロイ

**理由**:
- 初回デプロイ時間は単一スタックと同等
- 更新デプロイで大幅な時間短縮
- 将来的な拡張性が高い

### 既存プロジェクト（単一スタック使用中）

**推奨**: 段階的に分割スタックへ移行

**移行手順**:
1. 開発環境で分割スタックをテスト
2. 動作確認後、本番環境へ移行
3. 旧スタックを削除

**注意点**:
- データの移行は不要（同じリソースを参照）
- スタック名が変更されるため、CloudFormation Exportsを確認

### 小規模プロジェクト

**推奨**: 単一スタックでも可

**理由**:
- リソース数が少ない場合、デプロイ時間の差が小さい
- 複雑性の増加がデメリットになる可能性

**目安**:
- Lambda関数: 3個以下
- DynamoDBテーブル: 2個以下
- デプロイ頻度: 週1回以下

## 使用方法

### 単一スタックデプロイ

```powershell
# デプロイ
.\scripts\deploy.ps1 -Environment prod

# または手動
cd cdk
npx cdk deploy --context environment=prod
```

### 分割スタックデプロイ

```powershell
# 全スタックをデプロイ
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack all

# 個別スタックをデプロイ
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack compute

# 差分確認
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action diff -Stack all
```

## マイグレーション手順

### 単一スタック → 分割スタック

1. **バックアップ作成**
   ```powershell
   # DynamoDBテーブルのバックアップ
   aws dynamodb create-backup --table-name tdnet_disclosures_prod --backup-name migration-backup
   ```

2. **分割スタックのデプロイ**
   ```powershell
   .\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack all
   ```

3. **動作確認**
   - Lambda関数の実行確認
   - API疎通確認
   - データ整合性確認

4. **旧スタックの削除**
   ```powershell
   npx cdk destroy TdnetDataCollectorStack-prod
   ```

### 分割スタック → 単一スタック（ロールバック）

1. **分割スタックの削除**
   ```powershell
   .\scripts\deploy-split-stacks.ps1 -Environment prod -Action destroy -Stack all
   ```

2. **単一スタックのデプロイ**
   ```powershell
   .\scripts\deploy.ps1 -Environment prod
   ```

## トラブルシューティング

### 問題1: スタック間の依存関係エラー

**エラー**:
```
Export TdnetDisclosuresTableName-prod cannot be deleted as it is in use by TdnetCompute-prod
```

**解決策**:
```powershell
# 依存関係の逆順で削除
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action destroy -Stack all
```

### 問題2: CloudFormation Exportsの競合

**エラー**:
```
Export TdnetDisclosuresTableName-prod already exists
```

**解決策**:
- 既存のExportを削除してから再デプロイ
- または、Export名に環境サフィックスを追加

### 問題3: デプロイスクリプトが見つからない

**エラー**:
```
The term 'deploy-split-stacks.ps1' is not recognized
```

**解決策**:
```powershell
# プロジェクトルートに移動
cd C:\path\to\investment_analysis_opopo

# スクリプトを実行
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack all
```

## 関連ドキュメント

- [スタック分割設計](./stack-split-design.md) - 詳細な設計ドキュメント
- [本番環境デプロイチェックリスト](./production-deployment-checklist.md) - デプロイ手順
- [本番環境デプロイ手順書](./production-deployment-guide.md) - 詳細な手順書
- [ロールバック手順](./rollback-procedures.md) - ロールバック方法

---

**最終更新**: 2026-02-14  
**作成者**: Kiro AI Assistant
