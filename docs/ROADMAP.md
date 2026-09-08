# ROADMAP.md

## Development policy

各バージョンは1つの主要機能に集中する。

前段階が安定する前に次段階を先行実装しない。

## v0.1 Rain Monitor

Goal:

日本地図上で現在および直近過去の降水情報を確認できる。

Done when:

- 地図が表示される。
- ズームとパンができる。
- 降水レイヤーが表示される。
- レイヤーをON/OFFできる。
- 表示データ時刻が分かる。
- 一定間隔で更新される。
- 複数時刻を切り替えられる。
- 取得失敗時に直前データが残る。

## v0.2 AMeDAS

Goal:

地図上で主要な地上観測値を確認できる。

Candidate data:

- 気温
- 降水量
- 風向
- 風速

## v0.3 Himawari

Goal:

衛星画像から日本周辺の雲の状態を確認できる。

## v0.4 Timeline Player

Goal:

過去データを時間軸で連続再生できる。

Features:

- 再生
- 一時停止
- 時刻選択
- 再生速度

## v0.5 Precipitation Forecast

Goal:

現在から未来の降水予測まで連続して確認できる。

## v0.6 Alerts

Goal:

気象警報、注意報を地図上で把握できる。

## v0.7 Advanced Weather Layers

Candidate features:

- 雷
- 台風
- 天気図
- 風
- 気温分布

## Later

必要性を確認してから検討する。

- PWA
- 全画面常時表示モード
- 複数画面レイアウト
- 地域プリセット
- ユーザー設定保存
- 気象データ履歴
- デスクトップアプリ化
