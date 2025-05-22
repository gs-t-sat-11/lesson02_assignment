/**
 * Chrome Agent Chrome拡張機能 - コンテンツスクリプト
 * 現在のページのDOM構造を取得し、サイドパネルとの通信を行う
 */

// サイドパネルからのメッセージを受け取る
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('コンテンツスクリプトがメッセージを受信:', request);
  
  if (request.action === 'getDOMStructure') {
    // ページのDOM構造を取得して返す
    const domStructure = getSimplifiedDOMStructure(document.body);
    const pageTitle = document.title;
    const pageUrl = window.location.href;
    
    sendResponse({
      success: true,
      pageTitle: pageTitle,
      pageUrl: pageUrl,
      domStructure: domStructure
    });
    return true; // 非同期レスポンスを示す
  }
  
  if (request.action === 'executeScript') {
    try {
      // 文字列としてのスクリプトを実行
      console.log('スクリプトを実行:', request.script);
      
      // Function constructorを使用して安全にスクリプトを実行
      const scriptFunction = new Function(request.script);
      const result = scriptFunction();
      
      sendResponse({
        success: true,
        result: result || '実行完了'
      });
    } catch (error) {
      console.error('スクリプト実行エラー:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
    return true; // 非同期レスポンスを示す
  }
});

/**
 * シンプル化したDOM構造を取得
 * @param {HTMLElement} element 解析する要素
 * @param {number} depth 現在の深さ（再帰用）
 * @param {number} maxDepth 最大深さ
 * @return {Object} シンプル化されたDOM構造
 */
function getSimplifiedDOMStructure(element, depth = 0, maxDepth = 8) {
  if (!element || depth > maxDepth) {
    return null;
  }
  
  // 隠れた要素は低い深さではスキップしないように修正
  // メインコンテンツは表示されていなくてもDOMに存在する場合がある
  let skipHidden = true;
  if (depth < 2) {
    skipHidden = false; // 最初の数層は非表示要素も取得
  } else if (element.tagName === 'MAIN' || element.id === 'main' || 
             element.className.includes('main') || 
             element.tagName === 'ARTICLE' || 
             element.tagName === 'SECTION') {
    skipHidden = false; // 重要なコンテナは非表示要素も取得
  }
  
  if (skipHidden) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return null;
    }
  }
  
  // 基本情報を収集
  const result = {
    tagName: element.tagName.toLowerCase(),
    id: element.id || null,
    className: element.className || null,
    type: element.type || null,
    text: getElementText(element),
    children: []
  };
  
  // 重要な属性を追加
  // data-*属性を取得
  const dataAttributes = {};
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-')) {
      dataAttributes[attr.name] = attr.value;
    }
    // 重要な属性を個別に取得
    if (['role', 'aria-label', 'title', 'name'].includes(attr.name)) {
      result[attr.name] = attr.value;
    }
  }
  
  if (Object.keys(dataAttributes).length > 0) {
    result.dataAttributes = dataAttributes;
  }
  
  // 入力要素の場合は値を取得
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
    result.value = element.value;
    result.placeholder = element.placeholder || null;
  }
  
  // a要素の場合はhrefを取得
  if (element.tagName === 'A') {
    result.href = element.href;
    result.target = element.target || null;
  }
  
  // img要素の場合はsrcとaltを取得
  if (element.tagName === 'IMG') {
    result.src = element.src;
    result.alt = element.alt;
  }
  
  // 要素の大きさと位置情報を取得
  if (depth <= 5) { // 上層の要素のみ位置情報を取得
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) { // 表示されている要素のみ
      result.position = {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visible: isElementInViewport(element)
      };
    }
  }
  
  // 重要なコンテナ要素か確認
  const isImportantContainer = (
    element.tagName === 'MAIN' || 
    element.tagName === 'ARTICLE' || 
    element.tagName === 'SECTION' || 
    element.id === 'main' || 
    element.id === 'content' || 
    (element.className && (
      element.className.includes('main') || 
      element.className.includes('content') || 
      element.className.includes('repository') || 
      element.className.includes('repo')
    ))
  );
  
  // 子要素を処理
  const childNodes = element.children;
  // 重要なコンテナはより多くの子要素を取得
  const maxChildren = isImportantContainer ? 100 : 50;
  let processedChildren = 0;
  
  for (let i = 0; i < childNodes.length && processedChildren < maxChildren; i++) {
    const child = childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childStructure = getSimplifiedDOMStructure(child, depth + 1, maxDepth);
      if (childStructure) {
        result.children.push(childStructure);
        processedChildren++;
      }
    }
  }
  
  if (childNodes.length > maxChildren) {
    result.children.push({
      tagName: '...',
      text: `(残り${childNodes.length - maxChildren}個の要素は省略されました)`
    });
  }
  
  return result;
}

/**
 * 要素がビューポート内に表示されているか確認
 * @param {HTMLElement} element 確認する要素
 * @return {boolean} 表示されているかどうか
 */
function isElementInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * 要素のテキスト内容を取得
 * @param {HTMLElement} element 
 * @return {string} テキスト内容
 */
function getElementText(element) {
  // テキストノードのみを抽出
  let text = '';
  
  // input, textareaなどは値を取得
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    text = element.value || '';
  } else if (element.tagName === 'SELECT') {
    // SELECT要素の場合は選択されたオプションのテキストを取得
    if (element.selectedIndex >= 0 && element.options[element.selectedIndex]) {
      text = element.options[element.selectedIndex].text;
    }
  } else {
    // テキストノードを収集
    // まず直接の子テキストを取得
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    
    // 直接のテキストが空の場合、textContentから取得する
    if (!text.trim() && element.textContent) {
      // ボタンやリンクなど重要要素かつテキストが少ない場合は全て取得
      if (element.tagName === 'BUTTON' || element.tagName === 'A' || 
          element.tagName === 'H1' || element.tagName === 'H2' || 
          element.tagName === 'H3' || element.tagName === 'LI' ||
          element.tagName === 'LABEL' || element.tagName === 'SUMMARY') {
        text = element.textContent;
      }
      // それ以外は省略を考慮
      else if (element.textContent.length < 500) {
        text = element.textContent;
      } else {
        // 長いテキストは省略
        text = element.textContent.substring(0, 497) + '...';
      }
    }
  }
  
  // テキストを整形（空白を除去）
  text = text.trim().replace(/\s+/g, ' ');
  
  // 長すぎるテキストは省略する
  const maxLength = 500; // 長めに設定
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

// 初期化メッセージを送信
console.log('Gemini連携拡張機能のコンテンツスクリプトが読み込まれました');
