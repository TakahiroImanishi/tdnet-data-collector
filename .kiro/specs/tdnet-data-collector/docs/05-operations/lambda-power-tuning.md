# Lambda Power Tuning ガイド

## 概要

AWS Lambda Power Tuningは、Lambda関数の最適なメモリサイズを測定するツールです。コスト効率とパフォーマンスのバランスを見つけることができます。

## 前提条件

- AWS CLIがインストールされていること
- 適切なIAM権限があること
- AWS SAM CLIがインストールされていること（推奨）

## インストール

### 1. Lambda Power Tuning State Machineのデプロイ

```bash
# リポジトリをクローン
git clone https://github.com/alexcasalboni/aws-lambda-power-tuning.git
cd aws-lambda-power-tuning

# SAMでデプロイ
sam deploy --guided
```

デプロイ時の設定:
- Stack Name: `lambda-power-tuning`
- AWS Region: `ap-northeast-1`
- PowerValues: `128,256,512,1024,1536,2048,3008` (デフォルト)

### 2. デプロイ確認

```bash
# State Machineが作成されたことを確認
aws stepfunctions list-state-machines --region ap-northeast-1 | grep powerTuningStateMachine
```

## 使用方法

### 1. Collector Lambda関数の最適化

```bash
# State Machine実行用のJSONファイルを作成
cat > collector-tuning-input.json << 'EOF'
{
  "lambdaARN": "arn:aws:lambda:ap-northeast-1:ACCOUNT_ID:function:tdnet-collector-dev",
  "powerValues": [256, 512, 1024, 1536],
  "num": 10,
  "payload": {
    "mode": "batch"
  },
  "parallelInvocation": true,
  "strategy": "cost"
}
EOF

# State Machineを実行
aws stepfunctions start-execution \
  --state-machine-arn "arn:aws:states:ap-northeast-1:ACCOUNT_ID:stateMachine:powerTuningStateMachine" \
  --input file://collector-tuning-input.json \
  --region ap-northeast-1
```

### 2. Query Lambda関数の最適化

```bash
# Query Lambda用の入力ファイル
cat > query-tuning-input.json << 'EOF'
{
  "lambdaARN": "arn:aws:lambda:ap-northeast-1:ACCOUNT_ID:function:tdnet-query-dev",
  "powerValues": [128, 256, 512],
  "num": 50,
  "payload": {
    "queryStringParameters": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31",
      "limit": "100"
    }
  },
  "parallelInvocation": true,
  "strategy": "balanced"
}
EOF

# State Machineを実行
aws stepfunctions start-execution \
  --state-machine-arn "arn:aws:states:ap-northeast-1:ACCOUNT_ID:stateMachine:powerTuningStateMachine" \
  --input file://query-tuning-input.json \
  --region ap-northeast-1
```

### 3. Export Lambda関数の最適化

```bash
# Export Lambda用の入力ファイル
cat > export-tuning-input.json << 'EOF'
{
  "lambdaARN": "arn:aws:lambda:ap-northeast-1:ACCOUNT_ID:function:tdnet-export-dev",
  "powerValues": [256, 512, 1024, 1536],
  "num": 10,
  "payload": {
    "body": "{\"start_date\":\"2024-01-01\",\"end_date\":\"2024-01-31\",\"format\":\"csv\"}"
  },
  "parallelInvocation": false,
  "strategy": "balanced"
}
EOF

# State Machineを実行
aws stepfunctions start-execution \
  --state-machine-arn "arn:aws:states:ap-northeast-1:ACCOUNT_ID:stateMachine:powerTuningStateMachine" \
  --input file://export-tuning-input.json \
  --region ap-northeast-1
```

## パラメータ説明

| パラメータ | 説明 | 推奨値 |
|-----------|------|--------|
| `lambdaARN` | 最適化対象のLambda関数ARN | - |
| `powerValues` | テストするメモリサイズ（MB） | `[128, 256, 512, 1024, 1536, 2048]` |
| `num` | 各メモリサイズでの実行回数 | `10`（統計的に有意な結果を得るため） |
| `payload` | Lambda関数に渡すペイロード | 実際の使用ケースに近いデータ |
| `parallelInvocation` | 並列実行するか | `true`（スループット重視）、`false`（レイテンシ重視） |
| `strategy` | 最適化戦略 | `cost`（コスト重視）、`speed`（速度重視）、`balanced`（バランス） |

## 結果の確認

### 1. 実行状態の確認

```bash
# 実行IDを取得（上記コマンドの出力から）
EXECUTION_ARN="arn:aws:states:ap-northeast-1:ACCOUNT_ID:execution:powerTuningStateMachine:xxx"

# 実行状態を確認
aws stepfunctions describe-execution \
  --execution-arn "$EXECUTION_ARN" \
  --region ap-northeast-1
```

### 2. 結果の取得

実行が完了すると、以下の情報が得られます:

```json
{
  "power": 512,
  "cost": 0.000000208,
  "duration": 1234.56,
  "stateMachine": {
    "executionCost": 0.00025,
    "lambdaCost": 0.000020833,
    "visualization": "https://lambda-power-tuning.show/#..."
  },
  "stats": {
    "averageDuration": 1234.56,
    "averageCost": 0.000000208
  }
}
```

### 3. 可視化URLの確認

結果の`visualization`フィールドにあるURLをブラウザで開くと、グラフで結果を確認できます。

## 推奨メモリサイズの適用

### 1. environment-config.tsの更新

```typescript
// cdk/lib/config/environment-config.ts

export const prodConfig: EnvironmentConfig = {
  environment: 'prod',
  collector: {
    timeout: 900, // 15 minutes
    memorySize: 512, // ← Power Tuningの結果に基づいて更新
    logLevel: 'INFO',
  },
  query: {
    timeout: 30, // 30 seconds
    memorySize: 256, // ← Power Tuningの結果に基づいて更新
    logLevel: 'INFO',
  },
  export: {
    timeout: 300, // 5 minutes
    memorySize: 1024, // ← Power Tuningの結果に基づいて更新
    logLevel: 'INFO',
  },
  // ...
};
```

### 2. CDKスタックのデプロイ

```bash
# 変更をデプロイ
cd cdk
npm run build
cdk deploy --profile your-profile
```

## ベストプラクティス

### 1. 定期的な再測定

- 月次または四半期ごとにPower Tuningを実行
- Lambda関数のコードが大幅に変更された場合は再測定

### 2. 実際のワークロードでテスト

- `payload`パラメータには実際の使用ケースに近いデータを使用
- ピーク時のワークロードを想定したテストを実施

### 3. コストとパフォーマンスのバランス

- `strategy: "balanced"`を使用して、コストとパフォーマンスのバランスを取る
- コスト重視の場合は`strategy: "cost"`を使用

### 4. 複数のシナリオでテスト

- 軽量なリクエスト（少数の開示情報）
- 重量なリクエスト（大量の開示情報）
- 両方のシナリオで最適なメモリサイズを確認

## トラブルシューティング

### State Machine実行エラー

```bash
# エラー詳細を確認
aws stepfunctions get-execution-history \
  --execution-arn "$EXECUTION_ARN" \
  --region ap-northeast-1
```

### Lambda関数のタイムアウト

- `timeout`パラメータを増やす
- または、Lambda関数のタイムアウト設定を一時的に延長

### 権限エラー

Power Tuning State Machineに以下の権限が必要:
- `lambda:InvokeFunction`
- `lambda:GetFunctionConfiguration`
- `lambda:UpdateFunctionConfiguration`

## 参考リンク

- [AWS Lambda Power Tuning GitHub](https://github.com/alexcasalboni/aws-lambda-power-tuning)
- [AWS Lambda Power Tuning Visualization](https://lambda-power-tuning.show/)
- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)

## 現在の設定（2026-02-12時点）

| Lambda関数 | 環境 | メモリ | タイムアウト | 備考 |
|-----------|------|--------|------------|------|
| Collector | dev | 256MB | 5分 | Power Tuning未実施 |
| Collector | prod | 512MB | 15分 | Power Tuning未実施 |
| Query | dev | 128MB | 10秒 | Power Tuning未実施 |
| Query | prod | 256MB | 30秒 | Power Tuning未実施 |
| Export | dev | 256MB | 2分 | Power Tuning未実施 |
| Export | prod | 512MB | 5分 | Power Tuning未実施 |

**注意**: 実際のワークロードでPower Tuningを実行し、最適なメモリサイズを決定してください。
