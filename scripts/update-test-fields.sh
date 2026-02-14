#!/bin/bash
# テストファイルのフィールド名一括更新スクリプト
# s3_key → pdf_s3_key
# collected_at → downloaded_at

echo "=== Updating test files ==="

# s3_key: を pdf_s3_key: に置換（オブジェクトリテラル）
find src -name "*.test.ts" -type f -exec sed -i 's/s3_key: /pdf_s3_key: /g' {} +

# 's3_key' を 'pdf_s3_key' に置換（文字列リテラル）
find src -name "*.test.ts" -type f -exec sed -i "s/'s3_key'/'pdf_s3_key'/g" {} +

# collected_at: を downloaded_at: に置換（オブジェクトリテラル）
find src -name "*.test.ts" -type f -exec sed -i 's/collected_at: /downloaded_at: /g' {} +

# 'collected_at' を 'downloaded_at' に置換（文字列リテラル）
find src -name "*.test.ts" -type f -exec sed -i "s/'collected_at'/'downloaded_at'/g" {} +

# コメント内のcollected_atをdownloaded_atに置換
find src -name "*.test.ts" -type f -exec sed -i 's/collected_atが/downloaded_atが/g' {} +

echo "=== Update complete ==="
