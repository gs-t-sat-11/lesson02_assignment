/**
 * Chrome Agent Chrome拡張機能 - 設定ページロジック
 */

// DOM要素
const apiKeyInput = document.getElementById('apiKey');
const modelSelect = document.getElementById('modelSelect');
const maxTokensInput = document.getElementById('maxTokens');
const temperatureInput = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperatureValue');
const saveButton = document.getElementById('saveButton');
const refreshModelsButton = document.getElementById('refreshModelsButton');
const statusMessage = document.getElementById('statusMessage');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadSavedSettings();
  setupEventListeners();
});

// 保存済みの設定を読み込む
function loadSavedSettings() {
  chrome.storage.sync.get([
    'geminiApiKey',
    'geminiModel',
    'geminiMaxTokens',
    'geminiTemperature'
  ], (result) => {
    // APIキー
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
    
    // モデル
    if (result.geminiModel) {
      // モデル選択肢に存在するか確認
      const modelExists = Array.from(modelSelect.options).some(option => option.value === result.geminiModel);
      if (modelExists) {
        modelSelect.value = result.geminiModel;
      } else {
        // モデルが見つからない場合は安定モデルにフォールバック
        modelSelect.value = 'gemini-1.5-pro';
      }
    } else {
      // デフォルトは安定モデル
      modelSelect.value = 'gemini-1.5-pro';
    }
    
    // 最大トークン数
    if (result.geminiMaxTokens) {
      maxTokensInput.value = result.geminiMaxTokens;
    }
    
    // 温度
    if (result.geminiTemperature) {
      const temp = result.geminiTemperature * 10;
      temperatureInput.value = temp;
      temperatureValue.textContent = result.geminiTemperature.toFixed(1);
    }
  });
}

// イベントリスナーを設定
function setupEventListeners() {
  saveButton.addEventListener('click', saveSettings);
  refreshModelsButton.addEventListener('click', fetchAvailableModels);
  
  // temperatureスライダーの変更時に表示を更新
  temperatureInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value) / 10;
    temperatureValue.textContent = value.toFixed(1);
  });
}

// 設定を保存
function saveSettings() {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const maxTokens = parseInt(maxTokensInput.value, 10);
  const temperature = parseFloat(temperatureInput.value) / 10;
  
  if (!apiKey) {
    showStatus('エラー: APIキーを入力してください', 'error');
    return;
  }
  
  // 全ての設定を保存
  chrome.storage.sync.set({
    geminiApiKey: apiKey,
    geminiModel: model,
    geminiMaxTokens: maxTokens,
    geminiTemperature: temperature
  }, () => {
    showStatus('設定が正常に保存されました', 'success');
  });
}

// ステータスメッセージを表示
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = type;
  
  // 3秒後にメッセージを消す
  setTimeout(() => {
    statusMessage.textContent = '';
    statusMessage.className = '';
  }, 3000);
}

// 利用可能なモデル一覧を取得
async function fetchAvailableModels() {
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    showStatus('エラー: APIキーを入力してください', 'error');
    return;
  }
  
  showStatus('モデル一覧を取得中...', 'info');
  
  try {
    // v1betaエンドポイントからモデル一覧を取得
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'APIリクエストに失敗しました');
    }
    
    const data = await response.json();
    
    if (data.models && data.models.length > 0) {
      // 現在の選択を記憶
      const currentSelection = modelSelect.value;
      
      // モデル選択リストをクリア
      modelSelect.innerHTML = '';
      
      // モデル一覧を取得して選択肢を追加
      const generativeModels = data.models.filter(model => 
        model.name.includes('gemini') && 
        model.supportedGenerationMethods.includes('generateContent')
      );
      
      // モデルをソート（新しいものが先）
      generativeModels.sort((a, b) => {
        // 2.5モデルを最上部に
        if (a.name.includes('2.5') && !b.name.includes('2.5')) return -1;
        if (!a.name.includes('2.5') && b.name.includes('2.5')) return 1;
        // 1.5モデルを次に
        if (a.name.includes('1.5') && !b.name.includes('1.5')) return -1;
        if (!a.name.includes('1.5') && b.name.includes('1.5')) return 1;
        return 0;
      });
      
      generativeModels.forEach(model => {
        const modelName = model.name.split('/').pop(); // models/gemini-1.5-pro から gemini-1.5-pro を抽出
        const option = document.createElement('option');
        option.value = modelName;
        
        // 分かりやすい表示名を生成
        let displayName = modelName;
        if (modelName.includes('2.5')) {
          displayName = `${modelName} (プレビュー版)`;
        } else if (modelName.includes('1.5')) {
          displayName = `${modelName} (安定版)`;
        } else {
          displayName = `${modelName}`;
        }
        
        option.textContent = displayName;
        modelSelect.appendChild(option);
      });
      
      // モデルが存在する場合は元の選択を維持
      const modelExists = Array.from(modelSelect.options).some(option => option.value === currentSelection);
      if (modelExists) {
        modelSelect.value = currentSelection;
      } else if (modelSelect.options.length > 0) {
        // 無ければ最初のモデルを選択
        modelSelect.selectedIndex = 0;
      }
      
      showStatus(`${generativeModels.length}個の利用可能モデルを取得しました`, 'success');
    } else {
      showStatus('利用可能なモデルが見つかりませんでした', 'error');
    }
  } catch (error) {
    console.error('APIリクエストエラー:', error);
    showStatus(`エラー: ${error.message}`, 'error');
  }
}
