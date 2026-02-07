# データ整合性保証の詳細設計

**作成日時:** 2026-02-07  
**バージョン:** 1.0  
**ステータス:** Draft

---

## 目次

1. [概要](#概要)
2. [Two-Phase Commitパターンの実装](#two-phase-commitパターンの実装)
3. [整合性チェックバッチの実装](#整合性チェックバッチの実装)
4. [S3 Object Lock設定](#s3-object-lock設定)
5. [DynamoDB Transactionsの活用](#dynamodb-transactionsの活用)
6. [テスト戦略](#テスト戦略)
7. [監視とアラート](#監視とアラート)
8. [関連ドキュメント](#関連ドキュメント)

---

## 概要

### データ整合性の重要性

TDnet Data Collectorでは、開示情報のメタデータ（DynamoDB）とPDFファイル（S3）を別々のストレージに保存します。
この分散ストレージアーキテクチャでは、以下のような整合性の問題が発生する可能性があります：

**潜在的な問題:**
- メタデータは保存されたがPDFアップロードに失敗
- PDFはアップロードされたがメタデータ保存に失敗
- 部分的な失敗後のロールバック漏れ
- ネットワーク障害による不完全な状態

**影響:**
- ユーザーがメタデータを検索できるがPDFをダウンロードできない
- PDFは存在するが検索結果に表示されない
- ストレージコストの無駄（孤立したファイル）
- データの信頼性低下

### メタデータとPDFの対応関係

**データモデル:**

```typescript
interface Disclosure {
    // プライマリキー
    disclosure_id: string;           // 例: "20240115_7203_001"
    
    // メタデータ
    company_code: string;            // 企業コード（4桁）
    company_name: string;            // 企業名
    disclosure_type: string;         // 開示種類
    title: string;                   // タイトル
    disclosed_at: string;            // 開示日時（ISO8601）
    date_partition: string;          // 年月パーティション（YYYY-MM）
    
    // PDFファイル参照
    pdf_s3_key: string;              // S3オブジェクトキー
    pdf_size: number;                // ファイルサイズ（バイト）
    
    // 整合性管理
    status: 'pending' | 'committed' | 'failed';  // トランザクション状態
    temp_s3_key?: string;            // 一時S3キー（pending時のみ）
    
    // メタデータ
    created_at: string;              // 作成日時
    updated_at: string;              // 更新日時
}
```

**対応関係の保証:**
- `pdf_s3_key`が指すS3オブジェクトは必ず存在する
- S3に存在するPDFは必ずDynamoDBにメタデータが存在する
- `status='committed'`のレコードのみが完全な状態
- `status='pending'`のレコードは一時的な状態（要検証）
- `status='failed'`のレコードは失敗状態（要調査）

---

## Two-Phase Commitパターンの実装

### パターンの説明

Two-Phase Commit（2相コミット）は、分散トランザクションを実現するための古典的なパターンです。
TDnet Data Collectorでは、DynamoDBとS3という2つの独立したストレージ間でデータ整合性を保証するために使用します。

**フェーズ:**

1. **Phase 1: Prepare（準備フェーズ）**
   - PDFを一時キーでS3にアップロード
   - メタデータを`status='pending'`でDynamoDBに保存
   - 両方が成功したらPhase 2へ進む
   - いずれかが失敗したらロールバック

2. **Phase 2: Commit（コミットフェーズ）**
   - S3オブジェクトを一時キーから正式キーに移動
   - DynamoDBの`status`を`'committed'`に更新
   - 両方が成功したら完了
   - いずれかが失敗したらアラート送信

**利点:**
- 部分的な失敗を検出可能
- ロールバックが容易
- 整合性チェックバッチで自動修復可能
- 監視とアラートが容易
