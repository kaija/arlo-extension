import type { Language } from '../shared/language';

export interface PageSnapshot {
  url?: string;
  title?: string;
}

export interface PageSuggestions {
  id: string;
  eyebrow: string;
  description: string;
  /** Everything that could be offered; the screen shows a few of them at a time. */
  pool: readonly string[];
}

/** How many suggestions the idle screen shows. */
export const SUGGESTION_COUNT = 3;

interface SuggestionText {
  eyebrow: string;
  description: string;
  pool: readonly string[];
}

type PerLanguage = Record<Language, SuggestionText>;

const DEFAULT_TEXT: PerLanguage = {
  en: {
    eyebrow: 'Try one of these',
    description:
      'Arlo can help with the page you’re viewing. It asks before submitting forms, sending messages, deleting data, or changing account settings.',
    pool: [
      'Summarize this page and highlight what needs my attention',
      'Find the information I need on this page',
      'Help me complete the task on this page, and ask before taking sensitive actions',
      'Explain this page in simple terms',
      'List the key points, dates and deadlines on this page',
      'Pull the main facts from this page into a short bullet list',
      'Compare the options on this page and recommend one',
      'Check whether anything on this page needs extra care',
      'Translate the important parts of this page into my language',
      'Turn this page into a checklist of next steps',
      'What should I ask after reading this page?',
      'Find the contact details and useful links on this page',
    ],
  },
  'zh-TW': {
    eyebrow: '試試這些',
    description:
      'Arlo 可以協助你處理目前瀏覽的頁面。在送出表單、傳送訊息、刪除資料或變更帳號設定之前，它會先詢問你。',
    pool: [
      '摘要這個頁面，並標出需要我注意的地方',
      '幫我在這個頁面找出我需要的資訊',
      '協助我完成這個頁面上的任務，遇到敏感操作前先問我',
      '用簡單的方式解釋這個頁面',
      '列出這個頁面的重點、日期與截止時間',
      '把這個頁面的主要事實整理成簡短的條列',
      '比較這個頁面上的選項，並推薦一個',
      '檢查這個頁面上有沒有需要特別小心的地方',
      '把這個頁面的重要內容翻成中文',
      '把這個頁面整理成下一步的待辦清單',
      '讀完這個頁面後，我還該問些什麼？',
      '找出這個頁面上的聯絡方式與實用連結',
    ],
  },
  ja: {
    eyebrow: 'こちらをお試しください',
    description:
      'Arlo は表示中のページの作業をお手伝いします。フォームの送信、メッセージの送信、データの削除、アカウント設定の変更の前には確認します。',
    pool: [
      'このページを要約して、注意すべき点を教えて',
      'このページから必要な情報を探して',
      'このページのタスクを進めて。重要な操作の前には確認して',
      'このページをやさしい言葉で説明して',
      'このページの要点、日付、締め切りを一覧にして',
      'このページの主な事実を短い箇条書きにまとめて',
      'このページの選択肢を比較して、おすすめを教えて',
      'このページに注意が必要な点がないか確認して',
      'このページの重要な部分を日本語に翻訳して',
      'このページを次のステップのチェックリストにして',
      'このページを読んだ後に確認すべきことは？',
      'このページの連絡先と役立つリンクを探して',
    ],
  },
};

const GMAIL_HOME_TEXT: PerLanguage = {
  en: {
    eyebrow: 'Suggestions for Gmail',
    description:
      'Arlo can help organize email work on this page. It asks before sending messages or making other sensitive changes.',
    pool: [
      'Summarize important unread emails and flag anything urgent',
      'Find messages that need a reply today',
      'Draft replies to the most important emails, but ask before sending',
      'Group my inbox by sender and tell me what can wait',
      'Find emails with invoices, receipts or bookings',
      'Find emails that mention a deadline or meeting this week',
      'Point out emails that look like spam or phishing',
      'List who has been waiting longest for my reply',
    ],
  },
  'zh-TW': {
    eyebrow: 'Gmail 建議',
    description:
      'Arlo 可以協助整理這個頁面上的電子郵件。在傳送訊息或進行其他敏感變更之前，它會先詢問你。',
    pool: [
      '摘要重要的未讀郵件，並標出緊急的項目',
      '找出今天需要回覆的郵件',
      '幫最重要的郵件草擬回覆，寄出前先問我',
      '依寄件者整理我的收件匣，並告訴我哪些可以晚點處理',
      '找出含有發票、收據或訂位訂房的郵件',
      '找出提到本週截止日或會議的郵件',
      '指出看起來像垃圾郵件或釣魚郵件的信',
      '列出等我回覆最久的人',
    ],
  },
  ja: {
    eyebrow: 'Gmail のおすすめ',
    description:
      'Arlo はこのページのメール整理をお手伝いします。メールの送信やその他の重要な変更の前には確認します。',
    pool: [
      '未読の重要なメールを要約して、急ぎのものを教えて',
      '今日中に返信が必要なメールを探して',
      '重要なメールの返信案を作成して。送信前に確認して',
      '受信トレイを送信者ごとにまとめて、後回しにできるものを教えて',
      '請求書、領収書、予約のメールを探して',
      '今週の締め切りや会議に触れているメールを探して',
      'スパムやフィッシングに見えるメールを指摘して',
      '返信を最も長く待たせている相手を一覧にして',
    ],
  },
};

interface SuggestionRule {
  id: string;
  text: PerLanguage;
  matches: (page: PageSnapshot) => boolean;
}

function isGmailHome(page: PageSnapshot): boolean {
  if (!page.url) return false;
  try {
    const url = new URL(page.url);
    if (url.hostname !== 'mail.google.com' || !url.pathname.startsWith('/mail')) return false;
    return url.hash === '' || url.hash === '#inbox';
  } catch {
    return false;
  }
}

const RULES: readonly SuggestionRule[] = [
  { id: 'gmail-home', text: GMAIL_HOME_TEXT, matches: isGmailHome },
];

/** The first page-specific set, or the safe generic fallback, in the given language. */
export function suggestionsForPage(page: PageSnapshot, language: Language = 'en'): PageSuggestions {
  const rule = RULES.find((candidate) => candidate.matches(page));
  const text = (rule?.text ?? DEFAULT_TEXT)[language];
  return { id: rule?.id ?? 'default', ...text };
}

/** `count` different suggestions picked at random from the pool. */
export function pickSuggestions(
  pool: readonly string[],
  count: number = SUGGESTION_COUNT,
  random: () => number = Math.random,
): string[] {
  const rest = [...pool];
  const picked: string[] = [];
  while (picked.length < count && rest.length > 0) {
    const [chosen] = rest.splice(Math.floor(random() * rest.length), 1);
    if (chosen !== undefined) picked.push(chosen);
  }
  return picked;
}
