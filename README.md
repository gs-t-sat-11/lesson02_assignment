# ① 課題名

Chrome Agent

## ② 課題内容（どんな作品か）

- Chrome Extension として Chrome に常駐する AI エージェント。
- LLM には Gemini を使用。

## ③ アプリのデプロイ URL

- Chrome Extension のため Github Pages では動作しません。
- こちらの情報を参照して動作確認を行なってください。
- https://github.com/gs-t-sat-11/lesson02_assignment/blob/main/chrome_agent_extension/README.md

## ④ アプリのログイン用 ID または Password（ある場合）

- なし

## ⑤ 工夫した点・こだわった点

- Gemini の API を使用。

## ⑥ 難しかった点・次回トライしたいこと（又は機能）

- 現在開いているタブで表示しているページの DOM を Gemini に送信し、「ボタンを押す」などの操作の JavaScript を取得して実行できる仕組みを検討しているが、まだうまく動いていない。
- DOM を送信するのは大きすぎるので Playwright のようなシンプルな構造を API に渡すような作りにしたい。

## ⑦ フリー項目（感想、シェアしたいこと等なんでも）

- 毎回違うアプリを作るのではなく、授業に関するトピックはカバーしつつ、自分の作りたいアプリをブラッシュアップする形で進めていこうと思います。
