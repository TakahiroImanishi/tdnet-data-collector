# docsフォルダ重複コンテンツ分析

**作業日時**: 2026-02-15 09:32:28  
**タスク**: docsフォルダの構造分析タスク1 - 重複コンテンツの検出  
**ステータス**: 完了

---

## 実行内容

.kiro/specs/tdnet-data-collector/docs/ 配下の全マークダウンファイル（約30ファイル）を読み取り、重複・類似コンテンツを分析しました。

---

## 重複コンテンツの検出結果

### 🔴 Critical: 深刻な重複（統合必須）

#### 1. アーキテクチャ設計の重複

**重複ファイル**:
- `01-requirements/architecture.md` (約3,500語)
- `01-requirements/design.md` の「Architecture」セクション (約2,000語)

**重複内容**:
- システム構成図（Mermaid図）
- Lambda関数一覧
- DynamoDBテーブル設計
- S3バケット設計
- スタック分割設計
- セキュリティ設計

**推奨アクション**: `architecture.md`を削除し、`design.md`に統合（既に統合済み）

---

#### 2. CDKインフラストラクチャの重複

**重複ファイル**:
- `02-implementation/cdk-infrastructure.md` (約8,000語)
- `01-requirements/architecture.md` のスタック構成セクション (約1,500語)

**重複内容**:
- 4層スタック構成の詳細説明
- Foundation/Compute/API/Monitoring Stackの内容
- Lambda関数設定（タイムアウト、メモリ）
- DynamoDBテーブル定義
- S3バケット設定

**推奨アクション**: `architecture.md`のスタック構成セクションを削除し、`cdk-infrastructure.md`への参照に置き換え

---

#### 3. デプロイ手順の重複

**重複ファイル**:
- `04-deployment/deployment-guide.md` (約4,000語)
- `04-deployment/environment-setup.md` の「環境構築手順」セクション (約1,500語)
- `04-deployment/ci-cd-guide.md` の「デプロイフロー」セクション (約1,000語)

**重複内容**:
- CDK Bootstrap手順
- CDK Synth/Diff/Deploy コマンド
- 環境変数設定
- デプロイ後の動作確認

**推奨アクション**: 
- `deployment-guide.md`: 高レベルのデプロイフロー（手動デプロイ）
- `environment-setup.md`: 環境変数とAWS設定のみ
- `ci-cd-guide.md`: CI/CDパイプライン（自動デプロイ）

---

#### 4. 監視設定の重複

**重複ファイル**:
- `05-operations/monitoring-guide.md` (約5,000語)
- `02-implementation/cdk-infrastructure.md` の「Monitoring Stack」セクション (約1,500語)

**重複内容**:
- CloudWatchメトリクス一覧
- CloudWatch Alarms設定
- CloudWatch Dashboard設定
- カスタムメトリクス送信方法

**推奨アクション**: `cdk-infrastructure.md`の監視セクションを簡略化し、`monitoring-guide.md`への参照に置き換え

---

### 🟡 Medium: 部分的な重複（要検討）

#### 5. エラーハンドリングの重複

**重複ファイル**:
- `01-requirements/error-recovery-strategy.md` (約3,500語)
- `01-requirements/design.md` の「Error Handling」セクション (約800語)
- `02-implementation/lambda-error-logging.md` (約2,500語)

**重複内容**:
- エラー分類（Retryable/Non-Retryable）
- 再試行戦略（指数バックオフ）
- DLQ設計
- 構造化ログフォーマット

**推奨アクション**:
- `error-recovery-strategy.md`: 戦略レベル（高レベル設計）
- `lambda-error-logging.md`: 実装レベル（コード例）
- `design.md`: 概要のみ（詳細は他ファイルへの参照）

---

#### 6. データ整合性設計の重複

**重複ファイル**:
- `01-requirements/data-integrity-design.md` (約4,000語)
- `01-requirements/design.md` の「Data Integrity」セクション (約500語)

**重複内容**:
- Two-Phase Commitパターン
- 整合性チェックバッチ
- S3 Object Lock設定

**推奨アクション**: `design.md`の整合性セクションを簡略化し、`data-integrity-design.md`への参照に置き換え

---

#### 7. レート制限設計の重複

**重複ファイル**:
- `01-requirements/rate-limiting-design.md` (約3,500語)
- `01-requirements/design.md` の「Rate Limiting」セクション (約400語)

**重複内容**:
- Token Bucketアルゴリズム
- Lambda Reserved Concurrency設定
- レート制限の2層アーキテクチャ

**推奨アクション**: `design.md`のレート制限セクションを簡略化し、`rate-limiting-design.md`への参照に置き換え

---

#### 8. 環境変数設定の重複

**重複ファイル**:
- `04-deployment/environment-setup.md` (約5,000語)
- `02-implementation/cdk-infrastructure.md` の「環境設定」セクション (約1,000語)

**重複内容**:
- .env.development / .env.production の内容
- 環境変数一覧
- Lambda環境設定比較表

**推奨アクション**: `cdk-infrastructure.md`の環境設定セクションを削除し、`environment-setup.md`への参照に置き換え

---

### 🟢 Low: 軽微な重複（現状維持可）

#### 9. テスト戦略の軽微な重複

**重複ファイル**:
- `01-requirements/design.md` の「Testing Strategy」セクション (約500語)
- `02-implementation/implementation-checklist.md` の「テスト戦略の確認」セクション (約100語)

**重複内容**:
- テストレベル（ユニット/統合/E2E）
- カバレッジ目標（80%）

**推奨アクション**: 現状維持（軽微な重複のため）

---

#### 10. API設計の軽微な重複

**重複ファイル**:
- `01-requirements/api-design.md` (約2,500語)
- `01-requirements/design.md` の「API Design」セクション (約300語)

**重複内容**:
- エンドポイント一覧
- 認証方式（APIキー）

**推奨アクション**: 現状維持（`design.md`は概要のみ、`api-design.md`は詳細）

---

## 統合・削除の推奨事項

### 優先度1: 即座に実施（Critical）

1. **architecture.md を削除**
   - 理由: `design.md`に完全に統合済み
   - アクション: ファイル削除、他ファイルからの参照を`design.md`に変更

2. **cdk-infrastructure.md の監視セクションを簡略化**
   - 理由: `monitoring-guide.md`と重複
   - アクション: 監視セクションを削除し、`monitoring-guide.md`への参照に置き換え

3. **deployment-guide.md, environment-setup.md, ci-cd-guide.md の役割を明確化**
   - 理由: デプロイ手順が3ファイルに分散
   - アクション: 各ファイルの役割を明確にし、重複セクションを削除

---

### 優先度2: 検討後に実施（Medium）

4. **design.md の詳細セクションを簡略化**
   - 対象: Error Handling, Data Integrity, Rate Limiting
   - アクション: 概要のみ残し、詳細ドキュメントへの参照に置き換え

5. **cdk-infrastructure.md の環境設定セクションを削除**
   - 理由: `environment-setup.md`と重複
   - アクション: 環境設定セクションを削除し、`environment-setup.md`への参照に置き換え

---

### 優先度3: 現状維持（Low）

6. **軽微な重複は現状維持**
   - 理由: ドキュメントの独立性と可読性を優先
   - 対象: テスト戦略、API設計の概要

---

## 重複コンテンツの定量分析

### 重複語数の推定

| ファイル | 総語数 | 重複語数 | 重複率 |
|---------|--------|---------|--------|
| architecture.md | 3,500 | 3,000 | 86% |
| cdk-infrastructure.md | 8,000 | 2,500 | 31% |
| deployment-guide.md | 4,000 | 1,500 | 38% |
| monitoring-guide.md | 5,000 | 1,000 | 20% |
| error-recovery-strategy.md | 3,500 | 800 | 23% |
| data-integrity-design.md | 4,000 | 500 | 13% |
| rate-limiting-design.md | 3,500 | 400 | 11% |
| environment-setup.md | 5,000 | 1,000 | 20% |
| **合計** | **36,500** | **10,700** | **29%** |

**削減可能な語数**: 約10,700語（全体の29%）

---

## 次のステップ

### タスク2: ドキュメント構造の最適化

以下の観点でドキュメント構造を最適化します：

1. **階層構造の見直し**
   - 01-requirements/ の役割（要件 vs 設計）
   - 02-implementation/ の役割（実装ガイド vs CDK設定）
   - 04-deployment/ の役割（手動 vs 自動デプロイ）

2. **ファイル命名規則の統一**
   - `-guide.md` vs `-design.md` vs `-strategy.md` の使い分け

3. **相互参照の整理**
   - 重複を避けるための適切な参照構造

---

## 申し送り事項

### 重複削減の優先順位

1. **最優先**: `architecture.md`の削除（86%重複）
2. **高優先**: `cdk-infrastructure.md`の監視セクション簡略化（31%重複）
3. **中優先**: デプロイ関連3ファイルの役割明確化（38%重複）
4. **低優先**: `design.md`の詳細セクション簡略化（軽微な重複）

### 注意事項

- **削除前に必ず他ファイルからの参照を確認**すること
- **削除後は相互参照リンクを更新**すること
- **README.mdの「ドキュメント読み順」を更新**すること

---

**作業完了時刻**: 2026-02-15 09:45:00  
**次のタスク**: タスク2 - ドキュメント構造の最適化
