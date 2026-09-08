# ARCHITECTURE.md

## 1. Architecture goal

外部の気象データ仕様とUIを分離し、外部側のURLやデータ形式が変化しても修正範囲を限定できる構成にする。

## 2. Recommended stack

初期候補は以下とする。

- Frontend: React + TypeScript
- Build tool: Vite
- Map: MapLibre GL JS
- Styling: CSS Modulesまたは通常のCSS
- Test: Vitest

Next.jsは、SSRやサーバー機能が必要になった段階で再検討する。v0.1では静的配信可能な構成を優先する。

## 3. Logical layers

```text
UI Components
    ↓
Application / Hooks
    ↓
Weather Domain Model
    ↓
Weather Data Adapter
    ↓
External Weather Source
```

## 4. Responsibilities

### UI Components

表示とユーザー操作のみを担当する。

外部APIのURLやレスポンス形式を知らない。

### Application layer

- 自動更新
- 選択中の時刻
- レイヤー表示状態
- 更新停止
- ローディング状態
- エラー状態

などを管理する。

### Domain model

アプリ内部で統一して扱うデータ型を定義する。

例:

```ts
export type WeatherFrame = {
  id: string;
  observedAt: string;
  fetchedAt: string;
  layerType: "precipitation";
  source: string;
  tileTemplate?: string;
};
```

この型は外部データのレスポンスをそのまま表現しない。

### Adapter

外部データを取得し、アプリ内部形式へ変換する。

例:

```text
src/weather/adapters/jma/
```

に閉じ込める。

## 5. Suggested directory structure

```text
src/
├─ app/
│  ├─ App.tsx
│  └─ config.ts
├─ components/
│  ├─ WeatherMap/
│  ├─ LayerControls/
│  ├─ Timeline/
│  └─ UpdateStatus/
├─ weather/
│  ├─ domain/
│  ├─ services/
│  └─ adapters/
│     └─ jma/
├─ hooks/
├─ utils/
└─ main.tsx
```

## 6. Data acquisition policy

ブラウザから外部サービスへ直接アクセスして問題がない場合でも、取得処理はAdapterへ集約する。

CORS、URL変更、データ形式変更などにより直接取得が不安定な場合は、以下を追加する。

```text
Browser
  ↓
Weather API Proxy
  ↓
External Weather Source
```

v0.1では必要になるまでバックエンドを追加しない。

## 7. Cache policy

少なくとも表示中の時系列データはクライアント側メモリに保持する。

新規データ取得失敗時に直前データを表示し続けられるようにする。

長期保存はv0.1では行わない。

## 8. Polling

一定間隔で最新データを確認する。

ポーリング間隔はハードコードせず、設定値として管理する。

タブがバックグラウンドの場合に高頻度更新を続ける必要はないため、Page Visibility APIの利用を検討する。

## 9. Map layer design

地図本体と気象レイヤーを分離する。

レイヤー追加時にMapコンポーネントそのものを大きく変更しなくてよい構造にする。

将来的には以下を独立レイヤーとして扱える設計を目指す。

- precipitation
- satellite
- temperature
- wind
- warning
- lightning
- typhoon

## 10. State management

v0.1ではReact標準のstate、context、custom hooksを優先する。

状態管理ライブラリは必要性が出るまで導入しない。

## 11. Security

- 外部データをHTMLとして直接挿入しない。
- URLやパラメーターは検証する。
- 秘密情報をクライアントへ置かない。
- APIキーが必要な外部サービスは、将来バックエンド経由とする。

## 12. Testing

最低限、以下をテスト対象とする。

- 外部データから内部モデルへの変換
- データ時刻の並び替え
- 最新データ判定
- 重複データ排除
- 更新失敗時の状態遷移

地図描画そのものは過剰な単体テストを行わず、統合動作確認を重視する。
