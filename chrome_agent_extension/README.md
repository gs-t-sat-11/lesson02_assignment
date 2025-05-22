# Chrome Agent Chrome 拡張機能

- ※Chrome Extension のため GitHub Pages では動作しません。
- Gemini とやりとりできる Chrome 拡張機能です。ブラウザのサイドパネルで Gemini AI と対話することができます。

## 機能

- ブラウザのサイドパネルで Gemini AI とチャット形式で対話
- API キーの設定ページ
- テキスト入出力によるコミュニケーション

## インストール方法

0. ソースコードを GitHub からダウンロードしてください
1. Chrome 拡張機能ページ（`chrome://extensions/`）を開きます
2. 画面右上の「デベロッパーモード」を有効にします
3. 画面左上の「パッケージ化されていない拡張機能を読み込む」をクリックします
4. この拡張機能のディレクトリ(chrome_agent_extension)を選択します

## 使い方

1. 拡張機能をインストール後、設定ページから Gemini API キーを設定、モデルの選択、maximum_output_tokens の設定をします
   - Chrome の右上の拡張機能を選択するボタンを押下し、リストから Chrome Agent を選択してサイドパネルを開いてください。
     サイドパネルのヘッダー部分の右側にある歯車アイコンをクリックして設定画面を選択してください。
2. 設定方法
   - 後述の API キーを取得し、その API キーを入力してください。
   - Gemini モデルから Gemini 2.5 Flash Preview を選択してください。
   - maximum_output_tokens に 8192 を設定してください。
   - 設定したら保存ボタンを押してください。
   - 保存後、一度サイドパネルを閉じて、再度開き直し、「API キーの読み込みに成功しました。」と表示されることを確認してください。
3. 記事やニュースサイトのページに遷移してください。
   - 例：https://zenn.dev/hackathons/google-cloud-japan-ai-hackathon-vol2
4. テキスト入力欄にメッセージを入力し、送信ボタンをクリックするか Enter キーを押すと Gemini に送信されます
   - 「このページの概要を教えてください。」などの質問をすると開いているページについて回答してくれます。
   - 開発中のためまだ、十分な回答が得られない場合があります。
   - 設定画面や Chrome 拡張のページで実行すると、DOM にアクセスできないため、適当な返答が返ってきます。

## API キーの取得方法

Gemini API キーは、Google AI Studio から取得できます：

1. [Google AI Studio](https://makersuite.google.com/app/apikey)にアクセスします
2. Google アカウントでログインします
3. 「API キーを取得」をクリックして API キーを生成します

## ライセンス

この拡張機能は個人利用・学習目的で作成されています。
