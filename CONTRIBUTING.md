# コントリビューションガイド

TDnet Data Collectorへのコントリビューションをご検討いただき、ありがとうございます。このドキュメントでは、プロジェクトへの貢献方法について説明します。

## 目次

- [開発環境のセットアップ](#開発環境のセットアップ)
- [コーディング規約](#コーディング規約)
- [テスト要件](#テスト要件)
- [プルリクエストプロセス](#プルリクエストプロセス)
- [コミットメッセージ規約](#コミットメッセージ規約)
- [ドキュメント作成](#ドキュメント作成)

---

## 開発環境のセットアップ

### 前提条件

- **Node.js**: 20.x以上
- **npm**: 10.x以上
- **AWS CLI**: 設定済み（`aws configure`）
- **Docker Desktop**: E2Eテスト用（LocalStack）
- **Git**: バージョン管理

### セットアップ手順

```bash
# リポジトリをクローン
git clone https://github.com/your-org/tdnet-data-collector.git
cd tdnet-data-collector

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して必要な環境変数を設定

# TypeScriptのビルド
npm run build

# テストを実行して環境を確認
npm test
```

---

## コーディング規約

このプロジェクトは、[.kiro/steering/core/tdnet-implementation-rules.md](.kiro/steering/core/tdnet-implementation-rules.md)に定義された実装ルールに従います。

### 基本原則

#### 1. 言語設定
- **コード内コメント**: 日本語
- **ドキュメント**: 日本語
- **エラーメッセージ**: 日本語
- **変数名・関数名**: 英語（TypeScript標準）

#### 2. TypeScript
- **厳格な型定義**: `strict: true`を使用
- **型推論の活用**: 明示的な型注釈は必要な場合のみ
- **any型の禁止**: `unknown`または適切な型を使用

#### 3. エラーハンドリング
- **カスタムエラークラス**: `src/errors/index.ts`を使用
- **再試行ロジック**: `retryWithBackoff`を使用（最大3回、指数バックオフ）
- **構造化ログ**: `logger.error()`で`error_type`, `error_message`, `context`, `stack_trace`を記録

```typescript
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

try {
  await retryWithBackoff(async () => await operation(), {
    maxRetries: 3,
    initialDelay: 2000,
    backoffMultiplier: 2,
    jitter: true
  });
} catch (error) {
  logger.error('Operation failed', {
    error_type: 'NetworkError',
    error_message: error.message,
    context: { disclosure_id: 'TD20240115001' },
    stack_trace: error.stack
  });
  throw error;
}
```

#### 4. レート制限
- **TDnet**: 1リクエスト/秒（`RateLimiter`使用）
- **並列実行**: 最大5並列

```typescript
import { RateLimiter } from '../utils/rate-limiter';

const rateLimiter = new RateLimiter({ minDelayMs: 1000 });
await rateLimiter.waitIfNeeded();
```

#### 5. データバリデーション
- **Zod**: スキーマバリデーションに使用
- **必須フィールド**: すべて検証
- **date_partition**: YYYY-MM形式、JST基準

### コードフォーマット

```bash
# ESLintでコードチェック
npm run lint

# ESLintで自動修正
npm run lint:fix

# Prettierでフォーマット
npm run format
```

### ファイル命名規則

詳細は [.kiro/steering/development/tdnet-file-naming.md](.kiro/steering/development/tdnet-file-naming.md) を参照してください。

- **ケバブケース**: `disclosure-validator.ts`
- **テストファイル**: `disclosure-validator.test.ts`
- **型定義**: `src/types/index.ts`
- **ユーティリティ**: `src/utils/`

---

## テスト要件

このプロジェクトは、[.kiro/steering/development/testing-strategy.md](.kiro/steering/development/testing-strategy.md)に定義されたテスト戦略に従います。

### テストカバレッジ目標

すべてのコードメトリクスで**80%以上**のカバレッジを維持する必要があります:

- **Statements**: 80%以上
- **Branches**: 80%以上
- **Functions**: 80%以上
- **Lines**: 80%以上

### テストの種類

#### 1. ユニットテスト（70%）
- 個別の関数・クラスのテスト
- モック・スタブを使用
- 高速実行（<1秒）

```typescript
// src/utils/__tests__/disclosure-id.test.ts
describe('generateDisclosureId', () => {
  it('正しい形式のIDを生成する', () => {
    const result = generateDisclosureId('2024-01-15T10:30:00Z', '7203', 1);
    expect(result).toBe('20240115_7203_001');
  });
});
```

#### 2. 統合テスト（20%）
- コンポーネント間の連携テスト
- 実際のAWSサービス（LocalStack）を使用
- E2Eテストを含む

```bash
# LocalStack環境を起動
docker compose up -d

# E2Eテストを実行
npm run test:e2e
```

#### 3. プロパティベーステスト（10%）
- fast-checkを使用
- ランダム入力による網羅的テスト
- 重要な関数に適用

```typescript
import fc from 'fast-check';

it('任意の日時でdate_partitionが正しい形式を返す', () => {
  fc.assert(
    fc.property(fc.date(), (date) => {
      const result = generateDatePartition(date.toISOString());
      expect(result).toMatch(/^\d{4}-\d{2}$/);
    }),
    { numRuns: 100 }
  );
});
```

### テスト実行

```bash
# すべてのテストを実行
npm test

# カバレッジレポート生成
npm run test:coverage

# 特定のテストのみ実行
npm test -- unit
npm test -- integration
npm test -- property
```

---

## プルリクエストプロセス

### 1. ブランチ作成

```bash
# 最新のmainブランチを取得
git checkout main
git pull origin main

# 新しいブランチを作成
git checkout -b feature/your-feature-name
```

### 2. 変更の実装

- コーディング規約に従う
- テストを追加（カバレッジ80%以上）
- ドキュメントを更新

### 3. コミット

```bash
# ステージング
git add .

# コミット（コミットメッセージ規約に従う）
git commit -m "[feat] 新機能の説明"
```

### 4. プッシュ

```bash
git push origin feature/your-feature-name
```

### 5. プルリクエスト作成

GitHubでプルリクエストを作成し、以下を含めてください:

- **タイトル**: `[feat/fix/docs/refactor/test/chore] 変更内容`
- **説明**: 変更の目的と内容
- **関連Issue**: `Closes #123`
- **テスト結果**: カバレッジレポート
- **スクリーンショット**: UI変更の場合

### 6. レビュー対応

- レビュアーのフィードバックに対応
- 必要に応じて追加コミット
- すべてのCIチェックが成功することを確認

### 7. マージ

- レビュー承認後、メンテナーがマージ
- マージ後、ブランチは削除

---

## コミットメッセージ規約

### フォーマット

```
[type] 変更内容の簡潔な説明

詳細な説明（オプション）

Closes #123
```

### タイプ

| タイプ | 説明 | 例 |
|--------|------|-----|
| `feat` | 新機能 | `[feat] PDFダウンロード機能を追加` |
| `fix` | バグ修正 | `[fix] date_partition生成のタイムゾーンバグを修正` |
| `docs` | ドキュメント | `[docs] README.mdにセットアップ手順を追加` |
| `refactor` | リファクタリング | `[refactor] エラーハンドリングを統一` |
| `test` | テスト追加・修正 | `[test] RateLimiterのプロパティテストを追加` |
| `chore` | ビルド・設定変更 | `[chore] ESLint設定を更新` |
| `improve` | 改善 | `[improve] ログ出力を詳細化` |

### 例

```bash
# 新機能
git commit -m "[feat] Lambda Collector関数を実装"

# バグ修正
git commit -m "[fix] DynamoDB書き込みエラーを修正

disclosure_idの重複チェックを追加し、ConditionalCheckFailedExceptionを適切にハンドリング

Closes #45"

# ドキュメント
git commit -m "[docs] CONTRIBUTING.mdを作成"
```

---

## ドキュメント作成

### ドキュメント標準

詳細は [.kiro/steering/development/documentation-standards.md](.kiro/steering/development/documentation-standards.md) を参照してください。

### ドキュメントの種類

#### 1. コード内ドキュメント

```typescript
/**
 * 開示IDを生成する
 * 
 * @param disclosedAt - 開示日時（ISO 8601形式）
 * @param companyCode - 企業コード（4桁）
 * @param sequence - 連番（1から開始）
 * @returns 開示ID（例: 20240115_7203_001）
 * @throws {ValidationError} 不正な入力の場合
 */
export function generateDisclosureId(
  disclosedAt: string,
  companyCode: string,
  sequence: number
): string {
  // 実装
}
```

#### 2. README.md

- プロジェクト概要
- セットアップ手順
- 使用方法
- トラブルシューティング

#### 3. アーキテクチャドキュメント

- `docs/architecture/` - システムアーキテクチャ
- データフロー図
- コンポーネント構成

#### 4. 実装ガイド

- `docs/guides/` - 実装ガイド
- ベストプラクティス
- コード例

#### 5. Steeringファイル

- `.kiro/steering/` - 実装ガイドライン
- 自動読み込み（fileMatchPattern）
- プロジェクト固有のルール

### ドキュメント更新のタイミング

- **新機能追加時**: README.md、アーキテクチャドキュメントを更新
- **API変更時**: API設計ガイドラインを更新
- **バグ修正時**: トラブルシューティングセクションを更新
- **設定変更時**: 環境変数ガイドを更新

---

## 質問・サポート

### Issue作成

バグ報告や機能リクエストは、GitHubのIssueで作成してください。

**バグ報告テンプレート:**
```markdown
## バグの説明
簡潔にバグを説明してください。

## 再現手順
1. '...'に移動
2. '...'をクリック
3. '...'までスクロール
4. エラーを確認

## 期待される動作
何が起こるべきかを説明してください。

## 実際の動作
実際に何が起こったかを説明してください。

## 環境
- OS: [例: Windows 11]
- Node.js: [例: 20.10.0]
- npm: [例: 10.2.3]

## スクリーンショット
該当する場合、スクリーンショットを追加してください。
```

**機能リクエストテンプレート:**
```markdown
## 機能の説明
提案する機能を簡潔に説明してください。

## 動機
なぜこの機能が必要かを説明してください。

## 提案する解決策
どのように実装すべきかを説明してください。

## 代替案
検討した代替案があれば説明してください。
```

### ディスカッション

一般的な質問や議論は、GitHubのDiscussionsを使用してください。

---

## ライセンス

このプロジェクトに貢献することで、あなたの貢献がMITライセンスの下でライセンスされることに同意したものとみなされます。

---

## 参考リンク

- [README.md](README.md) - プロジェクト概要
- [実装ルール](.kiro/steering/core/tdnet-implementation-rules.md) - 基本的な実装原則
- [テスト戦略](.kiro/steering/development/testing-strategy.md) - テストガイドライン
- [エラーハンドリングパターン](.kiro/steering/core/error-handling-patterns.md) - エラー処理のベストプラクティス
- [タスクリスト](.kiro/specs/tdnet-data-collector/tasks.md) - 開発タスクと進捗

---

**ご協力ありがとうございます！** 🎉
