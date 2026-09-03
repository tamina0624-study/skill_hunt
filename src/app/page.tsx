"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  CalendarClock,
  ClipboardCheck,
  ListChecks,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";

type PageKey = "dashboard" | "create" | "list" | "quests" | "achievements" | "reports" | "settings";
type RiskLevel = "low" | "medium" | "high" | "critical";
type QuestStatus = "proposed" | "in_progress" | "completed" | "cancelled";
type HarmLevel = "none" | "minor" | "occurred";
type MessageRole = "user" | "assistant";
type NearMissStatus = "considering" | "completed";
type ListKind = "all" | "knowledge" | "skill" | "achievement";

type NearMiss = {
  id: string;
  occurredAt: string;
  workContext: string;
  description: string;
  potentialImpact: string;
  perceivedCause: string;
  detectionTrigger: string;
  userCountermeasure: string;
  actualHarm: HarmLevel;
  categories: string[];
  occurrence: number;
  severity: number;
  detectability: number;
  rpn: number;
  riskLevel: RiskLevel;
  aiSummary: string;
  status: NearMissStatus;
  knowledgePoints: number;
  knowledgePointReason: string;
  countermeasures: Countermeasure[];
  boss: boolean;
};

type Countermeasure = {
  id: string;
  title: string;
  level: number;
  status: "proposed" | "planned" | "in_progress" | "completed" | "verified" | "rejected";
  dueAt: string;
  xp: number;
  effectiveness: "unknown" | "partial" | "effective";
};

type Quest = {
  id: string;
  title: string;
  description: string;
  nearMissId: string;
  recommendedLevel: number;
  dueAt: string;
  difficulty: "easy" | "normal" | "hard";
  status: QuestStatus;
  xp: number;
  xpGranted: boolean;
};

type AcquiredSkill = {
  id: string;
  title: string;
  points: number;
  reason: string;
  acquiredAt: string;
};

type AchievementRecord = {
  id: string;
  title: string;
  points: number;
  reason: string;
  achievedAt: string;
};

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  maskedContent?: string;
};

type TrendPoint = {
  label: string;
  value: number;
};

type SearchListItem = {
  id: string;
  kind: Exclude<ListKind, "all">;
  title: string;
  summary: string;
  meta: string;
  knowledgePoints?: number;
  skillPoints?: number;
  achievementPoints?: number;
  nearMissId?: string;
};

type MonthlyRegistrationFeedback = {
  title: string;
  message: string;
  focus: string;
};

type EngineerAssessment = {
  title: string;
  message: string;
  nextAction: string;
};

type AiReport = {
  id: string;
  periodKey: string;
  generatedAt: string;
  periodLabel: string;
  monthlyEvaluation: MonthlyRegistrationFeedback;
  engineerEvaluation: EngineerAssessment;
};

type AppState = {
  userEmail: string;
  totalXp: number;
  selectedId: string;
  nearMisses: NearMiss[];
  quests: Quest[];
  acquiredSkills: AcquiredSkill[];
  achievementRecords: AchievementRecord[];
  reports: AiReport[];
  latestReport?: AiReport;
  bossEnabled: boolean;
};

type DraftForm = {
  occurredAt: string;
  workContext: string;
  description: string;
  potentialImpact: string;
  perceivedCause: string;
  detectionTrigger: string;
  userCountermeasure: string;
  actualHarm: HarmLevel;
  status: NearMissStatus;
  confidentialityConfirmed: boolean;
};

const storageKey = "safety-quest-state-v1";
const categories = ["設定ミス", "確認漏れ", "転記ミス", "認識違い", "設計不足", "手順書不足", "レビュー不足", "自動化不足", "時間的余裕", "権限", "監視", "変更管理", "その他"];
const riskLabels: Record<RiskLevel, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const harmLabels: Record<HarmLevel, string> = { none: "なし", minor: "軽微", occurred: "あり" };
const nearMissStatusLabels: Record<NearMissStatus, string> = { considering: "検討中", completed: "完了" };
const listKindLabels: Record<ListKind, string> = { all: "全て", knowledge: "ナレッジ", skill: "スキル", achievement: "実績" };
const pageTitles: Record<PageKey, string> = {
  dashboard: "ダッシュボード",
  create: "ナレッジ登録",
  list: "登録一覧",
  quests: "獲得スキル",
  achievements: "実績登録",
  reports: "レポート",
  settings: "設定",
};

const todayIsoDate = () => new Date().toISOString().slice(0, 10);
const nowLocalInput = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const currentMonthInput = () => new Date().toISOString().slice(0, 7);
const monthInputToIsoDate = (yearMonth: string) => `${yearMonth || currentMonthInput()}-01T00:00:00.000Z`;

const calculateRisk = (occurrence: number, severity: number, detectability: number) => {
  const rpn = occurrence * severity * detectability;
  const riskLevel: RiskLevel = rpn >= 80 ? "critical" : rpn >= 50 ? "high" : rpn >= 20 ? "medium" : "low";
  return { rpn, riskLevel };
};

const levelFromXp = (totalXp: number) => Math.floor(Math.sqrt(totalXp / 100)) + 1;

const maskSecrets = (value: string) =>
  value
    .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");

const sampleNearMisses: NearMiss[] = [
  {
    id: "nm-1",
    occurredAt: "2026-09-03T01:30",
    workContext: "本番ネットワーク設定変更",
    description: "対象機器を取り違えて設定しそうになった。実行直前にIPアドレスを照合して気づいた。",
    potentialImpact: "通信断の可能性",
    perceivedCause: "機器名が似ており、作業手順の識別情報が不足していた。",
    detectionTrigger: "実行直前のIPアドレス照合",
    userCountermeasure: "次回から注意する",
    actualHarm: "none",
    categories: ["確認漏れ", "変更管理"],
    occurrence: 4,
    severity: 5,
    detectability: 3,
    ...calculateRisk(4, 5, 3),
    aiSummary: "対象識別の工程が弱く、実行直前の照合で事故を回避できた事例です。",
    status: "considering",
    knowledgePoints: 0,
    knowledgePointReason: "初期データのため未判定です。",
    boss: true,
    countermeasures: [
      { id: "cm-1", title: "作業対象IDとIPのチェック欄を手順書に追加", level: 2, status: "in_progress", dueAt: "2026-09-06", xp: 20, effectiveness: "unknown" },
      { id: "cm-2", title: "変更前に対象機器を自動照合する読み取り専用スクリプトを検討", level: 4, status: "proposed", dueAt: "2026-09-12", xp: 50, effectiveness: "unknown" },
    ],
  },
  {
    id: "nm-2",
    occurredAt: "2026-09-01T09:10",
    workContext: "請求データCSV作成",
    description: "検証環境のファイルを本番用として添付しそうになった。ファイル名規則が似ていた。",
    potentialImpact: "誤った請求データの送付",
    perceivedCause: "環境名がファイル名の末尾にあり、一覧で見切れていた。",
    detectionTrigger: "送信前レビュー",
    userCountermeasure: "ファイル名をよく見る",
    actualHarm: "none",
    categories: ["転記ミス", "レビュー不足"],
    occurrence: 3,
    severity: 4,
    detectability: 3,
    ...calculateRisk(3, 4, 3),
    aiSummary: "ファイル識別の視認性が低く、送信前レビューで検出できた事例です。",
    status: "completed",
    knowledgePoints: 0,
    knowledgePointReason: "初期データのため未判定です。",
    boss: false,
    countermeasures: [{ id: "cm-3", title: "ファイル名の先頭に環境名と日付を付ける", level: 2, status: "completed", dueAt: "2026-09-02", xp: 20, effectiveness: "partial" }],
  },
];

const initialState: AppState = {
  userEmail: "",
  totalXp: 70,
  selectedId: "nm-1",
  nearMisses: sampleNearMisses,
  quests: [
    { id: "q-1", title: "本番作業チェックリストをLv2へ更新", description: "対象ID、IP、作業チケット番号を実行前に照合する。", nearMissId: "nm-1", recommendedLevel: 2, dueAt: "2026-09-06", difficulty: "easy", status: "in_progress", xp: 20, xpGranted: false },
    { id: "q-2", title: "CSV送付前レビューの観点を固定化", description: "環境名、対象月、宛先をレビュー項目に追加する。", nearMissId: "nm-2", recommendedLevel: 3, dueAt: "2026-09-08", difficulty: "normal", status: "completed", xp: 30, xpGranted: true },
  ],
  acquiredSkills: [],
  achievementRecords: [],
  reports: [],
  bossEnabled: true,
};

const initialDraftMessages: ChatMessage[] = [
  { id: "draft-m-1", role: "assistant", content: "左側の登録内容を引き継いで相談できます。原因、対策、完了条件などをそのまま聞いてください。" },
];

const blankForm = (): DraftForm => ({
  occurredAt: nowLocalInput(),
  workContext: "",
  description: "",
  potentialImpact: "",
  perceivedCause: "",
  detectionTrigger: "",
  userCountermeasure: "",
  actualHarm: "none",
  status: "considering",
  confidentialityConfirmed: false,
});

const formFromNearMiss = (nearMiss: NearMiss): DraftForm => ({
  occurredAt: nearMiss.occurredAt,
  workContext: nearMiss.workContext,
  description: nearMiss.description,
  potentialImpact: nearMiss.potentialImpact,
  perceivedCause: nearMiss.perceivedCause,
  detectionTrigger: nearMiss.detectionTrigger,
  userCountermeasure: nearMiss.userCountermeasure,
  actualHarm: nearMiss.actualHarm,
  status: deriveNearMissStatus(nearMiss),
  confidentialityConfirmed: true,
});

export default function Home() {
  const [appState, setAppState] = useState<AppState>(initialState);
  const [page, setPage] = useState<PageKey>("dashboard");
  const [form, setForm] = useState<DraftForm>(blankForm);
  const [showOptional, setShowOptional] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [listKindFilter, setListKindFilter] = useState<ListKind>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | NearMissStatus>("all");
  const [chatInput, setChatInput] = useState("");
  const [draftMessages, setDraftMessages] = useState<ChatMessage[]>(initialDraftMessages);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      setAppState(JSON.parse(saved) as AppState);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(storageKey, JSON.stringify(appState));
    }
  }, [appState, loaded]);

  const totalNearMisses = appState.nearMisses.length;
  const monthlyNearMisses = appState.nearMisses.filter((nearMiss) => isInCurrentMonth(nearMiss.occurredAt)).length;
  const monthlyKnowledgeGrowth = appState.nearMisses.filter((nearMiss) => isInCurrentMonth(nearMiss.occurredAt)).reduce((total, nearMiss) => total + (nearMiss.knowledgePoints ?? 0), 0);
  const monthlySkillGrowth = (appState.acquiredSkills ?? []).filter((skill) => isInCurrentMonth(skill.acquiredAt)).reduce((total, skill) => total + skill.points, 0);
  const monthlyAchievementGrowth = (appState.achievementRecords ?? []).filter((achievement) => isInCurrentMonth(achievement.achievedAt)).reduce((total, achievement) => total + achievement.points, 0);
  const monthlyEngineerGrowth = appState.quests.filter((quest) => quest.xpGranted && isInCurrentMonth(quest.dueAt)).reduce((total, quest) => total + quest.xp, 0) + monthlySkillGrowth + monthlyKnowledgeGrowth + monthlyAchievementGrowth;
  const currentLevel = levelFromXp(appState.totalXp);
  const latestNearMiss = [...appState.nearMisses].sort((first, second) => new Date(second.occurredAt).getTime() - new Date(first.occurredAt).getTime())[0];
  const savedReports = getSavedReports(appState);
  const latestReport = savedReports[0];
  const monthlyRegistrationFeedback = latestReport?.monthlyEvaluation ?? buildMonthlyRegistrationFeedback(appState.nearMisses);
  const engineerAssessment = latestReport?.engineerEvaluation ?? buildEngineerAssessment(appState.totalXp, monthlyEngineerGrowth, latestNearMiss);
  const registrationTrend = buildRegistrationTrend(appState.nearMisses);
  const engineerTrend = buildEngineerTrend(appState.quests, appState.acquiredSkills ?? [], appState.nearMisses, appState.achievementRecords ?? [], appState.totalXp);
  const listItems = buildSearchListItems(appState, searchText, listKindFilter, statusFilter);

  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setAppState((current) => ({ ...current, userEmail: String(data.get("email") || "demo@example.com") }));
  };

  const startNewDraft = () => {
    setForm(blankForm());
    setShowOptional(false);
    setDraftMessages(initialDraftMessages);
    setChatInput("");
    setPage("create");
  };

  const reopenNearMissInCreate = (id: string) => {
    const nearMiss = appState.nearMisses.find((item) => item.id === id);
    if (!nearMiss) return;
    setAppState((current) => ({ ...current, selectedId: id }));
    setForm(formFromNearMiss(nearMiss));
    setShowOptional(true);
    setDraftMessages([]);
    setChatInput("");
    setPage("create");
  };

  const submitNearMiss = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.workContext.trim() || !form.description.trim() || !form.confidentialityConfirmed) {
      return;
    }
    const inferredOccurrence = form.userCountermeasure.includes("注意") ? 4 : 3;
    const inferredSeverity = form.actualHarm === "occurred" ? 5 : form.potentialImpact ? 4 : 3;
    const inferredDetectability = form.detectionTrigger ? 3 : 4;
    const risk = calculateRisk(inferredOccurrence, inferredSeverity, inferredDetectability);
    const knowledgeJudgment = judgeKnowledgePoints(form, risk.riskLevel);
    const newNearMiss: NearMiss = {
      id: `nm-${Date.now()}`,
      occurredAt: form.occurredAt,
      workContext: form.workContext.trim(),
      description: form.description.trim(),
      potentialImpact: form.potentialImpact.trim(),
      perceivedCause: form.perceivedCause.trim(),
      detectionTrigger: form.detectionTrigger.trim(),
      userCountermeasure: form.userCountermeasure.trim(),
      actualHarm: form.actualHarm,
      status: form.status,
      categories: inferCategories(form),
      occurrence: inferredOccurrence,
      severity: inferredSeverity,
      detectability: inferredDetectability,
      ...risk,
      aiSummary: buildKnowledgeSummary(form, risk.riskLevel),
      knowledgePoints: knowledgeJudgment.points,
      knowledgePointReason: knowledgeJudgment.reason,
      boss: risk.riskLevel === "critical",
      countermeasures: [
        { id: `cm-${Date.now()}`, title: "チェックリストへ実行前確認を追加", level: 2, status: "proposed", dueAt: todayIsoDate(), xp: 20, effectiveness: "unknown" },
        { id: `cm-${Date.now() + 1}`, title: "入力・対象選択を自動照合する仕組みを検討", level: 4, status: "proposed", dueAt: todayIsoDate(), xp: 50, effectiveness: "unknown" },
      ],
    };
    setAppState((current) => ({ ...current, totalXp: current.totalXp + knowledgeJudgment.points, selectedId: newNearMiss.id, nearMisses: [newNearMiss, ...current.nearMisses] }));
    setForm(blankForm());
    setShowOptional(false);
    setDraftMessages(initialDraftMessages);
    setPage("create");
  };

  const sendDraftMessage = (text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const draftContext = buildDraftContext(form);
    const maskedContent = maskSecrets(`${cleanText}\n\n登録下書き: ${draftContext}`);
    const answer = buildDraftCoachReply(cleanText, form);
    setDraftMessages((current) => [
        ...current,
        { id: `m-${Date.now()}`, role: "user", content: cleanText, maskedContent },
        { id: `m-${Date.now() + 1}`, role: "assistant", content: answer },
      ]);
    setChatInput("");
  };

  const resetDraftDiscussion = () => {
    setDraftMessages([]);
    setChatInput("");
  };

  const registerSkill = (title: string, yearMonth: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const judgment = judgeSkillPoints(cleanTitle);
    const acquiredSkill: AcquiredSkill = {
      id: `skill-${Date.now()}`,
      title: cleanTitle,
      points: judgment.points,
      reason: judgment.reason,
      acquiredAt: monthInputToIsoDate(yearMonth),
    };
    setAppState((current) => ({
      ...current,
      totalXp: current.totalXp + acquiredSkill.points,
      acquiredSkills: [acquiredSkill, ...(current.acquiredSkills ?? [])],
    }));
  };

  const registerAchievement = (title: string, yearMonth: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const judgment = judgeAchievementPoints(cleanTitle);
    const achievement: AchievementRecord = {
      id: `achievement-${Date.now()}`,
      title: cleanTitle,
      points: judgment.points,
      reason: judgment.reason,
      achievedAt: monthInputToIsoDate(yearMonth),
    };
    setAppState((current) => ({
      ...current,
      totalXp: current.totalXp + achievement.points,
      achievementRecords: [achievement, ...(current.achievementRecords ?? [])],
    }));
  };

  const generateReport = () => {
    const report = buildAiReport(appState.nearMisses, appState.acquiredSkills ?? [], appState.achievementRecords ?? [], appState.totalXp, monthlyEngineerGrowth, latestNearMiss);
    setAppState((current) => {
      const currentReports = getSavedReports(current);
      return {
        ...current,
        reports: [report, ...currentReports.filter((savedReport) => savedReport.periodKey !== report.periodKey)],
        latestReport: report,
      };
    });
  };

  if (!appState.userEmail) {
    return <LoginView onSubmit={login} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><ShieldCheck size={21} /></span><span>Safety Quest</span></div>
        <nav className="nav" aria-label="主ナビゲーション">
          <NavButton icon={<BarChart3 size={18} />} label="ダッシュボード" active={page === "dashboard"} onClick={() => setPage("dashboard")} />
          <NavButton icon={<Plus size={18} />} label="ナレッジ登録" active={page === "create"} onClick={startNewDraft} />
          <NavButton icon={<Swords size={18} />} label="獲得スキル" active={page === "quests"} onClick={() => setPage("quests")} />
          <NavButton icon={<Trophy size={18} />} label="実績登録" active={page === "achievements"} onClick={() => setPage("achievements")} />
          <NavButton icon={<ListChecks size={18} />} label="一覧" active={page === "list"} onClick={() => setPage("list")} />
          <NavButton icon={<CalendarClock size={18} />} label="レポート" active={page === "reports"} onClick={() => setPage("reports")} />
          <NavButton icon={<Settings size={18} />} label="設定" active={page === "settings"} onClick={() => setPage("settings")} />
        </nav>
        <div className="side-card">
          <small>現在のレベル</small>
          <strong>Lv {currentLevel}</strong>
          <div className="progress" aria-label="次のレベルまで"><span style={{ width: `${Math.min(100, appState.totalXp % 100)}%` }} /></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{pageTitles[page]}</h1>
            <p className="subtle">日々の経験をナレッジ・スキル・実績として蓄積します。</p>
          </div>
          <span className="user-pill"><ShieldCheck size={16} />{appState.userEmail}</span>
        </header>

        {page === "dashboard" && <DashboardView monthlyNearMisses={monthlyNearMisses} totalNearMisses={totalNearMisses} monthlyEngineerGrowth={monthlyEngineerGrowth} totalEngineerPower={appState.totalXp} monthlyRegistrationFeedback={monthlyRegistrationFeedback} engineerAssessment={engineerAssessment} registrationTrend={registrationTrend} engineerTrend={engineerTrend} />}
        {page === "create" && <CreateView form={form} setForm={setForm} showOptional={showOptional} setShowOptional={setShowOptional} onSubmit={submitNearMiss} messages={draftMessages} chatInput={chatInput} setChatInput={setChatInput} sendDraftMessage={sendDraftMessage} resetDraftDiscussion={resetDraftDiscussion} />}
        {page === "list" && <ListView items={listItems} searchText={searchText} setSearchText={setSearchText} listKindFilter={listKindFilter} setListKindFilter={setListKindFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} selectNearMiss={reopenNearMissInCreate} />}
        {page === "quests" && <QuestView registerSkill={registerSkill} />}
        {page === "achievements" && <AchievementView registerAchievement={registerAchievement} />}
        {page === "reports" && <ReportView reports={savedReports} generateReport={generateReport} />}
        {page === "settings" && <SettingsView />}
      </main>
    </div>
  );
}

function LoginView({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="login-wrap">
      <section className="login-hero">
        <span className="brand-mark"><ShieldCheck size={22} /></span>
        <h1>経験を記録し、成長を見える化する。</h1>
        <p className="subtle">ナレッジ、スキル、実績をAI評価でポイント化し、エンジニア力として可視化します。</p>
      </section>
      <form className="login-card stack" onSubmit={onSubmit}>
        <span className="badge">SAFETY QUEST</span>
        <h2>ログイン</h2>
        <label>メールアドレス<input name="email" type="email" defaultValue="yoshida@example.com" required /></label>
        <button className="primary" type="submit"><ShieldCheck size={18} />はじめる</button>
      </form>
    </div>
  );
}

function DashboardView({ monthlyNearMisses, totalNearMisses, monthlyEngineerGrowth, totalEngineerPower, monthlyRegistrationFeedback, engineerAssessment, registrationTrend, engineerTrend }: { monthlyNearMisses: number; totalNearMisses: number; monthlyEngineerGrowth: number; totalEngineerPower: number; monthlyRegistrationFeedback: { title: string; message: string; focus: string }; engineerAssessment: { title: string; message: string; nextAction: string }; registrationTrend: TrendPoint[]; engineerTrend: TrendPoint[] }) {
  return (
    <div className="stack">
      <div className="page-head">
        <div><h2>成長サマリー</h2><p className="subtle">登録したナレッジ・スキル・実績から、今月の伸びを確認します。</p></div>
      </div>
      <section className="metric-grid">
        <Metric icon={<ClipboardCheck size={19} />} label="今月のナレッジ数" value={`${monthlyNearMisses}件`} />
        <Metric icon={<ListChecks size={19} />} label="累計ナレッジ数" value={`${totalNearMisses}件`} />
        <Metric icon={<Sparkles size={19} />} label="今月のエンジニア力向上" value={`+${monthlyEngineerGrowth} EP`} />
        <Metric icon={<Trophy size={19} />} label="全体的なエンジニア力" value={`${totalEngineerPower} EP`} />
      </section>
      <section className="chart-grid">
        <div className="card stack">
          <div className="card-head"><div><h3>ナレッジ登録数の推移</h3><p className="subtle">登録したナレッジ件数を時系列で積み上げています。</p></div><span className="status-pill">{totalNearMisses}件 / 全体</span></div>
          <TrendLineChart points={registrationTrend} unit="件" ariaLabel="登録件数の推移" gradientId="registrationTrendFill" />
        </div>
        <div className="card stack">
          <div className="card-head"><div><h3>エンジニア力の推移</h3><p className="subtle">ナレッジ・スキル・実績のポイントを時系列で積み上げています。</p></div><span className="status-pill">+{monthlyEngineerGrowth} EP / 今月</span></div>
          <TrendLineChart points={engineerTrend} unit="EP" ariaLabel="エンジニア力の推移" gradientId="engineerTrendFill" />
        </div>
      </section>
      <section className="content-grid">
        <div className="card stack">
          <div className="card-head"><h3>今月のナレッジ評価コメント</h3><span className="status-pill"><Sparkles size={14} />monthly</span></div>
          <div className="ai-box"><strong>{monthlyRegistrationFeedback.title}</strong><p>{monthlyRegistrationFeedback.message}</p><p className="subtle">{monthlyRegistrationFeedback.focus}</p></div>
        </div>
        <div className="card stack">
          <div className="card-head"><h3>AIによるエンジニア評価</h3><span className="status-pill">AIコメント</span></div>
          <div className="summary-box"><strong>{engineerAssessment.title}</strong><p>{engineerAssessment.message}</p><p className="subtle">{engineerAssessment.nextAction}</p></div>
        </div>
      </section>
    </div>
  );
}

function TrendLineChart({ points, unit, ariaLabel, gradientId }: { points: TrendPoint[]; unit: string; ariaLabel: string; gradientId: string }) {
  const width = 720;
  const height = 220;
  const padding = 34;
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 100);
  const range = Math.max(1, maxValue - minValue);
  const xFor = (index: number) => padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
  const yFor = (value: number) => height - padding - ((value - minValue) * (height - padding * 2)) / range;
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(point.value)}`).join(" ");
  const area = `${line} L ${xFor(points.length - 1)} ${height - padding} L ${xFor(0)} ${height - padding} Z`;

  return (
    <div className="trend-chart" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${ariaLabel}が${points[0]?.value ?? 0}${unit}から${points.at(-1)?.value ?? 0}${unit}まで上がっています`}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#176f67" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#176f67" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = padding + ratio * (height - padding * 2);
          return <line key={ratio} className="trend-grid" x1={padding} x2={width - padding} y1={y} y2={y} />;
        })}
        <path className="trend-area" d={area} style={{ fill: `url(#${gradientId})` }} />
        <path className="trend-line" d={line} />
        {points.map((point, index) => <circle className="trend-dot" key={`${point.label}-${point.value}-${index}`} cx={xFor(index)} cy={yFor(point.value)} r="5" />)}
        {points.map((point, index) => <text className="trend-label" key={`${point.label}-${index}`} x={xFor(index)} y={height - 9} textAnchor="middle">{point.label}</text>)}
      </svg>
      <div className="trend-summary"><strong>{points[0]?.value ?? 0} {unit}</strong><span>から</span><strong>{points.at(-1)?.value ?? 0} {unit}</strong><span>へ</span></div>
    </div>
  );
}

function CreateView({ form, setForm, showOptional, setShowOptional, onSubmit, messages, chatInput, setChatInput, sendDraftMessage, resetDraftDiscussion }: { form: DraftForm; setForm: (form: DraftForm) => void; showOptional: boolean; setShowOptional: (value: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; messages: ChatMessage[]; chatInput: string; setChatInput: (value: string) => void; sendDraftMessage: (text: string) => void; resetDraftDiscussion: () => void }) {
  const draftContext = buildDraftContext(form);

  return (
    <section className="create-layout">
      <form className="card stack create-form" onSubmit={onSubmit}>
        <div className="page-head"><div><h2>ナレッジ登録</h2><p className="subtle">経験や気づきを入力すると、ナレッジポイントをAIが評価します。</p></div></div>
        <div className="two-col">
          <label>発生日時<input type="datetime-local" value={form.occurredAt} onChange={(event) => setForm({ ...form, occurredAt: event.target.value })} required /></label>
          <label>影響の有無<select value={form.actualHarm} onChange={(event) => setForm({ ...form, actualHarm: event.target.value as HarmLevel })}><option value="none">なし</option><option value="minor">軽微</option><option value="occurred">あり</option></select></label>
          <label>ステータス<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as NearMissStatus })}><option value="considering">検討中</option><option value="completed">完了</option></select></label>
        </div>
        <label>ナレッジの対象<input maxLength={200} value={form.workContext} onChange={(event) => setForm({ ...form, workContext: event.target.value })} placeholder="例: 本番ネットワーク設定変更" required /></label>
        <label>気づき・学びの内容<textarea maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="経験から得た気づきや学びを記録します" required /></label>
        <button className="secondary" type="button" onClick={() => setShowOptional(!showOptional)}>{showOptional ? "詳細を閉じる" : "詳細を追加"}</button>
        {showOptional && <div className="stack">
          <label>想定される影響<textarea value={form.potentialImpact} onChange={(event) => setForm({ ...form, potentialImpact: event.target.value })} /></label>
          <label>原因の自己認識<textarea value={form.perceivedCause} onChange={(event) => setForm({ ...form, perceivedCause: event.target.value })} /></label>
          <label>発見契機<textarea value={form.detectionTrigger} onChange={(event) => setForm({ ...form, detectionTrigger: event.target.value })} /></label>
          <label>次に活かす工夫<textarea value={form.userCountermeasure} onChange={(event) => setForm({ ...form, userCountermeasure: event.target.value })} /></label>
        </div>}
        <label className="check-row"><input type="checkbox" checked={form.confidentialityConfirmed} onChange={(event) => setForm({ ...form, confidentialityConfirmed: event.target.checked })} />登録内容に顧客名、APIキー、秘密鍵などの機密情報が含まれていないことを確認しました。</label>
        <div className="form-actions"><span className="help">必須項目と機密情報確認が完了すると登録できます。</span><button className="primary" type="submit"><Sparkles size={18} />ナレッジポイントを評価して登録</button></div>
      </form>

      <aside className="card stack create-discussion" aria-label="登録内容についてAIとディスカッション">
        <div className="card-head"><div><h2>AI整理メモ</h2><p className="subtle">入力中のナレッジを、AIと一緒に整理できます。</p></div><span className="status-pill"><Bot size={14} />draft</span></div>
        <div className="summary-box"><strong>ナレッジ下書き</strong><p>{draftContext}</p></div>
        <div className="ai-context-strip"><span><Bot size={16} />左側の内容をAI整理メモに反映します</span><button className="secondary" type="button" onClick={resetDraftDiscussion}>下書きを反映</button></div>
        <div className="chat-history compact" id="create-discussion-history">
          {messages.length ? messages.slice(-5).map((message) => <div className={`message ${message.role === "user" ? "user" : ""}`} key={message.id}>{message.role === "assistant" && <span className="avatar"><Bot size={17} /></span>}<div className="bubble"><p>{message.content}</p></div></div>) : <div className="empty slim">下書きを反映しました。続けて相談内容を入力してください。</div>}
        </div>
        <form className="create-chat-form" onSubmit={(event) => { event.preventDefault(); sendDraftMessage(chatInput); }}>
          <textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="例: 学びを整理して / 次に活かす方法を考えて / 要点をまとめて" />
          <button className="primary" type="submit"><MessageSquareText size={17} />相談する</button>
        </form>
      </aside>
    </section>
  );
}

function ListView({ items, searchText, setSearchText, listKindFilter, setListKindFilter, statusFilter, setStatusFilter, selectNearMiss }: { items: SearchListItem[]; searchText: string; setSearchText: (value: string) => void; listKindFilter: ListKind; setListKindFilter: (value: ListKind) => void; statusFilter: "all" | NearMissStatus; setStatusFilter: (value: "all" | NearMissStatus) => void; selectNearMiss: (id: string) => void }) {
  return (
    <section className="card stack">
      <div className="inline-row">
        <label><span className="help">キーワード検索</span><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="タイトル、内容、AI判定理由" /></label>
        <button className="ghost"><Search size={17} />検索</button>
      </div>
      <div className="tabs">
        {(["all", "knowledge", "skill", "achievement"] as const).map((kind) => <button key={kind} className={`chip ${listKindFilter === kind ? "active" : ""}`} onClick={() => setListKindFilter(kind)}>{listKindLabels[kind]}</button>)}
      </div>
      <div className="tabs">
        {(["all", "considering", "completed"] as const).map((status) => <button key={status} className={`chip ${statusFilter === status ? "active" : ""}`} onClick={() => setStatusFilter(status)}>{status === "all" ? "全ステータス" : nearMissStatusLabels[status]}</button>)}
      </div>
      <div className="list">
        {items.map((item) => <button key={item.id} className="list-item" onClick={() => item.nearMissId ? selectNearMiss(item.nearMissId) : undefined}><div><div className="list-title"><span className={`kind-badge ${item.kind}`}>{listKindLabels[item.kind]}</span><strong>{item.title}</strong></div><p className="subtle">{item.summary}</p><span className="small">{item.meta}</span></div><span className="point-pills"><span className={`point-pill ${item.kind === "skill" ? "skill" : item.kind === "achievement" ? "achievement" : ""}`}>{getListItemPointLabel(item)}</span></span></button>)}
      </div>
    </section>
  );
}

function QuestView({ registerSkill }: { registerSkill: (title: string, yearMonth: string) => void }) {
  const [skillText, setSkillText] = useState("");
  const [skillYearMonth, setSkillYearMonth] = useState(currentMonthInput);

  return (
    <form className="card stack" onSubmit={(event) => { event.preventDefault(); registerSkill(skillText, skillYearMonth); setSkillText(""); }}>
      <label>年月<input type="month" value={skillYearMonth} onChange={(event) => setSkillYearMonth(event.target.value)} /></label>
      <textarea className="large-entry" value={skillText} onChange={(event) => setSkillText(event.target.value)} placeholder="身についたスキルを入力" />
      <button className="primary" type="submit">スキルポイントを評価して登録</button>
    </form>
  );
}

function AchievementView({ registerAchievement }: { registerAchievement: (title: string, yearMonth: string) => void }) {
  const [achievementText, setAchievementText] = useState("");
  const [achievementYearMonth, setAchievementYearMonth] = useState(currentMonthInput);

  return (
    <form className="card stack" onSubmit={(event) => { event.preventDefault(); registerAchievement(achievementText, achievementYearMonth); setAchievementText(""); }}>
      <label>年月<input type="month" value={achievementYearMonth} onChange={(event) => setAchievementYearMonth(event.target.value)} /></label>
      <textarea className="large-entry" value={achievementText} onChange={(event) => setAchievementText(event.target.value)} placeholder="達成した実績を入力" />
      <button className="primary" type="submit">実績ポイントを評価して登録</button>
    </form>
  );
}

function ReportView({ reports, generateReport }: { reports: AiReport[]; generateReport: () => void }) {
  const reportYears = Array.from(new Set(reports.map((report) => report.periodKey.slice(0, 4))));
  const [selectedYear, setSelectedYear] = useState(reportYears[0] ?? String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(reports[0]?.periodKey.slice(5, 7) ?? String(new Date().getMonth() + 1).padStart(2, "0"));
  const [displayedPeriodKey, setDisplayedPeriodKey] = useState(reports[0]?.periodKey ?? "");
  const displayedReport = reports.find((report) => report.periodKey === displayedPeriodKey);
  const monthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

  useEffect(() => {
    if (!reports.length) return;
    const displayedExists = reports.some((report) => report.periodKey === displayedPeriodKey);
    if (!reportYears.includes(selectedYear)) setSelectedYear(reports[0].periodKey.slice(0, 4));
    if (!monthOptions.includes(selectedMonth)) setSelectedMonth(reports[0].periodKey.slice(5, 7));
    if (!displayedExists) setDisplayedPeriodKey(reports[0].periodKey);
  }, [displayedPeriodKey, monthOptions, reportYears, reports, selectedMonth, selectedYear]);

  return (
    <section className="card stack">
      <div className="card-head"><div><h2>月次レポート</h2><p className="subtle">選択した月のナレッジ・スキル・実績をもとに評価を作成します。</p></div><button className="primary" onClick={generateReport}><Sparkles size={16} />月次レポートを作成</button></div>
      {reports.length ? <>
        <div className="report-item report-picker"><label>年<select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>{reportYears.map((year) => <option key={year} value={year}>{year}年</option>)}</select></label><label>月<select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>{monthOptions.map((month) => <option key={month} value={month}>{Number(month)}月</option>)}</select></label><button className="primary" type="button" onClick={() => setDisplayedPeriodKey(`${selectedYear}-${selectedMonth}`)}>表示</button></div>
        {displayedReport ? <>
          <div className="report-item"><strong>月次評価</strong><p>{displayedReport.monthlyEvaluation.title}</p><p className="subtle">{displayedReport.monthlyEvaluation.message}</p><p className="small">{displayedReport.monthlyEvaluation.focus}</p></div>
          <div className="report-item"><strong>エンジニア力評価</strong><p>{displayedReport.engineerEvaluation.title}</p><p className="subtle">{displayedReport.engineerEvaluation.message}</p><p className="small">{displayedReport.engineerEvaluation.nextAction}</p></div>
        </> : <div className="empty slim">選択した年月のレポートは保存されていません。</div>}
      </> : <div className="empty">まだ月次レポートは作成されていません。月次レポートを作成すると、評価コメントを確認できます。</div>}
    </section>
  );
}

function SettingsView() {
  return (
    <section className="card stack">
      <h2>設定</h2>
      <div className="two-col"><label>タイムゾーン<input value="Asia/Tokyo" readOnly /></label><label>月次レポート通知<input value="毎月1日 07:00" readOnly /></label></div>
      <button className="danger" onClick={() => { window.localStorage.removeItem(storageKey); window.location.reload(); }}><RefreshCw size={17} />デモデータを初期化</button>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="metric"><span className="icon-tile">{icon}</span><span>{label}</span><strong>{value}</strong></div>;
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick} type="button">{icon}<span>{label}</span></button>;
}

function inferCategories(form: DraftForm) {
  const text = `${form.workContext} ${form.description} ${form.perceivedCause} ${form.userCountermeasure}`;
  const inferred = categories.filter((category) => text.includes(category.replace("不足", "")) || text.includes(category));
  if (text.includes("レビュー")) inferred.push("レビュー不足");
  if (text.includes("確認") || text.includes("照合")) inferred.push("確認漏れ");
  return Array.from(new Set(inferred)).slice(0, 3).length ? Array.from(new Set(inferred)).slice(0, 3) : ["その他"];
}

function buildDraftContext(form: DraftForm) {
  const fields = [
    form.workContext && `対象: ${form.workContext}`,
    `ステータス: ${nearMissStatusLabels[form.status]}`,
    form.description && `気づき: ${form.description}`,
    form.potentialImpact && `影響: ${form.potentialImpact}`,
    form.perceivedCause && `原因認識: ${form.perceivedCause}`,
    form.detectionTrigger && `発見契機: ${form.detectionTrigger}`,
    form.userCountermeasure && `次に活かす工夫: ${form.userCountermeasure}`,
  ].filter(Boolean);
  return fields.length ? fields.join(" / ") : "まだナレッジ内容がありません。左側に対象と気づき・学びの内容を入力すると、AI整理メモに反映されます。";
}

function deriveNearMissStatus(nearMiss: NearMiss): NearMissStatus {
  if (nearMiss.status) return nearMiss.status;
  return nearMiss.countermeasures.length > 0 && nearMiss.countermeasures.every((countermeasure) => ["completed", "verified"].includes(countermeasure.status)) ? "completed" : "considering";
}

function calculateRelatedSkillPoints(nearMissId: string, quests: Quest[]) {
  return quests.filter((quest) => quest.nearMissId === nearMissId && quest.xpGranted).reduce((total, quest) => total + quest.xp, 0);
}

function getListItemPointLabel(item: SearchListItem) {
  if (item.kind === "knowledge") return `${item.knowledgePoints ?? 0}KP`;
  if (item.kind === "skill") return `${item.skillPoints ?? 0}SP`;
  return `${item.achievementPoints ?? 0}AP`;
}

function buildSearchListItems(appState: AppState, searchText: string, kindFilter: ListKind, statusFilter: "all" | NearMissStatus): SearchListItem[] {
  const query = searchText.trim().toLowerCase();
  const matches = (values: string[]) => !query || values.join(" ").toLowerCase().includes(query);
  const items: SearchListItem[] = [];

  if (kindFilter === "all" || kindFilter === "knowledge") {
    items.push(...appState.nearMisses.filter((nearMiss) => {
      const status = deriveNearMissStatus(nearMiss);
      return (statusFilter === "all" || status === statusFilter) && matches([nearMiss.workContext, nearMiss.description, nearMiss.aiSummary, nearMiss.categories.join(" ")]);
    }).map((nearMiss) => ({
      id: `knowledge-${nearMiss.id}`,
      kind: "knowledge" as const,
      title: nearMiss.workContext,
      summary: nearMiss.aiSummary,
      meta: `${nearMiss.categories.join(" / ")} ・ 影響 ${harmLabels[nearMiss.actualHarm]} ・ ${nearMissStatusLabels[deriveNearMissStatus(nearMiss)]}`,
      knowledgePoints: nearMiss.knowledgePoints ?? 0,
      skillPoints: calculateRelatedSkillPoints(nearMiss.id, appState.quests),
      nearMissId: nearMiss.id,
    })));
  }

  if (statusFilter === "all" && (kindFilter === "all" || kindFilter === "skill")) {
    items.push(...(appState.acquiredSkills ?? []).filter((skill) => matches([skill.title, skill.reason])).map((skill) => ({
      id: `skill-${skill.id}`,
      kind: "skill" as const,
      title: skill.title,
      summary: skill.reason,
      meta: formatShortDate(skill.acquiredAt),
      skillPoints: skill.points,
    })));
  }

  if (statusFilter === "all" && (kindFilter === "all" || kindFilter === "achievement")) {
    items.push(...(appState.achievementRecords ?? []).filter((achievement) => matches([achievement.title, achievement.reason])).map((achievement) => ({
      id: `achievement-${achievement.id}`,
      kind: "achievement" as const,
      title: achievement.title,
      summary: achievement.reason,
      meta: formatShortDate(achievement.achievedAt),
      achievementPoints: achievement.points,
    })));
  }

  return items;
}

function buildKnowledgeSummary(form: DraftForm, riskLevel: RiskLevel) {
  const summary = `${form.workContext}で${form.description.slice(0, 42)}${form.description.length > 42 ? "..." : ""}`;
  return `${summary}。リスク目安は${riskLabels[riskLevel]}で、ナレッジとして記録しました。`;
}

function buildDraftCoachReply(text: string, form: DraftForm) {
  const work = form.workContext.trim() || "今回の作業";
  const event = form.description.trim() || "起こりそうだったこと";
  const impact = form.potentialImpact.trim() ? `想定影響は「${form.potentialImpact.trim()}」なので、` : "";
  const trigger = form.detectionTrigger.trim() ? `発見契機の「${form.detectionTrigger.trim()}」は有効に働いています。` : "発見契機も入れておくと、検出できた理由まで対策に変えやすくなります。";

  if (!form.workContext.trim() || !form.description.trim()) {
    return "左側の対象と気づき・学びをもう少し入れると、再利用できるナレッジとして整理しやすくなります。まずは何について、何を学んだかを1文ずつで十分です。";
  }
  if (text.includes("機密")) {
    const masked = maskSecrets(buildDraftContext(form));
    return masked === buildDraftContext(form) ? "登録下書きには典型的なAPIキー、Bearerトークン、秘密鍵の形式は見当たりません。顧客名や実IPなど固有情報は、保存前に一般化しておくとAI送信時も扱いやすいです。" : "登録下書きに機密候補があります。AIへ渡す前提では該当部分をマスクし、画面に残す原文も必要最小限にしてください。";
  }
  if (text.includes("原因")) {
    return `${work}で得た「${event}」という気づきは、識別情報、確認タイミング、手順の曖昧さに分けて整理すると再利用しやすいです。${trigger}`;
  }
  if (text.includes("完了")) {
    return `${work}のナレッジ完了条件は、次回使える確認観点、判断基準、活用場面が1つずつ書けていることです。証跡として登録日と見直し予定を残すと扱いやすいです。`;
  }
  if (text.includes("対策") || text.includes("強")) {
    return `${impact}ナレッジとして強くするなら、チェック観点、レビュー観点、自動検証のどれに転用できるかを追記すると価値が上がります。`;
  }
  return `${work}の下書きを前提に見ると、「${event}」は次回の判断材料として残す価値があります。活用場面、確認観点、再利用できる形を追記するとナレッジとして使いやすくなります。`;
}

function isInCurrentMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function buildMonthlyRegistrationFeedback(nearMisses: NearMiss[], acquiredSkills: AcquiredSkill[] = [], achievementRecords: AchievementRecord[] = []) {
  const monthlyItems = nearMisses.filter((nearMiss) => isInCurrentMonth(nearMiss.occurredAt));
  const monthlySkills = acquiredSkills.filter((skill) => isInCurrentMonth(skill.acquiredAt));
  const monthlyAchievements = achievementRecords.filter((achievement) => isInCurrentMonth(achievement.achievedAt));
  const knowledgePoints = monthlyItems.reduce((total, nearMiss) => total + (nearMiss.knowledgePoints ?? 0), 0);
  const skillPoints = monthlySkills.reduce((total, skill) => total + skill.points, 0);
  const achievementPoints = monthlyAchievements.reduce((total, achievement) => total + achievement.points, 0);
  const highOrCritical = monthlyItems.filter((nearMiss) => ["high", "critical"].includes(nearMiss.riskLevel)).length;

  if (monthlyItems.length === 0 && monthlySkills.length === 0 && monthlyAchievements.length === 0) {
    return {
      title: "次の一歩を始める準備ができています",
      message: "今月はまだ登録がありませんが、空白は悪い状態ではありません。過去の経験を見直して、次に残したい気づきを選ぶための余白として使えます。",
      focus: "次のステップ: まず1件、対象と気づき・学びだけを短く登録しましょう。小さな記録でも、成長の見える化はそこから始まります。",
    };
  }

  return {
    title: `今月も前に進めています`,
    message: `ナレッジ${monthlyItems.length}件、スキル${monthlySkills.length}件、実績${monthlyAchievements.length}件を登録できています。内訳は${knowledgePoints}KP、${skillPoints}SP、${achievementPoints}APです。${highOrCritical > 0 ? `${highOrCritical}件の高めのリスク目安を見逃さず記録できているのは、とても良い観察力です。` : "日々の気づきを安定して残せていて、成長の土台がしっかり積み上がっています。"}`,
    focus: buildMonthlyFocus(monthlyItems, monthlySkills, monthlyAchievements),
  };
}

function buildAiReport(nearMisses: NearMiss[], acquiredSkills: AcquiredSkill[], achievementRecords: AchievementRecord[], totalEngineerPower: number, monthlyGrowth: number, latestNearMiss?: NearMiss): AiReport {
  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    id: `report-${Date.now()}`,
    periodKey,
    generatedAt: now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
    periodLabel: `${now.getFullYear()}年${now.getMonth() + 1}月`,
    monthlyEvaluation: buildMonthlyRegistrationFeedback(nearMisses, acquiredSkills, achievementRecords),
    engineerEvaluation: buildEngineerAssessment(totalEngineerPower, monthlyGrowth, latestNearMiss, acquiredSkills, achievementRecords),
  };
}

function getSavedReports(appState: AppState) {
  const rawReports = [...(appState.reports ?? []), ...(appState.latestReport ? [appState.latestReport] : [])].map(normalizeReport);
  const uniqueReports = new Map<string, AiReport>();
  rawReports.forEach((report) => {
    const existing = uniqueReports.get(report.periodKey);
    if (!existing || new Date(report.generatedAt).getTime() >= new Date(existing.generatedAt).getTime()) {
      uniqueReports.set(report.periodKey, report);
    }
  });
  return [...uniqueReports.values()].sort((first, second) => second.periodKey.localeCompare(first.periodKey));
}

function normalizeReport(report: AiReport): AiReport {
  const periodKey = isValidPeriodKey(report.periodKey) ? report.periodKey : periodKeyFromLabel(report.periodLabel);
  return {
    ...report,
    periodKey,
  };
}

function isValidPeriodKey(periodKey?: string) {
  if (!periodKey) return false;
  const match = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function periodKeyFromLabel(periodLabel: string) {
  const match = periodLabel.match(/(\d{4})年(\d{1,2})月/);
  if (!match) return periodLabel;
  return `${match[1]}-${match[2].padStart(2, "0")}`;
}

function buildMonthlyFocus(monthlyItems: NearMiss[], monthlySkills: AcquiredSkill[], monthlyAchievements: AchievementRecord[]) {
  if (monthlyAchievements.length > 0) {
    return `次のステップ: 実績「${monthlyAchievements[0].title}」は素晴らしい成果です。この成果を再現できるように、使った判断や工夫を1件ナレッジ化しておきましょう。`;
  }
  if (monthlySkills.length > 0) {
    return `次のステップ: スキル「${monthlySkills[0].title}」を登録できているのは良い流れです。次はそのスキルを使った場面や成果を実績として残すと、成長がより伝わります。`;
  }
  if (monthlyItems.length > 0) {
    return `次のステップ: 最新ナレッジ「${monthlyItems[0].workContext}」は良い気づきです。チェック観点やレビュー観点に言い換えると、次に使えるスキルへ育てられます。`;
  }
  return "次のステップ: まずはナレッジ、スキル、実績のいずれかを1件残しましょう。小さな記録で十分です。";
}

function buildEngineerAssessment(totalEngineerPower: number, monthlyGrowth: number, latestNearMiss?: NearMiss, acquiredSkills: AcquiredSkill[] = [], achievementRecords: AchievementRecord[] = []) {
  const level = levelFromXp(totalEngineerPower);
  const category = latestNearMiss?.categories[0] ?? "確認漏れ";
  const monthlySkills = acquiredSkills.filter((skill) => isInCurrentMonth(skill.acquiredAt));
  const monthlyAchievements = achievementRecords.filter((achievement) => isInCurrentMonth(achievement.achievedAt));
  if (monthlyGrowth >= 50) {
    return {
      title: `Lv ${level} 大きく前進しています`,
      message: `今月は${monthlyGrowth}EP向上しています。スキル${monthlySkills.length}件、実績${monthlyAchievements.length}件も積み上がっていて、経験を成果までつなげる動きがはっきり見えます。とても良い伸び方です。`,
      nextAction: monthlyAchievements.length > 0 ? `次のステップ: 実績「${monthlyAchievements[0].title}」を軸に、再現できるスキルやナレッジを追加しましょう。成果をもう一度出せる形に残すと、評価がさらに強くなります。` : `次のステップ: ${category}に対して、レビュー観点の固定化や自動チェックを1件スキル化しましょう。今の勢いを、再利用できる力に変えられます。`,
    };
  }
  if (monthlyGrowth > 0) {
    return {
      title: `Lv ${level} 良いペースで積み上がっています`,
      message: `今月は${monthlyGrowth}EP向上しています。ナレッジ、スキル、実績の登録を通じて、経験をきちんと資産化できています。この継続はしっかり価値があります。`,
      nextAction: monthlySkills.length > 0 ? `次のステップ: スキル「${monthlySkills[0].title}」を実務で使った成果を、実績として登録しましょう。できたことまで残すと、自信にも評価にもつながります。` : `次のステップ: ${category}のナレッジから、次に使える確認観点や身についたスキルを1つ追加しましょう。`,
    };
  }
  return {
    title: `Lv ${level} ここから伸ばせます`,
    message: "今月のエンジニア力向上はまだ0EPですが、これは出遅れではありません。最初の1件を残せば、成長の記録はすぐに動き始めます。",
    nextAction: `次のステップ: ${category}に関する小さな気づきを1件ナレッジ化しましょう。完璧な文章でなくて大丈夫です。`,
  };
}

function buildRegistrationTrend(nearMisses: NearMiss[]): TrendPoint[] {
  const sorted = [...nearMisses].sort((first, second) => new Date(first.occurredAt).getTime() - new Date(second.occurredAt).getTime());
  let runningTotal = 0;
  const points: TrendPoint[] = [{ label: "開始", value: 0 }];

  sorted.forEach((nearMiss) => {
    runningTotal += 1;
    points.push({ label: formatShortDate(nearMiss.occurredAt), value: runningTotal });
  });

  if (points.length === 1) {
    points.push({ label: "現在", value: 0 });
  }

  return points;
}

function buildEngineerTrend(quests: Quest[], acquiredSkills: AcquiredSkill[], nearMisses: NearMiss[], achievementRecords: AchievementRecord[], totalEngineerPower: number): TrendPoint[] {
  const events = [
    ...quests.filter((quest) => quest.xpGranted).map((quest) => ({ date: quest.dueAt, points: quest.xp })),
    ...acquiredSkills.map((skill) => ({ date: skill.acquiredAt, points: skill.points })),
    ...nearMisses.filter((nearMiss) => (nearMiss.knowledgePoints ?? 0) > 0).map((nearMiss) => ({ date: nearMiss.occurredAt, points: nearMiss.knowledgePoints ?? 0 })),
    ...achievementRecords.map((achievement) => ({ date: achievement.achievedAt, points: achievement.points })),
  ].sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime());
  const completedPoints = events.reduce((total, event) => total + event.points, 0);
  let runningTotal = Math.max(0, totalEngineerPower - completedPoints);
  const points: TrendPoint[] = [{ label: "開始", value: runningTotal }];

  events.forEach((event) => {
    runningTotal += event.points;
    points.push({ label: formatShortDate(event.date), value: runningTotal });
  });

  if (points.length === 1) {
    points.push({ label: "現在", value: totalEngineerPower });
  }

  return points;
}

function judgeSkillPoints(title: string) {
  const normalized = title.toLowerCase();
  if (/自動|テスト|監視|ci|cd|script|スクリプト|型|lint|検証/.test(normalized)) {
    return { points: 50, reason: "AI判定: 自動化や検証の仕組みに関わるスキルのため50SPです。" };
  }
  if (/設計|レビュー|分析|改善|再発|原因|要件|仕様/.test(normalized)) {
    return { points: 30, reason: "AI判定: 設計、分析、レビューに関わる再利用しやすいスキルのため30SPです。" };
  }
  if (/確認|手順|チェック|共有|記録|整理/.test(normalized)) {
    return { points: 20, reason: "AI判定: 作業品質を安定させる基本スキルのため20SPです。" };
  }
  return { points: 10, reason: "AI判定: 新しく言語化されたスキルとして10SPです。" };
}

function judgeKnowledgePoints(form: DraftForm, riskLevel: RiskLevel) {
  const text = `${form.workContext} ${form.description} ${form.potentialImpact} ${form.perceivedCause} ${form.detectionTrigger} ${form.userCountermeasure}`;
  let points = 10;
  const reasons = ["気づきをナレッジとして記録できています"];

  if (form.description.length >= 30) {
    points += 10;
    reasons.push("起こりそうだったことが具体的です");
  }
  if (form.detectionTrigger.trim()) {
    points += 10;
    reasons.push("発見契機が残っており再利用しやすいです");
  }
  if (form.perceivedCause.trim()) {
    points += 10;
    reasons.push("原因仮説があり改善につなげやすいです");
  }
  if (/チェック|レビュー|自動|検証|監視|手順|防止/.test(text)) {
    points += 10;
    reasons.push("対策につながる語彙が含まれています");
  }
  if (["high", "critical"].includes(riskLevel)) {
    points += 10;
    reasons.push("高リスクの気づきを早めに言語化できています");
  }

  return {
    points: Math.min(points, 60),
    reason: `AI判定: ${reasons.join("。 ")}。`,
  };
}

function judgeAchievementPoints(title: string) {
  const normalized = title.toLowerCase();
  if (/障害|本番|リリース|改善|自動|削減|解決|復旧|設計/.test(normalized)) {
    return { points: 50, reason: "AI判定: 影響の大きい成果または改善実績として50APです。" };
  }
  if (/レビュー|共有|資料|標準化|手順|教育|支援|提案/.test(normalized)) {
    return { points: 30, reason: "AI判定: チームや将来の作業に再利用できる実績として30APです。" };
  }
  if (/対応|確認|調査|整理|記録/.test(normalized)) {
    return { points: 20, reason: "AI判定: 日々の業務改善につながる実績として20APです。" };
  }
  return { points: 10, reason: "AI判定: 実績として記録された行動に10APです。" };
}

function formatShortDate(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

