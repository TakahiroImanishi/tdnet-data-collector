# 作業記録: AWS SSO情報をコアルールに追加

## 作業概要
- **日時**: 2026-02-22 17:05:37
- **作業者**: Kiro AI
- **作業内容**: コアルール（tdnet-implementation-rules.md）にAWS SSO認証に関する簡潔な情報を追加

## 実施内容

### AWS認証セクションを追加
- プロファイル`tdnet-prod`を使用（`~/.aws/config`に設定済み）
- 使用方法: `aws sso login --profile tdnet-prod`でログイン後、`--profile tdnet-prod`を指定

## 変更ファイル
- `.kiro/steering/core/tdnet-implementation-rules.md`

## 成果物
- AWS SSO認証の簡潔なガイドラインをコアルールに追加
