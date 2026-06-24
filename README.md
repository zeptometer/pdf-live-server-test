# PDF Live Server

論文執筆（LaTeX等）をサポートするための、PDFのライブプレビュー用Webサーバーです。
対象となるPDFファイルが更新されたことを検知してブラウザ側へ自動リロードを指示し、その際に**現在のスクロール位置を維持したまま再描画**を行います。
また、TailscaleなどのVPNやリバースプロキシ経由での閲覧を想定し、シンプルなHTTPサーバーとして設計されています。

## 特徴

* 🚀 **リアルタイム更新**: ファイルが更新されると、即座にブラウザ上のPDFがリロードされます。
* 📜 **スクロール位置の維持**: リロード後もスクロール位置がトップに戻らず、現在読んでいる位置をキープします。
* 🌐 **HTTPベースの配信**: 特別な設定なしで、ローカルネットワークやTailscale経由で別端末からプレビューを閲覧可能です。
* 🔍 **堅牢なファイル監視**: LaTeXコンパイラによる「ファイルの削除・再作成（アトミック保存）」などによる監視外れを防ぐため、ディレクトリレベルの監視とポーリングを組み合わせています。

## 必須要件

* Node.js (v18以降推奨)
* npm

## インストール

リポジトリをクローンし、依存関係をインストールしてください。

```bash
cd pdf-live-server-test
npm install
```

### グローバルコマンドとしてインストール

以下のコマンドをプロジェクトディレクトリで実行すると、システム上のどこからでも `pdf-live-server` コマンドが使えるようになります。

```bash
npm link
# または npm install -g .
```

## 使い方

インストール後、監視したいPDFのパスを指定してコマンドを実行します。

```bash
pdf-live-server [-t|--tailscale] <監視するPDFファイルのパス>
```

* `-t, --tailscale`: （オプション）起動時に `tailscale serve` を実行し、自動で HTTPS ルーティングとQRコードを生成します。

**実行例:**
```bash
# デフォルトポートで paper.pdf を監視する
pdf-live-server path/to/your/paper.pdf

# Tailscale経由でセキュアにアクセスできるよう自動設定する
pdf-live-server --tailscale path/to/your/paper.pdf
```

起動後、コンソールに表示されたURL（例: `http://localhost:8080`）にブラウザでアクセスしてください。PDFファイルが別のエディタなどで上書き保存されるたびに、ブラウザのプレビューが自動で更新されます。

## テスト

本プロジェクトには Playwright を用いた E2E（End-to-End）テストが組み込まれています。
テストでは実際に仮想ブラウザを立ち上げ、「ファイルの疑似的な書き換え → PDFの再取得と再描画 → スクロール位置が維持されているかの確認」までを自動で検証します。

```bash
npm run test
```

## 使用技術

* **Frontend**: TypeScript, Vite, PDF.js
* **Backend**: Express (Node.js), chokidar, Server-Sent Events (SSE)
* **Testing**: Playwright
