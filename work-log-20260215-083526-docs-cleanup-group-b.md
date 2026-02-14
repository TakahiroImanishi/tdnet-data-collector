# 作業記録: docsフォルダクリーンアップ - グループB（実装・テスト）

**作業日時**: 2026-02-15 08:35:26  
**作業者**: Kiro AI Assistant  
**作業概要**: implementation-checklist.md、correctness-properties-checklist.md、e2e-test-guide.md、localstack-setup.mdのクリーンアップ

---

## 対象ファイル

1. `.kiro/specs/tdnet-data-collector/docs/02-implementation/implementation-checklist.md`
2. `.kiro/specs/tdnet-data-collector/docs/02-implementation/correctness-properties-checklist.md`
3. `.kiro/specs/tdnet-data-collector/docs/03-testing/e2e-test-guide.md`
4. `.kiro/specs/tdnet-data-collector/docs/03-testing/localstack-setup.md`

---

## 分析結果

### 1. implementation-checklist.md（約3,200語）

**問題点:**
- チェックリスト項目が非常に詳細で冗長（16セクション、100項目以上）
- 実装開始前の準備項目と実装中の項目が混在
- 完了率の手動更新が必要（メンテナンス負荷）
- 「チェック記録」セクションが実用的でない
- 最終確認セクションが重複

**改善方針:**
- 実装開始前に必須の項目のみに絞る
- 完了率表示を削除（自動計算できない）
- チェック記録セクションを削除
- 関連ドキュメントへの参照を簡潔化

### 2. correctness-properties-checklist.md（約5,800語）

**問題点:**
- 各Propertyの検証方法が非常に詳細（コード例が長い）
- テストファイルパスが「未作成」で情報価値が低い
- 実装優先順位が3フェーズに分かれているが、実装済みのため不要
- 進捗率表が手動更新必要
- テスト実装ガイドラインが重複（testing-strategy.mdと）

**改善方針:**
- コード例を最小限に削減
- 「未作成」情報を削除
- 実装優先順位セクションを削除（実装済み）
- 進捗率表を削除
- テスト実装ガイドラインを削除（他ドキュメント参照）

### 3. e2e-test-guide.md（約2,400語）

**問題点:**
- LocalStack環境とAWS環境の2つのオプションを詳細に説明（冗長）
- テストケース一覧が非常に詳細
- CI/CD統合の完全なYAML例が含まれる
- トラブルシューティングが重複（localstack-setup.mdと）

**改善方針:**
- LocalStack環境に焦点を絞る（推奨環境）
- テストケース一覧を簡潔化
- CI/CD統合例を削除（別ドキュメント参照）
- トラブルシューティングを削除（localstack-setup.md参照）

### 4. localstack-setup.md（約3,100語）

**問題点:**
- インストール手順が非常に詳細
- 手動でのリソース作成手順が冗長（スクリプトがあるため不要）
- AWS CLIプロファイル設定が詳細すぎる
- トラブルシューティングが6項目と多い
- 統合テストでの使用セクションが重複

**改善方針:**
- クイックスタートガイドを前面に
- 手動リソース作成を削除
- AWS CLIプロファイル設定を簡略化
- トラブルシューティングを3項目に削減
- 統合テストセクションを削除（e2e-test-guide.md参照）

---

## クリーンアップ実施

### 変更内容

