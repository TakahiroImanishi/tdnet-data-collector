# TDnet Data Collector - レート制限実装設計書

**作成日:** 2026-02-07  
**バージョン:** 1.0  
**ステータス:** Draft

---

## 目次

1. [概要](#概要)
2. [Token Bucketアルゴリズムの実装](#token-bucketアルゴリズムの実装)
3. [Lambda Reserved Concurrency設定](#lambda-reserved-concurrency設定)
4. [DynamoDB分散ロックの実装](#dynamodb分散ロックの実装)
5. [テスト戦略](#テスト戦略)
6. [監視とアラート](#監視とアラート)
7. [関連ドキュメント](#関連ドキュメント)

---

## 概要

### レート制限の目的

TDnet Data Collectorは、日本取引所グループのTDnetウェブサイトから開示情報を自動収集します。適切なレート制限を実装することで、以下を実現します：

**主要な目的:**
- ✅ TDnetサーバーへの過度な負荷を防止
- ✅ サービス提供者への配慮とマナーの遵守
- ✅ アクセス制限やIP BAN のリスク回避
- ✅ 安定した長期的なデータ収集の実現

### TDnetサーバーへの配慮

**基本方針:**

- **リクエスト間隔**: 最低2秒（0.5リクエスト/秒）
- **同時実行数**: 1（並列リクエストなし）
- **User-Agent**: 適切な識別情報を含む
- **エラー時の対応**: 即座に再試行せず、指数バックオフを使用

### レート制限の3層アーキテクチャ

本設計では、3つの独立したレート制限メカニズムを組み合わせて、確実な制御を実現します：

| レイヤー | メカニズム | 目的 | 実装場所 |
|---------|-----------|------|---------|
| **Layer 1** | Token Bucket | リクエスト間隔の制御 | Lambda関数内 |
| **Layer 2** | Reserved Concurrency | 同時実行数の制限 | Lambda設定 |
| **Layer 3** | 分散ロック | 複数トリガーの排他制御 | DynamoDB |

**なぜ3層が必要か？**

1. **Token Bucket単体では不十分**: Lambda関数が複数同時実行されると、各インスタンスが独立してToken Bucketを持つため、全体のレート制限が効かない
2. **Reserved Concurrency単体では不十分**: EventBridgeとAPI Gatewayからの同時トリガーを防げない
3. **分散ロック単体では不十分**: リクエスト間隔の細かい制御ができない

**3層を組み合わせることで:**
- ✅ 確実に2秒間隔を維持
- ✅ 同時実行を完全に防止
- ✅ 複数トリガーソースからの競合を回避

---

## Token Bucketアルゴリズムの実装

### アルゴリズムの説明

Token Bucketは、レート制限の標準的なアルゴリズムです：

**動作原理:**

1. **バケツ（Bucket）**: トークンを保持する容器（容量: capacity）
2. **トークン（Token）**: リクエストを実行する権利
3. **補充（Refill）**: 一定レートでトークンが補充される（refillRate）
4. **消費（Consume）**: リクエスト時にトークンを1つ消費
5. **待機（Wait）**: トークンがない場合、補充されるまで待機

**視覚的な説明:**

```
時刻 0秒:  [●●●●●] (5トークン)
時刻 1秒:  [●●●●◐] (4.5トークン) - リクエスト1回実行、0.5トークン補充
時刻 2秒:  [●●●●●] (5トークン)   - 0.5トークン補充
時刻 3秒:  [●●●●◐] (4.5トークン) - リクエスト1回実行、0.5トークン補充
```

### 設定パラメータ

| パラメータ | 値 | 説明 |
|-----------|---|------|
| **capacity** | 5 | バケツの最大容量（トークン数） |
| **refillRate** | 0.5 | 補充レート（トークン/秒） |
| **初期トークン数** | 5 | 起動時のトークン数 |

**計算根拠:**
- リクエスト間隔2秒 = 0.5リクエスト/秒 = refillRate 0.5
- バースト許容: 最大5リクエストまで連続実行可能（その後は2秒間隔に制限される）

### 完全な実装コード

**ファイル:** `src/scraper/rate-limiter.ts`

```typescript
/**
 * Token Bucket アルゴリズムによるレート制限
 * 
 * @example
 * const rateLimiter = new TokenBucket(5, 0.5);
 * await rateLimiter.acquire(); // トークンを取得（必要に応じて待機）
 * await fetchTdnetData(); // リクエスト実行
 */
export class TokenBucket {
    private tokens: number;
    private lastRefill: number;
    private readonly capacity: number;
    private readonly refillRate: number;
    
    /**
     * Token Bucketを初期化
     * 
     * @param capacity - バケツの最大容量（トークン数）
     * @param refillRate - 補充レート（トークン/秒）
     */
