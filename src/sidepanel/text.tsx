/**
 * Everything the side panel says, per language. Strings that carry a value are
 * functions, so word order can differ between languages. The Settings page is
 * not translated; the language setting itself is named in each language so it
 * can be found from any of them.
 */
import type { ReactNode } from 'react';

import type { Language } from '../shared/language';

export interface PanelText {
  newTask: string;
  settings: string;
  idleTitle: string;
  composerLabel: string;
  placeholder: string;
  placeholderWorking: string;
  listening: string;
  send: string;
  stop: string;
  speak: string;
  stopDictation: string;
  cancelDictation: string;
  aiSettings: string;
  requestsGoTo: (origin: string) => string;
  you: string;
  working: string;
  dismiss: string;
  pageAccessButton: string;
  pageAccessTitle: string;
  setupTitle: string;
  setupLead: string;
  openSettings: string;
  badEndpointTitle: string;
  badEndpointLead: (endpoint: string) => ReactNode;
  accessTitle: string;
  accessLead: string;
  allowAccess: (host: string) => string;
  checkAgain: string;
}

const EN: PanelText = {
  newTask: 'New task',
  settings: 'Settings',
  idleTitle: 'What should Arlo work on?',
  composerLabel: 'What should Arlo do?',
  placeholder: 'Ask Arlo to build something…',
  placeholderWorking: 'Arlo is working…',
  listening: 'Listening…',
  send: 'Send',
  stop: 'Stop',
  speak: 'Speak',
  stopDictation: 'Stop dictation',
  cancelDictation: 'Cancel dictation',
  aiSettings: 'AI settings →',
  requestsGoTo: (origin) => `Requests go directly to ${origin}`,
  you: 'You',
  working: 'Working…',
  dismiss: 'Dismiss',
  pageAccessButton: 'Let Arlo read pages without a toolbar click',
  pageAccessTitle:
    'Otherwise Chrome only lets Arlo read the page for one toolbar click, until you navigate',
  setupTitle: 'Connect a model to start',
  setupLead:
    'Arlo needs an OpenAI-compatible endpoint and a key. Add one in settings and it will be ready here.',
  openSettings: 'Open settings',
  badEndpointTitle: 'That endpoint can’t be used',
  badEndpointLead: (endpoint) => (
    <>
      Arlo can only talk to an <code>http://</code> or <code>https://</code> address. This profile’s
      Base URL is {endpoint || 'empty'}.
    </>
  ),
  accessTitle: 'Allow Arlo to reach your model',
  accessLead:
    'Chrome asks before an extension may contact a site. Arlo needs this for the endpoint your profile points at, and nothing else.',
  allowAccess: (host) => `Allow access to ${host}`,
  checkAgain: 'Check again',
};

const ZH_TW: PanelText = {
  newTask: '新任務',
  settings: '設定',
  idleTitle: '要讓 Arlo 處理什麼？',
  composerLabel: '要讓 Arlo 做什麼？',
  placeholder: '告訴 Arlo 你想做什麼…',
  placeholderWorking: 'Arlo 正在處理…',
  listening: '聆聽中…',
  send: '送出',
  stop: '停止',
  speak: '語音輸入',
  stopDictation: '停止語音輸入',
  cancelDictation: '取消語音輸入',
  aiSettings: 'AI 設定 →',
  requestsGoTo: (origin) => `請求會直接送到 ${origin}`,
  you: '你',
  working: '處理中…',
  dismiss: '關閉',
  pageAccessButton: '讓 Arlo 不用點工具列就能讀取頁面',
  pageAccessTitle: '否則 Chrome 只允許 Arlo 在你點一次工具列後讀取頁面，換頁就失效',
  setupTitle: '先連接一個模型',
  setupLead: 'Arlo 需要一個相容 OpenAI 的端點和金鑰。在設定中新增後，這裡就能使用。',
  openSettings: '開啟設定',
  badEndpointTitle: '無法使用這個端點',
  badEndpointLead: (endpoint) => (
    <>
      Arlo 只能連到 <code>http://</code> 或 <code>https://</code> 開頭的網址。這個設定檔的 Base URL
      是 {endpoint || '空白'}。
    </>
  ),
  accessTitle: '允許 Arlo 連到你的模型',
  accessLead:
    'Chrome 會先詢問，擴充功能才能連線到某個網站。Arlo 只需要連到你的設定檔所指向的端點，不會連到其他地方。',
  allowAccess: (host) => `允許存取 ${host}`,
  checkAgain: '重新檢查',
};

const JA: PanelText = {
  newTask: '新しいタスク',
  settings: '設定',
  idleTitle: 'Arlo に何をさせますか？',
  composerLabel: 'Arlo にしてほしいこと',
  placeholder: 'Arlo に作業を頼む…',
  placeholderWorking: 'Arlo が作業中…',
  listening: '聞いています…',
  send: '送信',
  stop: '停止',
  speak: '音声入力',
  stopDictation: '音声入力を止める',
  cancelDictation: '音声入力をキャンセル',
  aiSettings: 'AI 設定 →',
  requestsGoTo: (origin) => `リクエストは ${origin} に直接送られます`,
  you: 'あなた',
  working: '作業中…',
  dismiss: '閉じる',
  pageAccessButton: 'ツールバーをクリックしなくてもページを読めるようにする',
  pageAccessTitle:
    'そうしないと、Chrome はツールバーを 1 回クリックしてから別のページへ移動するまでしか Arlo にページを読ませません',
  setupTitle: 'まずモデルを接続してください',
  setupLead:
    'Arlo には OpenAI 互換のエンドポイントとキーが必要です。設定で追加すると、ここで使えるようになります。',
  openSettings: '設定を開く',
  badEndpointTitle: 'このエンドポイントは使えません',
  badEndpointLead: (endpoint) => (
    <>
      Arlo は <code>http://</code> または <code>https://</code> のアドレスにのみ接続できます。この
      プロファイルの Base URL は {endpoint || '空'} です。
    </>
  ),
  accessTitle: 'Arlo がモデルに接続することを許可',
  accessLead:
    'Chrome は、拡張機能がサイトに接続する前に確認します。Arlo が必要とするのは、プロファイルが指すエンドポイントだけです。',
  allowAccess: (host) => `${host} へのアクセスを許可`,
  checkAgain: '再確認',
};

const TEXT: Record<Language, PanelText> = { en: EN, 'zh-TW': ZH_TW, ja: JA };

export function panelText(language: Language): PanelText {
  return TEXT[language];
}
