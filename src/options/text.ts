/**
 * Everything the Settings page says, per language. Strings that carry a value
 * are functions, so word order can differ between languages. Product and
 * protocol names (Arlo, OpenAI Responses, Base URL, API key) stay as they are.
 */
import { useLanguage } from '../shared/language-context';
import type { Language } from '../shared/language';
import type { ProfileError } from '../shared/settings';
import type { ThemePreference } from '../shared/theme';

type DiscoveryStatus = 'available' | 'unavailable' | 'failed' | 'untested';
type ContractKey = 'anthropic-messages' | 'openai-responses' | 'openai-chat-completions' | 'gemini';

export interface OptionsText {
  // Page
  brandSuffix: string;
  saved: string;
  title: string;
  intro: string;
  dismiss: string;
  // Appearance
  appearanceTitle: string;
  appearanceSub: string;
  themeLegend: string;
  theme: Record<ThemePreference, string>;
  // Language
  languageTitle: string;
  languageSub: string;
  languageLegend: string;
  // Agent
  agentTitle: string;
  agentSub: string;
  maxTurnsLabel: string;
  maxTurnsHint: (min: number, max: number) => string;
  // Voice input card
  voiceTitle: string;
  voiceSub: string;
  autoSendLabel: string;
  autoSendHint: string;
  allowMicrophone: string;
  micAllowed: string;
  micNotFound: string;
  micDenied: string;
  // AI connections
  connectionsTitle: string;
  connectionsSub: string;
  addProfile: string;
  profilesNav: string;
  noProfiles: string;
  noModelSelected: string;
  defaultBadge: string;
  chooseContractTitle: string;
  chooseContractSub: string;
  contractDescription: Record<ContractKey, string>;
  newProfile: string;
  untitledProfile: string;
  unsaved: string;
  discovery: Record<DiscoveryStatus, string>;
  profileName: string;
  apiContract: string;
  anthropicTitle: string;
  anthropicBody: string;
  baseUrl: string;
  requestsGoTo: string;
  endpointInvalid: string;
  apiKey: string;
  apiKeyHint: string;
  hide: string;
  reveal: string;
  clear: string;
  rememberKey: string;
  model: string;
  modelHint: string;
  refreshModels: string;
  checking: string;
  discoveredModels: string;
  chooseDiscovered: (count: number) => string;
  voiceModel: string;
  voiceModelOptional: string;
  voiceModelHintGemini: string;
  voiceModelHintOpenAI: string;
  suggestedVoiceModels: string;
  chooseSuggested: (count: number) => string;
  dataDestination: string;
  dataDestinationBody: (origin: string | null) => string;
  audioToo: string;
  technicalDetails: string;
  endpoint: string;
  httpStatus: string;
  requestId: string;
  response: string;
  deleteTitle: (name: string) => string;
  newDefaultProfile: string;
  blockedUntilCreated: string;
  deleteProfile: string;
  cancel: string;
  saveProfile: string;
  makeDefault: string;
  duplicate: string;
  delete: string;
  chooseOrAdd: string;
  // Messages
  confirmDiscard: string;
  confirmChangeContract: string;
  keyKeptForContract: string;
  keyClearedOriginChanged: string;
  confirmInsecure: (origin: string) => string;
  confirmDataOrigin: (origin: string) => string;
  profileError: Record<ProfileError, string>;
  duplicateName: string;
  profileSaved: string;
  chromeWouldNotRequest: (pattern: string, reason: string) => string;
  permissionNotGranted: string;
  needBaseUrlToRefresh: string;
  modelsLoaded: (count: number) => string;
  modelListUnavailable: string;
  saveBeforeDefault: string;
  nowDefault: (name: string) => string;
  copySuffix: string;
  copyNotice: string;
  saveBeforeDelete: string;
  cancelDraftInstead: string;
  profileDeleted: string;
  profileDeletedNone: string;
}

const EN: OptionsText = {
  brandSuffix: 'Settings',
  saved: 'Saved',
  title: 'Settings',
  intro:
    'Arlo runs its agent inside the side panel. Give it a model to think with — there is nothing else to set up.',
  dismiss: 'Dismiss',
  appearanceTitle: 'Appearance',
  appearanceSub:
    'Applies to Settings and to the side panel, immediately. System follows whatever this computer is set to.',
  themeLegend: 'Theme',
  theme: { system: 'System', light: 'Light', dark: 'Dark' },
  languageTitle: 'Language 語言 / 言語',
  languageSub:
    'The wording of Settings and the side panel, its suggested tasks, and the language Arlo replies in unless you write to it in another one.',
  languageLegend: 'Language',
  agentTitle: 'Agent',
  agentSub:
    'How many steps Arlo may take to answer one message. Each model call, including the ones that read or open a page, counts as a step. Raise it for long tasks; lower it to cap cost.',
  maxTurnsLabel: 'Max turns',
  maxTurnsHint: (min, max) => `${min} to ${max}. Default 25.`,
  voiceTitle: 'Voice input',
  voiceSub:
    'Turn it on per profile under AI connections by choosing a Voice model. Then the chat box gets a microphone button, and your words appear as you speak.',
  autoSendLabel: 'Send right after I stop speaking',
  autoSendHint:
    'Off by default: the transcript lands in the chat box so you can check it before Arlo acts on it.',
  allowMicrophone: 'Allow microphone',
  micAllowed: 'Microphone allowed. The panel can now listen.',
  micNotFound: 'No microphone was found.',
  micDenied:
    'Chrome did not allow the microphone. Check the site settings for this extension and try again.',
  connectionsTitle: 'AI connections',
  connectionsSub:
    'Arlo sends each task directly to the default profile. Profiles never switch automatically.',
  addProfile: 'Add profile',
  profilesNav: 'AI profiles',
  noProfiles: 'No profiles yet',
  noModelSelected: 'No model selected',
  defaultBadge: 'Default',
  chooseContractTitle: 'Choose an API contract',
  chooseContractSub: 'The request and authentication format stays explicit.',
  contractDescription: {
    'anthropic-messages': 'Native Claude Messages API',
    'openai-responses': 'OpenAI Responses API and compatible gateways',
    'openai-chat-completions': 'OpenAI Chat Completions and compatible gateways',
    gemini: 'Gemini API through its OpenAI-compatible endpoint',
  },
  newProfile: 'New profile',
  untitledProfile: 'Untitled profile',
  unsaved: 'Unsaved changes',
  discovery: {
    available: 'Models loaded',
    unavailable: 'Model list unavailable',
    failed: 'Check failed',
    untested: 'Untested',
  },
  profileName: 'Profile name',
  apiContract: 'API contract',
  anthropicTitle: 'Arlo cannot drive this contract yet',
  anthropicBody:
    'The panel runs its agent on the OpenAI wire formats. An Anthropic profile can still list its models here, but a chat turn will stop with an error. Use an OpenAI Responses or Chat Completions endpoint to run Arlo.',
  baseUrl: 'Base URL',
  requestsGoTo: 'Requests go to',
  endpointInvalid: 'Enter a valid Base URL to preview the endpoint.',
  apiKey: 'API key',
  apiKeyHint:
    'Turn remembering off to keep the key only until Chrome closes. Arlo does not encrypt remembered keys.',
  hide: 'Hide',
  reveal: 'Reveal',
  clear: 'Clear',
  rememberKey: 'Remember key in this Chrome profile',
  model: 'Model',
  modelHint:
    'Pick a discovered model or type any model ID. Refresh only checks the model-list endpoint; it does not run a generation.',
  refreshModels: 'Refresh models',
  checking: 'Checking…',
  discoveredModels: 'Discovered models',
  chooseDiscovered: (count) =>
    `Choose from ${count} discovered ${count === 1 ? 'model' : 'models'}…`,
  voiceModel: 'Voice model',
  voiceModelOptional: 'Optional',
  voiceModelHintGemini:
    'A Live API model, e.g. gemini-3.5-transcribe-live. Leave empty to turn voice input off. Conversational Live models also generate a spoken reply that Arlo discards, so they cost more.',
  voiceModelHintOpenAI:
    'A Realtime transcription model, e.g. gpt-live-transcribe or gpt-4o-transcribe. Leave empty to turn voice input off.',
  suggestedVoiceModels: 'Suggested voice models',
  chooseSuggested: (count) => `Choose from ${count} suggested ${count === 1 ? 'model' : 'models'}…`,
  dataDestination: 'Data destination',
  dataDestinationBody: (origin) =>
    `Task instructions and relevant page content go directly to ${origin ?? 'the configured origin'}.`,
  audioToo: ' Microphone audio goes there too.',
  technicalDetails: 'Technical details',
  endpoint: 'Endpoint',
  httpStatus: 'HTTP status',
  requestId: 'Request ID',
  response: 'Response',
  deleteTitle: (name) => `Delete ${name}?`,
  newDefaultProfile: 'New default profile',
  blockedUntilCreated: 'Task submission will be blocked until you create another profile.',
  deleteProfile: 'Delete profile',
  cancel: 'Cancel',
  saveProfile: 'Save profile',
  makeDefault: 'Make default',
  duplicate: 'Duplicate',
  delete: 'Delete',
  chooseOrAdd: 'Choose or add a profile.',
  confirmDiscard: 'Discard your unsaved profile changes?',
  confirmChangeContract:
    'Change this API contract? Arlo will reset the Base URL, model list, and connection status while retaining the API key.',
  keyKeptForContract: 'The retained key will be sent using the new API contract.',
  keyClearedOriginChanged: 'The stored API key was cleared because the destination origin changed.',
  confirmInsecure: (origin) =>
    `This endpoint uses unencrypted HTTP:\n\n${origin}\n\nAPI keys and page content may be readable in transit. Save it anyway?`,
  confirmDataOrigin: (origin) =>
    `Allow Arlo to send task instructions and relevant page content directly to:\n\n${origin}?`,
  profileError: {
    name: 'Profile name is required.',
    model: 'Model is required.',
    baseUrlProtocol: 'Base URL must use HTTP or HTTPS.',
    baseUrlInvalid: 'Enter a valid Base URL.',
  },
  duplicateName: 'Profile names must be unique.',
  profileSaved: 'Profile saved.',
  chromeWouldNotRequest: (pattern, reason) =>
    `Chrome would not request access to ${pattern}: ${reason}`,
  permissionNotGranted: 'Permission to contact this endpoint was not granted.',
  needBaseUrlToRefresh: 'Enter a valid Base URL before refreshing models.',
  modelsLoaded: (count) =>
    count === 1 ? 'Loaded 1 model.' : `Loaded ${count.toLocaleString()} models.`,
  modelListUnavailable: 'Model list unavailable. You can still enter a model ID manually.',
  saveBeforeDefault: 'Save this profile before making it the default.',
  nowDefault: (name) => `${name} is now the default.`,
  copySuffix: 'Copy',
  copyNotice: 'Enter an API key if this endpoint requires one, then save the copy.',
  saveBeforeDelete: 'Discard or save your changes before deleting.',
  cancelDraftInstead: 'Cancel this draft instead.',
  profileDeleted: 'Profile deleted.',
  profileDeletedNone: 'Profile deleted. Tasks are blocked until you add one.',
};

const ZH_TW: OptionsText = {
  brandSuffix: '設定',
  saved: '已儲存',
  title: '設定',
  intro: 'Arlo 的 agent 在側邊欄內執行。只要給它一個模型就能使用，不需要其他設定。',
  dismiss: '關閉',
  appearanceTitle: '外觀',
  appearanceSub: '會立即套用到設定頁與側邊欄。「系統」會跟隨這台電腦的設定。',
  themeLegend: '主題',
  theme: { system: '系統', light: '淺色', dark: '深色' },
  languageTitle: 'Language 語言 / 言語',
  languageSub:
    '設定頁與側邊欄的文字、建議的任務範例，以及 Arlo 回覆所使用的語言（除非你改用其他語言和它說話）。',
  languageLegend: '語言',
  agentTitle: 'Agent',
  agentSub:
    'Arlo 回答一則訊息最多可以執行幾個步驟。每次呼叫模型（包括讀取或開啟頁面）都算一步。長任務可以調高；想控制費用就調低。',
  maxTurnsLabel: '最大步數',
  maxTurnsHint: (min, max) => `${min} 到 ${max}。預設 25。`,
  voiceTitle: '語音輸入',
  voiceSub:
    '在「AI 連線」中為每個設定檔選擇語音模型即可開啟。開啟後，聊天框會多一個麥克風按鈕，你說的話會邊說邊顯示。',
  autoSendLabel: '說完後立即送出',
  autoSendHint: '預設關閉：辨識結果會先放進聊天框，讓你確認後再交給 Arlo 執行。',
  allowMicrophone: '允許使用麥克風',
  micAllowed: '已允許麥克風，側邊欄現在可以聆聽了。',
  micNotFound: '找不到麥克風。',
  micDenied: 'Chrome 未允許使用麥克風。請檢查此擴充功能的網站設定後再試一次。',
  connectionsTitle: 'AI 連線',
  connectionsSub: 'Arlo 會把每個任務直接送到預設設定檔。設定檔不會自動切換。',
  addProfile: '新增設定檔',
  profilesNav: 'AI 設定檔',
  noProfiles: '還沒有設定檔',
  noModelSelected: '尚未選擇模型',
  defaultBadge: '預設',
  chooseContractTitle: '選擇 API 規格',
  chooseContractSub: '請求與驗證格式維持明確指定。',
  contractDescription: {
    'anthropic-messages': 'Claude 原生 Messages API',
    'openai-responses': 'OpenAI Responses API 與相容的 gateway',
    'openai-chat-completions': 'OpenAI Chat Completions 與相容的 gateway',
    gemini: '透過相容 OpenAI 的端點使用 Gemini API',
  },
  newProfile: '新設定檔',
  untitledProfile: '未命名的設定檔',
  unsaved: '尚未儲存的變更',
  discovery: {
    available: '已載入模型',
    unavailable: '無法取得模型清單',
    failed: '檢查失敗',
    untested: '尚未測試',
  },
  profileName: '設定檔名稱',
  apiContract: 'API 規格',
  anthropicTitle: 'Arlo 目前還無法使用這個規格',
  anthropicBody:
    '側邊欄的 agent 使用 OpenAI 的通訊格式。Anthropic 設定檔仍可在這裡列出模型，但聊天時會以錯誤中止。請改用 OpenAI Responses 或 Chat Completions 端點來執行 Arlo。',
  baseUrl: 'Base URL',
  requestsGoTo: '請求會送到',
  endpointInvalid: '請輸入有效的 Base URL 以預覽端點。',
  apiKey: 'API 金鑰',
  apiKeyHint: '關閉「記住」後，金鑰只會保留到 Chrome 關閉為止。Arlo 不會加密已記住的金鑰。',
  hide: '隱藏',
  reveal: '顯示',
  clear: '清除',
  rememberKey: '在這個 Chrome 設定檔中記住金鑰',
  model: '模型',
  modelHint:
    '可以選擇偵測到的模型，也可以輸入任何模型 ID。「重新整理」只會檢查模型清單端點，不會執行生成。',
  refreshModels: '重新整理模型',
  checking: '檢查中…',
  discoveredModels: '偵測到的模型',
  chooseDiscovered: (count) => `從 ${count} 個偵測到的模型中選擇…`,
  voiceModel: '語音模型',
  voiceModelOptional: '選填',
  voiceModelHintGemini:
    'Live API 模型，例如 gemini-3.5-transcribe-live。留空即關閉語音輸入。對話型的 Live 模型也會產生語音回覆（Arlo 會直接丟棄），所以費用較高。',
  voiceModelHintOpenAI:
    'Realtime 轉錄模型，例如 gpt-live-transcribe 或 gpt-4o-transcribe。留空即關閉語音輸入。',
  suggestedVoiceModels: '建議的語音模型',
  chooseSuggested: (count) => `從 ${count} 個建議的模型中選擇…`,
  dataDestination: '資料送往的位置',
  dataDestinationBody: (origin) => `任務指示與相關的頁面內容會直接送到 ${origin ?? '設定的來源'}。`,
  audioToo: '麥克風的聲音也會送到那裡。',
  technicalDetails: '技術細節',
  endpoint: '端點',
  httpStatus: 'HTTP 狀態',
  requestId: '請求 ID',
  response: '回應',
  deleteTitle: (name) => `要刪除「${name}」嗎？`,
  newDefaultProfile: '新的預設設定檔',
  blockedUntilCreated: '在你建立另一個設定檔之前，將無法送出任務。',
  deleteProfile: '刪除設定檔',
  cancel: '取消',
  saveProfile: '儲存設定檔',
  makeDefault: '設為預設',
  duplicate: '複製',
  delete: '刪除',
  chooseOrAdd: '請選擇或新增一個設定檔。',
  confirmDiscard: '要捨棄尚未儲存的設定檔變更嗎？',
  confirmChangeContract:
    '要變更 API 規格嗎？Arlo 會重設 Base URL、模型清單與連線狀態，但會保留 API 金鑰。',
  keyKeptForContract: '保留的金鑰將以新的 API 規格送出。',
  keyClearedOriginChanged: '因為目的地來源已變更，已清除儲存的 API 金鑰。',
  confirmInsecure: (origin) =>
    `這個端點使用未加密的 HTTP：\n\n${origin}\n\nAPI 金鑰與頁面內容在傳輸過程中可能被讀取。仍要儲存嗎？`,
  confirmDataOrigin: (origin) => `允許 Arlo 把任務指示與相關的頁面內容直接送到：\n\n${origin}？`,
  profileError: {
    name: '請輸入設定檔名稱。',
    model: '請輸入模型。',
    baseUrlProtocol: 'Base URL 必須使用 HTTP 或 HTTPS。',
    baseUrlInvalid: '請輸入有效的 Base URL。',
  },
  duplicateName: '設定檔名稱不能重複。',
  profileSaved: '設定檔已儲存。',
  chromeWouldNotRequest: (pattern, reason) => `Chrome 無法要求 ${pattern} 的存取權：${reason}`,
  permissionNotGranted: '未取得連線到這個端點的權限。',
  needBaseUrlToRefresh: '請先輸入有效的 Base URL，再重新整理模型。',
  modelsLoaded: (count) => `已載入 ${count.toLocaleString()} 個模型。`,
  modelListUnavailable: '無法取得模型清單。你仍可手動輸入模型 ID。',
  saveBeforeDefault: '請先儲存這個設定檔，再設為預設。',
  nowDefault: (name) => `「${name}」現在是預設設定檔。`,
  copySuffix: '副本',
  copyNotice: '如果這個端點需要 API 金鑰，請輸入後再儲存這份副本。',
  saveBeforeDelete: '請先捨棄或儲存你的變更，再刪除。',
  cancelDraftInstead: '請改為取消這份草稿。',
  profileDeleted: '設定檔已刪除。',
  profileDeletedNone: '設定檔已刪除。在你新增設定檔之前，將無法送出任務。',
};

const JA: OptionsText = {
  brandSuffix: '設定',
  saved: '保存しました',
  title: '設定',
  intro:
    'Arlo はエージェントをサイドパネルの中で実行します。考えるためのモデルを用意するだけで、他に設定は要りません。',
  dismiss: '閉じる',
  appearanceTitle: '外観',
  appearanceSub:
    '設定ページとサイドパネルにすぐ反映されます。「システム」はこのコンピューターの設定に従います。',
  themeLegend: 'テーマ',
  theme: { system: 'システム', light: 'ライト', dark: 'ダーク' },
  languageTitle: 'Language 語言 / 言語',
  languageSub:
    '設定ページとサイドパネルの表示、おすすめのタスク、そして Arlo の返信に使う言語です（別の言語で話しかけた場合はその言語で返信します）。',
  languageLegend: '言語',
  agentTitle: 'エージェント',
  agentSub:
    'Arlo が 1 件のメッセージに答えるまでに実行できるステップ数です。ページを読む・開くものを含め、モデルの呼び出し 1 回が 1 ステップです。長いタスクでは増やし、費用を抑えるには減らしてください。',
  maxTurnsLabel: '最大ステップ数',
  maxTurnsHint: (min, max) => `${min}〜${max}。既定は 25 です。`,
  voiceTitle: '音声入力',
  voiceSub:
    '「AI 接続」でプロファイルごとに音声モデルを選ぶと有効になります。チャット欄にマイクのボタンが表示され、話した内容が話しながら表示されます。',
  autoSendLabel: '話し終えたらすぐ送信する',
  autoSendHint:
    '既定ではオフです。文字起こしの結果はまずチャット欄に入るので、Arlo が実行する前に確認できます。',
  allowMicrophone: 'マイクを許可',
  micAllowed: 'マイクを許可しました。サイドパネルで聞き取れます。',
  micNotFound: 'マイクが見つかりませんでした。',
  micDenied:
    'Chrome がマイクを許可しませんでした。この拡張機能のサイト設定を確認して、もう一度お試しください。',
  connectionsTitle: 'AI 接続',
  connectionsSub:
    'Arlo は各タスクを既定のプロファイルへ直接送ります。プロファイルが自動で切り替わることはありません。',
  addProfile: 'プロファイルを追加',
  profilesNav: 'AI プロファイル',
  noProfiles: 'プロファイルはまだありません',
  noModelSelected: 'モデル未選択',
  defaultBadge: '既定',
  chooseContractTitle: 'API 仕様を選択',
  chooseContractSub: 'リクエストと認証の形式は明示的に指定します。',
  contractDescription: {
    'anthropic-messages': 'Claude ネイティブの Messages API',
    'openai-responses': 'OpenAI Responses API と互換ゲートウェイ',
    'openai-chat-completions': 'OpenAI Chat Completions と互換ゲートウェイ',
    gemini: 'OpenAI 互換エンドポイント経由の Gemini API',
  },
  newProfile: '新しいプロファイル',
  untitledProfile: '名称未設定のプロファイル',
  unsaved: '未保存の変更',
  discovery: {
    available: 'モデルを読み込みました',
    unavailable: 'モデル一覧を取得できません',
    failed: '確認に失敗しました',
    untested: '未確認',
  },
  profileName: 'プロファイル名',
  apiContract: 'API 仕様',
  anthropicTitle: 'Arlo はこの仕様にまだ対応していません',
  anthropicBody:
    'パネルのエージェントは OpenAI の通信形式で動作します。Anthropic のプロファイルでもここでモデル一覧は取得できますが、チャットはエラーで止まります。Arlo を動かすには OpenAI Responses または Chat Completions のエンドポイントを使ってください。',
  baseUrl: 'Base URL',
  requestsGoTo: 'リクエストの送信先',
  endpointInvalid: '有効な Base URL を入力するとエンドポイントをプレビューできます。',
  apiKey: 'API キー',
  apiKeyHint:
    '「保存する」をオフにすると、キーは Chrome を閉じるまでだけ保持されます。保存されたキーは Arlo では暗号化されません。',
  hide: '隠す',
  reveal: '表示',
  clear: 'クリア',
  rememberKey: 'この Chrome プロファイルにキーを保存する',
  model: 'モデル',
  modelHint:
    '検出されたモデルを選ぶか、任意のモデル ID を入力してください。更新はモデル一覧のエンドポイントを確認するだけで、生成は実行しません。',
  refreshModels: 'モデルを更新',
  checking: '確認中…',
  discoveredModels: '検出されたモデル',
  chooseDiscovered: (count) => `検出された ${count} 件のモデルから選択…`,
  voiceModel: '音声モデル',
  voiceModelOptional: '任意',
  voiceModelHintGemini:
    'Live API のモデル（例: gemini-3.5-transcribe-live）。空欄にすると音声入力はオフになります。会話型の Live モデルは音声の返答も生成し、Arlo はそれを破棄するため、費用が高くなります。',
  voiceModelHintOpenAI:
    'Realtime の文字起こしモデル（例: gpt-live-transcribe、gpt-4o-transcribe）。空欄にすると音声入力はオフになります。',
  suggestedVoiceModels: 'おすすめの音声モデル',
  chooseSuggested: (count) => `おすすめの ${count} 件のモデルから選択…`,
  dataDestination: 'データの送信先',
  dataDestinationBody: (origin) =>
    `タスクの指示と関連するページの内容は ${origin ?? '設定されたオリジン'} へ直接送られます。`,
  audioToo: 'マイクの音声も同じ場所へ送られます。',
  technicalDetails: '技術的な詳細',
  endpoint: 'エンドポイント',
  httpStatus: 'HTTP ステータス',
  requestId: 'リクエスト ID',
  response: 'レスポンス',
  deleteTitle: (name) => `「${name}」を削除しますか？`,
  newDefaultProfile: '新しい既定のプロファイル',
  blockedUntilCreated: '別のプロファイルを作成するまで、タスクは送信できません。',
  deleteProfile: 'プロファイルを削除',
  cancel: 'キャンセル',
  saveProfile: 'プロファイルを保存',
  makeDefault: '既定にする',
  duplicate: '複製',
  delete: '削除',
  chooseOrAdd: 'プロファイルを選択するか、追加してください。',
  confirmDiscard: '保存していないプロファイルの変更を破棄しますか？',
  confirmChangeContract:
    'API 仕様を変更しますか？API キーは保持されますが、Base URL、モデル一覧、接続状態はリセットされます。',
  keyKeptForContract: '保持されたキーは新しい API 仕様で送信されます。',
  keyClearedOriginChanged:
    '送信先のオリジンが変わったため、保存されていた API キーを消去しました。',
  confirmInsecure: (origin) =>
    `このエンドポイントは暗号化されていない HTTP を使用しています：\n\n${origin}\n\nAPI キーやページの内容が通信中に読み取られる可能性があります。それでも保存しますか？`,
  confirmDataOrigin: (origin) =>
    `Arlo がタスクの指示と関連するページの内容を次の宛先へ直接送ることを許可しますか？\n\n${origin}`,
  profileError: {
    name: 'プロファイル名を入力してください。',
    model: 'モデルを入力してください。',
    baseUrlProtocol: 'Base URL には HTTP または HTTPS を使ってください。',
    baseUrlInvalid: '有効な Base URL を入力してください。',
  },
  duplicateName: 'プロファイル名は重複できません。',
  profileSaved: 'プロファイルを保存しました。',
  chromeWouldNotRequest: (pattern, reason) =>
    `Chrome が ${pattern} へのアクセスを要求できませんでした：${reason}`,
  permissionNotGranted: 'このエンドポイントへ接続する権限が許可されませんでした。',
  needBaseUrlToRefresh: 'モデルを更新する前に、有効な Base URL を入力してください。',
  modelsLoaded: (count) => `${count.toLocaleString()} 件のモデルを読み込みました。`,
  modelListUnavailable: 'モデル一覧を取得できません。モデル ID は手動で入力できます。',
  saveBeforeDefault: '既定にする前に、このプロファイルを保存してください。',
  nowDefault: (name) => `「${name}」を既定にしました。`,
  copySuffix: 'のコピー',
  copyNotice: 'このエンドポイントに API キーが必要なら入力して、コピーを保存してください。',
  saveBeforeDelete: '削除する前に、変更を保存するか破棄してください。',
  cancelDraftInstead: '代わりにこの下書きをキャンセルしてください。',
  profileDeleted: 'プロファイルを削除しました。',
  profileDeletedNone: 'プロファイルを削除しました。追加するまでタスクは送信できません。',
};

const TEXT: Record<Language, OptionsText> = { en: EN, 'zh-TW': ZH_TW, ja: JA };

export function optionsText(language: Language): OptionsText {
  return TEXT[language];
}

/** The Settings page's strings in the language chosen on it. */
export function useOptionsText(): OptionsText {
  return optionsText(useLanguage());
}
