<p align="center">
  <img src="./resources/CodeConductor-banner-1 copy.png" alt="CodeConductor banner" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/release/zhu1090093659/CodeConductor?style=flat-square&color=32CD32" alt="Version">
  &nbsp;
  <img src="https://img.shields.io/badge/license-Apache--2.0-32CD32?style=flat-square&logo=apache&logoColor=white" alt="License">
  &nbsp;
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-6C757D?style=flat-square&logo=linux&logoColor=white" alt="Platform">
</p>

---

<p align="center">
  <strong>コマンドライン AI Agent 向けのモダンなデスクトップアプリと WebUI</strong><br>
  <em>ユーザーフレンドリー | 視覚的な UI | マルチモデル対応 | ローカル優先</em>
</p>

<p align="center">
  <strong><a href="https://github.com/iOfficeAI/AionUi">AionUI</a> をベースにした <a href="https://claude.com/blog/cowork-research-preview">Anthropic Cowork</a> のオープンソース強化版</strong><br>
  <sub>CodeConductor は AionUI の優れた基盤の上に、実際のプロジェクトでのコーディングエージェント体験を向上させます。</sub>
</p>

<p align="center">
  <a href="https://github.com/zhu1090093659/CodeConductor/releases">
    <img src="https://img.shields.io/badge/Download-Latest%20Release-32CD32?style=for-the-badge&logo=github&logoColor=white" alt="Download Latest Release" height="50">
  </a>
</p>

<p align="center">
  <a href="./readme.md">English</a> | <a href="./readme_ch.md">简体中文</a> | <strong>日本語</strong> | <a href="https://www.CodeConductor.com" target="_blank">公式サイト</a> | <a href="https://twitter.com/CodeConductor" target="_blank">Twitter</a>
</p>

---

## クイックナビゲーション

<p align="center">

[位置付け](#位置付け) ·
[CodeConductor でできること](#codeconductor-でできること) ·
[このフォークでの強化点](#このフォークでの強化点) ·
[コア機能](#コア機能) ·
[クイックスタート](#クイックスタート) ·
[ドキュメント](#ドキュメント) ·
[コミュニティとサポート](#コミュニティとサポート)

</p>

---

## 更新履歴

### 1.7.2

- 追加：CLI プロバイダー設定ページ（Claude Code / Codex）。
- 追加：`CollabChat` ビュー、`MessageList` のツールメッセージ一括折りたたみで可読性を改善。
- 改善：ターミナル/プロセス周りを強化（PTY ベースのターミナル管理、agent-browser のコマンド実行、worker プロセス管理）。
- 修正/ドキュメント：リンク/URL の誤りを修正し、AionUI/Cowork との関係説明を追記；Code of Conduct を追加。

### 1.7.1

- SendBox 系コンポーネントにメンション機能を追加（候補、キーボード操作、コラボ連携）。
- UI/テーマの一貫性を改善（入力、ボタン、モーダル、メッセージ表示など）。
- agent-browser によるブラウザ自動化を強化（IPC 対応、スラッシュコマンド入口）。
- ビルド/ドキュメント/設定テンプレートを更新し、複数ロール協業ガイドラインを追加。

## 位置付け

このリポジトリは CodeConductor の強化フォークです。「コマンドライン AI Agent のためのモダン UI」という目標を維持しつつ、実プロジェクトでの “coding agent” ワークフローをより扱いやすくすることに注力しています。

## CodeConductor でできること

<p align="center">
  <img src="./resources/offica-ai BANNER-function copy.png" alt="CodeConductor 機能概要" width="800">
</p>

### マルチエージェントモード（CLI ツールを統合 UI へ）

Claude Code、Codex、Qwen Code、Goose CLI などのコマンドラインツールをインストール済みの場合、CodeConductor が検出し、統合された GUI で利用できます。

- **自動検出と統合 UI** - ローカルの CLI ツールを認識し、ひとつの UI にまとめます。
- **ローカル保存とマルチセッション** - 会話をローカルに保存し、複数セッションを独立コンテキストで並列運用できます。

<p align="center">
  <img src="./resources/acp home page.gif" alt="マルチエージェントモードデモ" width="800">
</p>

---

### スマートファイル管理

_一括リネーム、自动整理、スマート分类、ファイルマージ_

- **自动整理**：コンテンツをスマートに识别して自动分类し、フォルダを整理整顿します。
- **効率的な一括处理**：ワンクリックでリネームや结合を行い、烦雑な手作业から解放されます。

<p align="center">
  <img src="./resources/CodeConductor sort file.gif" alt="スマートファイル管理デモ" width="800">
</p>

---

### プレビューパネル

_9种类以上の形式のビジュアルプレビューをサポート（PDF、Word、Excel、PPT、コード、Markdown、画像、HTML、Diffなど）_

- **即座に結果を確認** - AI がファイルを生成した後、アプリを切り替えることなくすぐにプレビューできます。
- **ワークスペースに統合** - プレビューは右側の Workspace パネル内に表示され、独立した中間パネルはありません
- **リアルタイム追跡と編集** - ファイル変更を自動追跡し、Markdown/コード/HTML のリアルタイム編集をサポートします。

<p align="center">
  <img src="./resources/preview.gif" alt="プレビューパネルデモ" width="800">
</p>

---

### 画像生成と編集

_インテリジェントな画像生成、編集、認識、Geminiが駆動_

<p align="center">
  <img src="./resources/Image_Generation.gif" alt="AI画像生成デモ" width="800">
</p>

画像モデルの選択と有効化は設定画面から行えます。

---

### マルチタスク並列処理

_複数の会話を開く、タスクが混乱しない、記憶が独立、効率が倍増_

<p align="center">
  <img src="./resources/multichat-side-by-side.gif" alt="会話管理デモ" width="800">
</p>

---

### WebUI モード

_AIツールをリモート制御 - ネットワーク上の任意のデバイスからCodeConductorにアクセス！ローカルのClaude Code、Codexなどのツールを安全に制御、データはデバイスから離れません_

```bash
# 基本起動
CodeConductor --webui

# リモートアクセス（ローカルネットワーク内の他のデバイスからアクセス可能）
CodeConductor --webui --remote
```

各プラットフォームの起動手順は [`WEBUI_GUIDE.md`](./WEBUI_GUIDE.md) を参照してください。

<p align="center">
  <img src="./resources/webui banner.png" alt="WebUIリモートアクセスデモ" width="800">
</p>

---

## このフォークでの強化点

このフォークは「コマンドラインの coding agent を実プロジェクトで使いやすくする」ことに注力しています。

- **マルチロール協業ビュー（PM/Analyst/Engineer）**：ひとつのプロジェクト会話内で役割分担し、情報をまとめて把握できます。
- **高影響操作の明示的な承認**：コマンド実行や変更適用などで、より分かりやすい確認と可視化を提供します。
- **スラッシュコマンド**：よく使う操作を発見しやすいショートカットとして提供します。
- **プロジェクト優先の会話とワークスペース文脈**：タスク推進と成果物中心の会話運用を重視します。
- **レビューしやすいワークフロー**：プレビューと差分確認をより中心に置き、確認コストを下げます。

---

## コア機能

### マルチセッションチャット

- **マルチセッション + 独立コンテキスト** - 複数のチャットを同時に開く、各セッションは独立したコンテキストメモリを持ち、混同しない
- **ローカル保存** - すべての会話はローカルに保存され、失われません

### 🤖 **マルチモデルサポート**

- **マルチプラットフォームサポート** - Gemini、OpenAI、Claude、Qwenなどの主流モデルをサポート、柔軟に切り替え
- **ローカルモデルサポート** - Ollama、LM Studioなどのローカルモデルデプロイメントをサポート、Customプラットフォームを選択し、ローカルAPIアドレス（例：`http://localhost:11434/v1`）を設定するだけで接続可能

### 🗂️ **ファイル管理**

- **ファイルツリーブラウズ + ドラッグ&ドロップアップロード** - フォルダのようにファイルを閲覧、ファイルやフォルダのドラッグ&ドロップでワンクリックインポートをサポート
- **スマート整理** - AIにフォルダの整理を依頼でき、自動分類

### 📄 **プレビューパネル - AIエージェントにディスプレイを提供**

- **9種類以上の形式プレビュー** - PDF、Word、Excel、PPT、コード、Markdown、画像などをサポート、AI生成後すぐに結果を確認
- **リアルタイム追跡 + 編集可能** - ファイル変更を自動追跡、Markdown、コード、HTMLのリアルタイム編集とデバッグをサポート

### AI 画像生成と編集

- **インテリジェント画像生成** - Gemini 2.5 Flash Image Preview、Nano、Bananaなどの複数の画像生成モデルをサポート
- **画像認識と編集** - AI駆動の画像分析と編集機能

### WebUI リモートアクセス

- **クロスデバイスアクセス** - ネットワーク上の任意のデバイスからブラウザ経由でアクセス、モバイルデバイスをサポート
- **ローカルデータセキュリティ** - すべてのデータはSQLiteデータベースにローカル保存、サーバーデプロイメントに適している

### パーソナライズされたインターフェースカスタマイズ

_独自のCSSコードでカスタマイズし、インターフェースを好みに合わせる_

<p align="center">
  <img src="./resources/css with skin.gif" alt="CSSカスタムインターフェースデモ" width="800">
</p>

- **完全カスタマイズ可能** - CSSコードを通じてインターフェースの色、スタイル、レイアウトを自由にカスタマイズ、専属の使用体験を作成

---

## ドキュメント

- WebUI 起動ガイド：[`WEBUI_GUIDE.md`](./WEBUI_GUIDE.md)
- プロジェクト概略とアーキテクチャ：[`CLAUDE.md`](./CLAUDE.md)
- コードスタイル：[`CODE_STYLE.md`](./CODE_STYLE.md)

---

## クイックスタート

### システム要件

- **macOS**: 10.15以上
- **Windows**: Windows 10以上
- **Linux**: Ubuntu 18.04+ / Debian 10+ / Fedora 32+
- **メモリ**: 4GB以上推奨
- **ストレージ**: 少なくとも500MBの空き容量

### ダウンロード

<p>
  <a href="https://github.com/zhu1090093659/CodeConductor/releases">
    <img src="https://img.shields.io/badge/Download-Latest%20Release-32CD32?style=for-the-badge&logo=github&logoColor=white" alt="Download Latest Release" height="50">
  </a>
</p>

### インストール（デスクトップアプリ）

1. CodeConductor アプリをダウンロードしてインストール
2. 設定画面で AI プロバイダを設定（プロバイダにより Google ログインまたは API Key）
3. 会話を開始し、ワークスペースでタスクと成果物を進める

### ソースから実行（開発者）

```bash
npm install
npm start
```

### WebUI モード（開発者 / ヘッドレス）

```bash
npm run webui
npm run webui:remote
```

---

## コミュニティとサポート

- GitHub Discussions: https://github.com/zhu1090093659/CodeConductor/discussions
- Issues: https://github.com/zhu1090093659/CodeConductor/issues
- Releases: https://github.com/zhu1090093659/CodeConductor/releases

### コード貢献

IssueとPull Requestの提出を歓迎します！

1. このプロジェクトをFork
2. 機能ブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. Pull Requestを開く

---

## ライセンス

このプロジェクトは[Apache-2.0](LICENSE)ライセンスの下で公開されています。

---

## 貢献者

CodeConductorに貢献してくれたすべての開発者に感謝します！

<p align="center">
  <a href="https://github.com/zhu1090093659/CodeConductor/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=zhu1090093659/CodeConductor&max=20" alt="Contributors" />
  </a>
</p>

## スター履歴

<p align="center">
  <a href="https://www.star-history.com/#zhu1090093659/CodeConductor&Date" target="_blank">
    <img src="https://api.star-history.com/svg?repos=zhu1090093659/CodeConductor&type=Date" alt="GitHubスター傾向" width="600">
  </a>
</p>

<div align="center">

役に立ったらスターをお願いします。

[バグを報告](https://github.com/zhu1090093659/CodeConductor/issues) · [機能をリクエスト](https://github.com/zhu1090093659/CodeConductor/issues)

</div>
