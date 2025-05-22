/**
 * Chrome Agent Chrome拡張機能 - サイドパネルロジック
 */

// DOM要素
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const settingsButton = document.getElementById('settingsButton');

// APIキー
let apiKey = '';

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadAPIKey();
  setupEventListeners();
});

// APIキーを読み込む
function loadAPIKey() {
  // APIキーの読み込みをデバッグメッセージで表示
  addMessageToChat('system', 'APIキーを読み込み中...');
  
  chrome.storage.sync.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey && result.geminiApiKey.trim() !== '') {
      apiKey = result.geminiApiKey.trim();
      addMessageToChat('system', 'APIキーの読み込みに成功しました。');
    } else {
      // nullや空文字の場合もエラーとして認識
      apiKey = '';
      showAPIKeyMissingMessage();
    }
  });
}

// イベントリスナーを設定
function setupEventListeners() {
  sendButton.addEventListener('click', sendMessage);
  
  // IME入力状態を追跡するフラグ
  let isIMEComposing = false;
  
  // IMEの変換中かどうかを検出する
  userInput.addEventListener('compositionstart', () => {
    isIMEComposing = true;
  });
  
  userInput.addEventListener('compositionend', () => {
    isIMEComposing = false;
  });
  
  // キーボードイベント処理
  userInput.addEventListener('keydown', (event) => {
    // IME変換中は処理しない
    if (isIMEComposing) {
      return;
    }
    
    // EnterキーとShiftキーが押されていない場合はメッセージ送信
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  // 設定ボタンのイベントリスナー
  settingsButton.addEventListener('click', openSettings);
}

// 設定ページを開く
function openSettings() {
  // options.htmlを新しいタブで開く
  chrome.tabs.create({ url: 'options.html' });
}

// メッセージを送信
async function sendMessage() {
  const userMessage = userInput.value.trim();
  
  if (!userMessage) return;
  
  if (!apiKey) {
    showAPIKeyMissingMessage();
    return;
  }
  
  // ユーザーメッセージをチャットに追加
  addMessageToChat('user', userMessage);
  
  // 入力欄をクリア
  userInput.value = '';
  
  // ローディングインジケータを表示
  const loadingId = addLoadingIndicator();
  
  // 現在のタブのDOM構造を取得
  let currentTabInfo = null;
  try {
    currentTabInfo = await getCurrentTabInfo();
    addMessageToChat('system', '現在のページ情報を取得しました: ' + currentTabInfo.pageTitle);
  } catch (error) {
    console.error('タブ情報取得エラー:', error);
    addMessageToChat('system', 'タブ情報取得エラー: ' + error.message);
  }
  
  try {
    // Gemini APIリクエスト
    const response = await callGeminiAPI(userMessage, currentTabInfo);
    
    // ローディングインジケータを削除
    removeLoadingIndicator(loadingId);
    
    // スクリプト実行が含まれているか確認
    const scriptMatch = response.match(/```javascript\s*([\s\S]*?)\s*```/);
    if (scriptMatch && currentTabInfo) {
      // スクリプトが含まれている場合は実行の確認を表示
      addMessageToChat('ai', response);
      
      const scriptCode = scriptMatch[1].trim();
      const executeButton = createExecuteScriptButton(scriptCode, currentTabInfo.tabId);
      chatContainer.appendChild(executeButton);
    } else {
      // 通常の応答の場合
      addMessageToChat('ai', response);
    }
  } catch (error) {
    // ローディングインジケータを削除
    removeLoadingIndicator(loadingId);
    
    // エラーメッセージを表示
    addErrorMessageToChat(error.message);
    console.error('Gemini API error:', error);
  }
}

// Gemini APIを呼び出す
async function callGeminiAPI(message, tabInfo = null) {
  // APIリクエストのデバッグメッセージ
  addMessageToChat('system', 'Gemini APIにリクエストを送信中...');
  
  // 保存されている設定を読み込む
  let modelName = 'gemini-1.5-pro'; // デフォルト値（安定モデル）
  let temperature = 0.7;
  let maxOutputTokens = 8192; // 大きめの値に変更（長文対応）
  let apiVersion = 'v1'; // デフォルトはv1
  
  // 保存されている設定を取得
  await new Promise(resolve => {
    chrome.storage.sync.get([
      'geminiModel',
      'geminiTemperature',
      'geminiMaxTokens'
    ], (result) => {
      if (result.geminiModel) {
        modelName = result.geminiModel;
      }
      if (result.geminiTemperature) {
        temperature = result.geminiTemperature;
      }
      if (result.geminiMaxTokens) {
        maxOutputTokens = result.geminiMaxTokens;
      }
      resolve();
    });
  });
  
  // モデル名に基づいてAPIバージョンを決定
  if (modelName.includes('2.5') || modelName.includes('preview')) {
    // Gemini 2.5モデルやプレビュー版はv1betaを使用
    apiVersion = 'v1beta';
    addMessageToChat('system', `プレビューモデル用にv1beta APIを使用します`);
  } else {
    // 安定版はv1を使用
    apiVersion = 'v1';
  }
  
  // 完全なモデル名が指定されているか確認
  const validModelName = ensureValidModelName(modelName);
  
  // 最終的なURLを生成
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${validModelName}:generateContent`;
  
  addMessageToChat('system', `使用モデル: ${modelName}`);
  
  // リクエストデータの構築
  const parts = [];

  // システムプロンプトを追加
  parts.push({ 
    text: "あなたはChrome Agentというウェブページ分析アシスタントです。現在のページ内容を直接分析できます。以下のDOM情報を元に質問に答えてください。\n\n注意: 'ページを直接見ることができません'という表現は使わないでください。提供されたDOM情報を元に判断できます。ページに関する質問には具体的に答え、操作が必要な場合は実行可能なコードを提供してください。"
  });
  
  // ユーザーのメッセージを追加
  parts.push({ text: message });
  
  // タブ情報があれば追加
  if (tabInfo) {
    // 完全なDOM情報を送信 (サイズ制限なし)
    const formattedDOM = JSON.stringify(tabInfo.domStructure);
    
    parts.push({ 
      text: "\n\n現在開いているページの情報:\nタイトル: " + tabInfo.pageTitle + "\nURL: " + tabInfo.pageUrl + "\n\nページのDOM構造:\n" + formattedDOM + "\n\n上記の情報を元に質問に答えてください。ページの内容を綱羅し、質問に関連するテキストを抽出して回答してください。ページに関する操作が必要な場合は、次の形式でスクリプトコードを提供してください:\n\n```javascript\n// 操作の目的を説明\nスクリプトコード\n```\n\nスクリプトは「実行ボタン」をクリックすると実行されます。"
    });
  }
  
  const requestData = {
    contents: [{
      parts: parts
    }],
    generationConfig: {
      temperature: temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: maxOutputTokens
    }
  };
  
  const response = await fetch(`${url}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'APIリクエストに失敗しました');
  }
  
  const data = await response.json();
  
  // レスポンスが正しい形式か確認
  if (!data.candidates || !data.candidates[0] || 
      !data.candidates[0].content || 
      !data.candidates[0].content.parts || 
      !data.candidates[0].content.parts[0]) {
    console.error('不正な形式のレスポンス:', data);
    throw new Error('予期しないレスポンス形式でした');
  }
  
  // 完全なAPIレスポンスをログ出力（デバッグ用）
  console.log('APIレスポンス全体:', JSON.stringify(data));
  
  // レスポンスからテキストを抽出
  const text = data.candidates[0].content.parts[0].text;
  
  // トークンの切れに関するログ出力
  const finishReason = data.candidates[0].finishReason;
  if (finishReason === 'MAX_TOKENS') {
    console.warn('警告: 最大トークン数に達したため、応答が途中で切れました。maxOutputTokensを増やしてください。');
  }
  
  return text;
}

// メッセージをチャットに追加
function addMessageToChat(role, message) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', role);
  
  const textElement = document.createElement('div');
  textElement.classList.add('message-text');
  
  // 改行を維持
  const formattedMessage = message.replace(/\n/g, '<br>');
  textElement.innerHTML = formattedMessage;
  
  messageElement.appendChild(textElement);
  chatContainer.appendChild(messageElement);
  
  // スクロールを一番下に
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  // デバッグ用にコンソールに出力
  console.log(`[${role}] ${message}`);
}

// APIキーが不足している旨のメッセージを表示
function showAPIKeyMissingMessage() {
  const message = 'APIキーが設定されていません。設定ページからAPIキーを設定してください。';
  addErrorMessageToChat(message);
}

// エラーメッセージをチャットに追加
function addErrorMessageToChat(errorMessage) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', 'error');
  
  const textElement = document.createElement('div');
  textElement.classList.add('message-text');
  textElement.textContent = `エラー: ${errorMessage}`;
  
  messageElement.appendChild(textElement);
  chatContainer.appendChild(messageElement);
  
  // スクロールを一番下に
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ローディングインジケータを追加
function addLoadingIndicator() {
  const id = 'loading-' + Date.now();
  
  const loadingElement = document.createElement('div');
  loadingElement.classList.add('message', 'ai', 'loading');
  loadingElement.id = id;
  
  const loadingIndicator = document.createElement('div');
  loadingIndicator.classList.add('loading-indicator');
  loadingIndicator.innerHTML = '<div></div><div></div><div></div>';
  
  loadingElement.appendChild(loadingIndicator);
  chatContainer.appendChild(loadingElement);
  
  // スクロールを一番下に
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  return id;
}

// ローディングインジケータを削除
function removeLoadingIndicator(id) {
  const loadingElement = document.getElementById(id);
  if (loadingElement) {
    loadingElement.remove();
  }
}

// モデル名が有効か確認し、必要に応じて修正する
function ensureValidModelName(modelName) {
  // Gemini 2.5で日付が含まれていない場合、日付を追加
  if (modelName.includes('gemini-2.5') && !modelName.includes('-preview-')) {
    // 日付を含むフルモデル名に修正
    if (modelName === 'gemini-2.5-flash-preview') {
      return 'gemini-2.5-flash-preview-05-20'; // 最新の日付を追加
    }
    if (modelName === 'gemini-2.5-pro-preview') {
      return 'gemini-2.5-pro-preview-05-20'; // 最新の日付を追加
    }
  }
  
  // それ以外はそのまま返す
  return modelName;
}

/**
 * 現在のタブの情報を取得する
 * @returns {Promise<Object>} タブ情報
 */
async function getCurrentTabInfo() {
  return new Promise((resolve, reject) => {
    // バックグラウンドスクリプトにメッセージを送信
    chrome.runtime.sendMessage(
      { action: 'getCurrentTabInfo' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('タブ情報取得エラー: ' + chrome.runtime.lastError.message));
          return;
        }
        
        if (!response || response.error) {
          reject(new Error(response?.error || '不明なエラー'));
          return;
        }
        
        // 成功時はタブ情報を返す
        resolve({
          tabId: response.tabId || response.pageTabId,
          pageTitle: response.pageTitle,
          pageUrl: response.pageUrl,
          domStructure: response.domStructure
        });
      }
    );
  });
}

/**
 * スクリプト実行用のボタンを作成
 * @param {string} scriptCode 実行するJavaScriptコード
 * @param {number} tabId 実行対象タブID
 * @returns {HTMLElement} 実行ボタン要素
 */
function createExecuteScriptButton(scriptCode, tabId) {
  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('execute-button-container');
  
  const executeButton = document.createElement('button');
  executeButton.textContent = 'スクリプトを実行';
  executeButton.classList.add('execute-script-button');
  
  executeButton.addEventListener('click', async () => {
    try {
      // 実行ボタンを無効化
      executeButton.disabled = true;
      executeButton.textContent = '実行中...';
      
      // バックグラウンドスクリプトにスクリプト実行メッセージを送信
      chrome.runtime.sendMessage(
        { 
          action: 'executeScript',
          tabId: tabId,
          script: scriptCode
        },
        (response) => {
          if (chrome.runtime.lastError) {
            addMessageToChat('system', 'スクリプト実行エラー: ' + chrome.runtime.lastError.message);
            executeButton.textContent = '実行失敗';
            return;
          }
          
          if (!response || !response.success) {
            addMessageToChat('system', 'スクリプト実行エラー: ' + (response?.error || '不明なエラー'));
            executeButton.textContent = '実行失敗';
            return;
          }
          
          // 成功メッセージ
          addMessageToChat('system', 'スクリプトが正常に実行されました');
          executeButton.textContent = '実行済み';
          buttonContainer.remove(); // ボタンを削除
        }
      );
    } catch (error) {
      addMessageToChat('system', 'スクリプト実行エラー: ' + error.message);
      executeButton.textContent = '実行失敗';
    }
  });
  
  buttonContainer.appendChild(executeButton);
  return buttonContainer;
}
