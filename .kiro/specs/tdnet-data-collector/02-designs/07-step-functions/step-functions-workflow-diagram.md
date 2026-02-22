# Step Functions ワークフロー図

**作成日**: 2026-02-22
**バージョン**: 1.0
**ステータス**: 完了

## 概要

Step Functionsを使用したデータ収集処理のワークフロー図をMermaid形式で視覚化します。

## メインワークフロー

```mermaid
stateDiagram-v2
    [*] --> Initialize
    
    Initialize: 初期化 (collector-init Lambda)
    Initialize: - パラメータ検証
    Initialize: - 実行状態初期化 (DynamoDB)
    Initialize: - TDnet APIメタデータ取得
    Initialize: - ページ配列生成
    
    Initialize --> MapState: 成功
    Initialize --> HandleInitError: エラー
    
    MapState: データ取得ループ (Map State)
    MapState: MaxConcurrenc