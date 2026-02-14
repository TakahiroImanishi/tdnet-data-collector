# 作業記録: タスク31.2.5.4 - temp/プレフィックス自動削除の実装可否判断

**作業日時:** 2026-02-14 18:26:37  
**タスク:** 31.2.5.4 temp/プレフィックス自動削除の実装可否判断（Minor）  
**優先度:** 🟢 Low  
**推定工数:** 30分〜2時間

---

## 目的

設計書ではtemp/プレフィックスは1日後に自動削除を記載しているが、実装では未実装。ライフサイクルポリシーを追加すべきかを判断する。

---

## 調査結果

### 1. 設計書の記載

**ファイル:** `.kiro/specs/tdnet-data-collector/docs/design.md`

```markdown
ライフサイクルポリシー:
- temp/: 1日経過後に自動削除
- exports/: 7日経過後に自動削除
- pdfs/: 90日経過後にS3 Standard-IA（低頻度アクセス）に移行
- pdfs/: 365日経過後にS3 Glacier Flexible Retrievalに移行
```

**ディレクトリ構造:**
```
/pdfs/YYYY/MM/DD/{company_code}_{disclosure_type}_{timestamp}.pdf
/temp/{disclosure_id}.pdf
/exports/{export_id}.{format}
```

### 2. 実装の確認

**ファイル:** `cdk/lib/stacks/foundation-stack.ts`

```typescript
// PDFバケットのライフサイクルルール
lifecycleRules: [
  {
    id: 'TransitionToStandardIA',
    enabled: true,
    transitions: [
      {
        storageClass: s3.StorageClass.INFREQUENT_ACCESS,
        transitionAfter: cdk.Duration.days(90),
      },
      {
        storageClass: s3.StorageClass.GLACIER,
        transitionAfter: cdk.Duration.days(365),
      },
    ],
  },
],
```

**確認結果:**
- ✅ pdfs/プレフィックスのライフサイクルポリシー（90日後Standard-IA、365日後Glacier）は実装済み
- ❌ temp/プレフィックスの自動削除（1日後）は未実装
- ❌ exports/プレフィックスの自動削除（7日後）は未実装（別バケットに分離されている）

### 3. temp/プレフィックスの使用状況

**検索結果:**
- Lambda関数のコードベース全体を検索したが、`temp/`プレフィックスを使用している箇所は見つからなかった
- 現在の実装では、PDFファイルは直接`pdfs/YYYY/MM/DD/`に保存されている
- 一時ファイルを`temp/`に保存する実装は存在しない

**関連ファイル:**
- `lambda/collector/src/handlers/collector.ts`: PDFダウンロード処理
- `lambda/collector/src/services/pdf-downloader.ts`: PDF保存処理

---

## 判断

### 結論: 設計書から削除（実装しない）

**理由:**

1. **temp/プレフィックスは現在使用されていない**
   - Lambda関数のコードベース全体を検索したが、`temp/`プレフィックスを使用している箇所は見つからなかった
   - PDFファイルは直接`pdfs/YYYY/MM/DD/`に保存されている
   - 一時ファイルを保存する実装は存在しない

2. **設計書と実装の乖離**
   - 設計書では`temp/`プレフィックスを使用する前提だったが、実装では不要と判断された
   - 実装時に設計が変更されたが、設計書が更新されなかった

3. **実装コストと実用性**
   - 使用されていないプレフィックスのためにライフサイクルポリシーを追加するのは無駄
   - 将来的に一時ファイルが必要になった場合に追加すれば十分

4. **コスト最適化**
   - 不要なライフサイクルルールを追加しないことで、設定の複雑性を削減
   - S3ライフサイクルルール自体は無料だが、設定の保守コストを削減

### 推奨アクション

1. **設計書から削除**
   - `.kiro/specs/tdnet-data-collector/docs/design.md`から`temp/`プレフィックスの記載を削除
   - ディレクトリ構造から`/temp/{disclosure_id}.pdf`を削除
   - ライフサイクルポリシーから`temp/: 1日経過後に自動削除`を削除

2. **将来的な対応**
   - 一時ファイルが必要になった場合は、その時点で実装を追加
   - 実装時に設計書も同時に更新

---

## 次のステップ

1. ✅ 判断完了: 設計書から削除（実装しない）
2. ⏭️ 設計書の更新（別タスクで実施）
3. ⏭️ tasks.mdの更新

---

## 申し送り事項

- temp/プレフィックスは現在使用されていないため、設計書から削除することを推奨
- exports/プレフィックスも同様に使用されていない（別バケットに分離）
- 設計書の更新は別タスク（31.2.5.2）で実施予定
