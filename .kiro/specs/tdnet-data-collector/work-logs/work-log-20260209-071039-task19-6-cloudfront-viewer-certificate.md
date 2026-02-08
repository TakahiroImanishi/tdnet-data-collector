# 作業記録: CloudFront ViewerCertificate設定追加

**作業日時**: 2026-02-09 07:10:39  
**タスク**: 19.6 CloudFront ViewerCertificate設定追加  
**担当**: AI Assistant  
**優先度**: 🔴 Critical（セキュリティ要件）

## 作業概要

CloudFront DistributionにViewerCertificate設定を追加し、TLS 1.2以上のセキュリティ要件を満たす。

## タスク詳細

- **ファイル**: `cdk/lib/constructs/dashboard-cloudfront.ts`
- **失敗内容**: CloudFront DistributionのViewerCertificateプロパティが設定されていない
- **原因**: CDK Constructで`ViewerCertificate`の設定が欠落している
- **対応内容**:
  - `ViewerCertificate`プロパティを追加
  - 最小TLSバージョンを`TLSv1.2_2021`に設定
  - セキュリティ要件を満たす設定を実装

## 実施内容

### 1. 現状調査


#### 調査結果

**現在の実装状況**:
- ファイル: `cdk/lib/constructs/cloudfront.ts`
- `minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021` は既に設定済み
- しかし、`certificate`プロパティが明示的に設定されていない

**CDK Nag ルール（AwsSolutions-CFR4）の要件**:
- デフォルトのCloudFront証明書を使用する場合でも、明示的に証明書設定が必要
- `cloudFrontDefaultCertificate: true`を使用する場合、最小TLSバージョンはTLSv1に固定される（非推奨）
- 推奨: `ViewerCertificate.fromCloudFrontDefaultCertificate()`を使用し、`minimumProtocolVersion`を明示的に設定

**対応方針**:
1. `Distribution`コンストラクタの`certificate`プロパティを追加
2. `ViewerCertificate.fromCloudFrontDefaultCertificate()`を使用
3. セキュリティポリシーを`TLS_V1_2_2021`に設定（既存の`minimumProtocolVersion`は削除）

### 2. 実装


#### 実装内容

**変更ファイル**: `cdk/lib/constructs/cloudfront.ts`

**変更内容**:
1. `minimumProtocolVersion`プロパティを削除
2. `certificate`プロパティを追加:
   ```typescript
   certificate: cloudfront.ViewerCertificate.fromCloudFrontDefaultCertificate({
     securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
   }),
   ```

**理由**:
- CDK Nagルール（AwsSolutions-CFR4）に準拠
- デフォルトのCloudFront証明書を使用する場合でも、明示的に`ViewerCertificate`を設定することでセキュリティポリシーを確実に適用
- TLS 1.2以上のセキュリティ要件を満たす

### 3. テスト実行
