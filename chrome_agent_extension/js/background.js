/**
 * Chrome Agent Chrome拡張機能 - バックグラウンドスクリプト
 */

// 拡張機能のアイコンがクリックされたときにサイドパネルを開く
chrome.action.onClicked.addListener((tab) => {
  // サイドパネルを開く
  chrome.sidePanel.open({ tabId: tab.id });
});

// 拡張機能のインストール/更新時に実行される
chrome.runtime.onInstalled.addListener(() => {
  // デフォルトのサイドパネルを設定
  chrome.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled: true
  });
});

// サイドパネルからのメッセージを処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('バックグラウンドがメッセージを受信:', request);
  
  // 現在のタブにメッセージを転送する処理
  if (request.action === 'getCurrentTabInfo') {
    // 現在のアクティブなタブを取得
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ error: 'アクティブなタブが見つかりません' });
        return;
      }
      
      const activeTab = tabs[0];
      
      try {
        console.log('コンテンツスクリプトを挿入します: tabId=' + activeTab.id);
        
        // 先にコンテンツスクリプトを確実に挿入
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['js/content.js']
        }).catch(error => {
          console.error('コンテンツスクリプトの挿入エラー:', error);
          // エラーは無視する - 実行権限の関係でエラーになる場合がある
        });
        
        // DOM取得を通信とは別に直接実行して取得する
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            try {
              // ページコンテンツを取得する関数
              function getPageContent() {
                // ページのテキスト全体を取得
                const allText = document.body.innerText;
                
                // 主要なコンテナを優先的に取得するセレクター配列
                const mainContentSelectors = [
                  // note.comと一般的なブログのセレクター
                  '.o-articleBody', '.o-articleContainer', '.note-common-styles__textnote-body',
                  '.article-content', '.post-content', '.entry-content',
                  '.post__content', '.post-body', '.article__content', '.article__body',
                  // 一般的なセレクター
                  'article', 'main', '.main', '.content', '#content',
                  '.post', '.article', '.blog-post',
                  // Note.com特有のセレクター
                  '[role="article"]', '.note-common-styles__container'
                ];
                
                // すべてのセレクターで要素を探す
                let mainContentElement = null;
                for (const selector of mainContentSelectors) {
                  const element = document.querySelector(selector);
                  if (element && element.innerText.trim().length > 100) { // テキストが十分にある要素をチェック
                    mainContentElement = element;
                    break;
                  }
                }
                
                // 見出しを取得
                const headings = [];
                document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
                  if (heading.innerText.trim()) {
                    headings.push({
                      level: parseInt(heading.tagName.substring(1)),
                      text: heading.innerText.trim()
                    });
                  }
                });
                
                // 画像の説明テキストを取得
                const images = [];
                document.querySelectorAll('img[alt]:not([alt=""])').forEach(img => {
                  if (img.alt && img.alt.trim() && img.width > 100 && img.height > 100) { // 十分なサイズの画像のみ
                    images.push({
                      alt: img.alt.trim(),
                      src: img.src
                    });
                  }
                });
                
                // リンクテキストを取得
                const links = [];
                document.querySelectorAll('a[href]:not([href=""])').forEach(link => {
                  if (link.innerText.trim() && !link.href.startsWith('javascript:')) {
                    links.push({
                      text: link.innerText.trim(),
                      href: link.href
                    });
                  }
                });
                
                // メタデータを取得
                const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
                const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';
                
                return {
                  mainContent: mainContentElement ? mainContentElement.innerText : allText,
                  headings,
                  images,
                  links,
                  metaDescription,
                  metaKeywords,
                  fullText: allText
                };
              }
              
              // ページの基本情報を取得
              const pageInfo = {
                success: true,
                pageTitle: document.title,
                pageUrl: window.location.href,
                content: getPageContent(),
                domStructure: {
                  tagName: 'body',
                  id: document.body.id || null,
                  className: document.body.className || null,
                  text: document.body.innerText.slice(0, 1000) + '...' // テキストサンプルを取得
                }
              };
              
              // note.com特有の情報を取得
              if (window.location.href.includes('note.com')) {
                // 著者情報
                const authorElement = document.querySelector('.o-authorNoteInfo__name, .o-noteContentText__author');
                if (authorElement) {
                  pageInfo.author = authorElement.innerText.trim();
                }
                
                // 公開日や更新日
                const dateElement = document.querySelector('.o-noteContentText__date, time');
                if (dateElement) {
                  pageInfo.publishDate = dateElement.innerText.trim() || dateElement.getAttribute('datetime');
                }
              }
              
              return pageInfo;
            } catch (error) {
              return { 
                success: false, 
                error: error.message,
                pageTitle: document.title,
                pageUrl: window.location.href
              };
            }
          }
        });
        
        if (results && results[0] && results[0].result) {
          sendResponse(results[0].result);
        } else {
          // 直接実行で失敗した場合は引き続きメッセージ送信を試みる
          console.log('直接実行失敗、メッセージ送信を試みます');
          
          // コンテンツスクリプトにメッセージを送信
          chrome.tabs.sendMessage(
            activeTab.id, 
            { action: 'getDOMStructure' }, 
            (response) => {
              if (chrome.runtime.lastError) {
                sendResponse({ 
                  success: false, 
                  error: chrome.runtime.lastError.message,
                  pageTitle: activeTab.title,
                  pageUrl: activeTab.url,
                  fallbackContent: 'DOM情報を取得できませんでした。'
                });
                return;
              }
              sendResponse(response);
            }
          );
        }
      } catch (error) {
        console.error('スクリプト実行エラー:', error);
        sendResponse({ error: error.message });
      }
    });
    
    return true; // 非同期レスポンスを示す
  }
  
  // スクリプト実行リクエストの処理
  if (request.action === 'executeScript' && request.tabId && request.script) {
    // レスポンスが送信されたか追跡するフラグ
    let responseHandled = false;
    
    // 安全策としてタイムアウトをセット
    const responseTimeout = setTimeout(() => {
      if (!responseHandled) {
        responseHandled = true;
        sendResponse({ success: false, error: 'タイムアウト: スクリプトの実行が完了しませんでした。' });
      }
    }, 10000);
    
    try {
      console.log('スクリプト実行開始: tabId=' + request.tabId);
      
      // まずコンテンツスクリプトがロードされているか確認/振述
      chrome.scripting.executeScript({
        target: { tabId: request.tabId },
        files: ['js/content.js']
      }, () => {
        // エラーは無視する - コンテンツスクリプトは既にロードされている可能性がある
        
        // 分割してスクリプトを実行する方法
        // スクリプトを直接コンテンツに挿入する
        chrome.scripting.executeScript({
          target: { tabId: request.tabId },
          func: (scriptCode) => {
            try {
              // スクリプトを直接追加する
              const scriptElement = document.createElement('script');
              scriptElement.textContent = scriptCode;
              scriptElement.id = 'chrome-agent-script-' + Date.now();
              document.head.appendChild(scriptElement);
              
              // 実行後に要素を削除しておく
              setTimeout(() => {
                const element = document.getElementById(scriptElement.id);
                if (element) {
                  element.remove();
                }
              }, 100);
              
              return { success: true, message: 'スクリプトが正常に実行されました' };
            } catch (error) {
              console.error('スクリプト追加エラー:', error);
              return { error: error.message };
            }
          },
          args: [request.script]
        }, (results) => {
          // タイムアウトをクリア
          clearTimeout(responseTimeout);
          
          if (responseHandled) {
            return; // 既にレスポンスが送信済み
          }
          
          responseHandled = true;
          
          if (chrome.runtime.lastError) {
            console.error('スクリプト実行中にエラーが発生しました:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          
          if (results && results[0]) {
            if (results[0].result && results[0].result.error) {
              console.error('スクリプト実行中にエラーが発生しました:', results[0].result.error);
              sendResponse({ success: false, error: results[0].result.error });
            } else {
              console.log('スクリプトが正常に実行されました');
              sendResponse({ success: true, result: results[0].result });
            }
          } else {
            console.log('スクリプトが実行されましたが、結果がありません');
            sendResponse({ success: true });
          }
        });
      });
      
    } catch (error) {
      clearTimeout(responseTimeout);
      
      if (!responseHandled) {
        responseHandled = true;
        console.error('スクリプト実行エラー:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    
    return true; // 非同期レスポンスを示す
  }
});
