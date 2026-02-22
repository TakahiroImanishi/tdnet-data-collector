# 作業記録アーカイブ

このフォルダには完了したPhaseの作業記録を保管しています。

## アーカイブ構造

```
archive/
└── phase1-4/  (267ファイル)
    ├── 2026-02-07: Phase1開始～Phase2準備
    └── 2026-02-08: Phase2～Phase4完了
```

## アーカイブ基準

- Phase完了後、該当期間の作業記録を移動
- 日付ベースで自動判別（作業記録ファイル名の日付部分）
- 現在進行中のPhaseの記録は親フォルダに残す

## 現在の作業記録

親フォルダ（`work-logs/`）には以下が保管されています：
- Phase5進行中の作業記録（2026-02-09以降）
- 特殊な記録（dashboard-access-info.md等）
- テンプレート・スクリプト

## 検索方法

アーカイブ内のファイルを検索する場合：
```powershell
Get-ChildItem -Path ".kiro/specs/tdnet-data-collector/work-logs/archive" -Recurse -Filter "*keyword*.md"
```
