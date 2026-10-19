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
  Trash2,
} from "lucide-react";

type PageKey = "dashboard" | "create" | "list" | "quests" | "achievements" | "reports" | "settings";
type RiskLevel = "low" | "medium" | "high" | "critical";
type QuestStatus = "proposed" | "in_progress" | "completed" | "cancelled";
type HarmLevel = "none" | "minor" | "occurred";
type MessageRole = "user" | "assistant";
type NearMissStatus = "considering" | "completed";
type ListKind = "all" | "knowledge" | "skill" | "achievement";

type KnowledgeEntry = {
  id: string;
  recordedAt: string;
  content: string;
  knowledgePoints: number;
  knowledgePointReason: string;
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
  description: string;
  confidentialityConfirmed: boolean;
  potentialImpact: string;
  perceivedCause: string;
  detectionTrigger: string;
  userCountermeasure: string;
  actualHarm: HarmLevel;
  status: NearMissStatus;
  categories: string[];
  occurrence: number;
  severity: number;
  detectability: number;
  rpn: number;
  riskLevel: RiskLevel;
  points: number;
  reason: string;
  recordedAt: string;
};

type AchievementRecord = {
  id: string;
  title: string;
  points: number;
  reason: string;
  recordedAt: string;
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
  recordId: string;
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

type AiFeedback = {
  points: number;
  reason: string;
  riskLevel?: RiskLevel;
};

const readAiFeedback = (form: HTMLFormElement): AiFeedback | undefined => {
  const data = new FormData(form);
  const points = Number(data.get("aiPoints"));
  const reason = String(data.get("aiReason") ?? "").trim();
  const riskLevel = String(data.get("aiRiskLevel") ?? "");

  if (!Number.isInteger(points) || points < 0 || points > 100 || !reason) return undefined;
  return {
    points,
    reason,
    riskLevel: ["low", "medium", "high", "critical"].includes(riskLevel) ? riskLevel as RiskLevel : undefined,
  };
};

type AppState = {
  userEmail: string;
  totalXp: number;
  selectedId: string;
  nearMisses: KnowledgeEntry[];
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
const nearMissStatusLabels: Record<NearMissStatus, string> = { considering: "検討中", completed: "完了" };
const listKindLabels: Record<ListKind, string> = { all: "全て", knowledge: "ナレッジ", skill: "スキル", achievement: "実績" };
const pageTitles: Record<PageKey, string> = {
  dashboard: "ダッシュボード",
  create: "獲得ナレッジ",
  list: "登録一覧",
  quests: "スキル登録",
  achievements: "実績登録",
  reports: "レポート",
  settings: "設定",
};

const nowLocalInput = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const currentMonthInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const calculateRisk = (occurrence: number, severity: number, detectability: number) => {
  const rpn = occurrence * severity * detectability;
  const riskLevel: RiskLevel = rpn >= 80 ? "critical" : rpn >= 50 ? "high" : rpn >= 20 ? "medium" : "low";
  return { rpn, riskLevel };
};

const calculateKnowledgeRisk = (form: DraftForm) => {
  const occurrence = form.userCountermeasure.includes("注意") ? 4 : 3;
  const severity = form.actualHarm === "occurred" ? 5 : form.potentialImpact ? 4 : 3;
  const detectability = form.detectionTrigger ? 3 : 4;
  return { occurrence, severity, detectability, ...calculateRisk(occurrence, severity, detectability) };
};

const levelFromXp = (totalXp: number) => Math.floor(Math.sqrt(totalXp / 100)) + 1;

const maskSecrets = (value: string) =>
  value
    .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");

const sampleNearMisses: KnowledgeEntry[] = [
  {
    id: "nm-1",
    recordedAt: "2026-09-03T01:30",
    content: "対象機器を取り違えて設定しそうになった。実行直前にIPアドレスを照合して気づいた。",
    knowledgePoints: 0,
    knowledgePointReason: "初期データのため未判定です。",
  },
  {
    id: "nm-2",
    recordedAt: "2026-09-01T09:10",
    content: "検証環境のファイルを本番用として添付しそうになった。ファイル名規則が似ていた。",
    knowledgePoints: 0,
    knowledgePointReason: "初期データのため未判定です。",
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

const refreshServerState = async (fallbackState: AppState = initialState): Promise<AppState> => {
  try {
    const [knowledgeResponse, skillResponse, achievementResponse] = await Promise.all([
      fetch("/api/knowledge"),
      fetch("/api/skills"),
      fetch("/api/achievements"),
    ]);

    const saved = window.localStorage.getItem(storageKey);
    const baseState = saved ? (JSON.parse(saved) as AppState) : fallbackState;
    const nextState: AppState = { ...baseState };

    nextState.nearMisses = (baseState.nearMisses as unknown as Array<Record<string, unknown>>).map((entry) => ({
      id: String(entry.id ?? crypto.randomUUID()),
      recordedAt: String(entry.recordedAt ?? entry.occurredAt ?? new Date().toISOString()),
      content: String(entry.content ?? [entry.workContext, entry.description, entry.potentialImpact, entry.perceivedCause, entry.detectionTrigger, entry.userCountermeasure].filter(Boolean).join(" / ")),
      knowledgePoints: Number(entry.knowledgePoints ?? 0),
      knowledgePointReason: String(entry.knowledgePointReason ?? "以前のナレッジ記録から移行しました。"),
    }));

    if (knowledgeResponse.ok) {
      const knowledgeEntries = (await knowledgeResponse.json()) as Array<{
        id: string;
        recordedAt: string;
        content: string;
        knowledgePoints?: number;
        knowledgePointReason?: string;
      }>;

      nextState.nearMisses = knowledgeEntries.map((entry) => ({
        id: entry.id,
        recordedAt: entry.recordedAt,
        content: entry.content,
        knowledgePoints: entry.knowledgePoints ?? 0,
        knowledgePointReason: entry.knowledgePointReason ?? "DBから読み込んだナレッジです。",
      }));
    }

    if (skillResponse.ok) {
      const skills = (await skillResponse.json()) as Array<{
        id: string;
        title: string;
        description?: string;
        confidentialityConfirmed?: boolean;
        potentialImpact?: string | null;
        perceivedCause?: string | null;
        detectionTrigger?: string | null;
        reuseIdea?: string | null;
        impactLevel?: HarmLevel;
        status?: NearMissStatus;
        categories?: string[];
        occurrenceScore?: number | null;
        severityScore?: number | null;
        detectabilityScore?: number | null;
        rpn?: number | null;
        riskLevel?: RiskLevel | null;
        points: number;
        reason: string;
        recordedAt: string;
      }>;

      nextState.acquiredSkills = skills.map((skill) => ({
        id: skill.id,
        title: skill.title,
        description: skill.description ?? "",
        confidentialityConfirmed: skill.confidentialityConfirmed ?? false,
        potentialImpact: skill.potentialImpact ?? "",
        perceivedCause: skill.perceivedCause ?? "",
        detectionTrigger: skill.detectionTrigger ?? "",
        userCountermeasure: skill.reuseIdea ?? "",
        actualHarm: skill.impactLevel ?? "none",
        status: skill.status ?? "considering",
        categories: skill.categories ?? [],
        occurrence: skill.occurrenceScore ?? 3,
        severity: skill.severityScore ?? 3,
        detectability: skill.detectabilityScore ?? 3,
        rpn: skill.rpn ?? 27,
        riskLevel: skill.riskLevel ?? "low",
        points: skill.points,
        reason: skill.reason,
        recordedAt: skill.recordedAt,
      }));
    }

    if (achievementResponse.ok) {
      const achievements = (await achievementResponse.json()) as Array<{
        id: string;
        title: string;
        points: number;
        reason: string;
        recordedAt: string;
      }>;

      nextState.achievementRecords = achievements.map((achievement) => ({
        id: achievement.id,
        title: achievement.title,
        points: achievement.points,
        reason: achievement.reason,
        recordedAt: achievement.recordedAt,
      }));
    }

    const nextTotalXp = [...(nextState.nearMisses ?? []), ...((nextState.acquiredSkills ?? []) as unknown as Array<{ points: number }>), ...((nextState.achievementRecords ?? []) as unknown as Array<{ points: number }>)]
      .reduce((total, item) => total + (("knowledgePoints" in item ? item.knowledgePoints : "points" in item ? item.points : 0) as number), 0);

    nextState.totalXp = Math.max(nextTotalXp, 0);
    nextState.selectedId = nextState.nearMisses[0]?.id ?? "";
    return nextState;
  } catch (error) {
    console.warn("Failed to load server-side data", error);
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as AppState) : fallbackState;
  }
};

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
    const loadFromServer = async () => {
      const nextState = await refreshServerState(initialState);
      setAppState(nextState);
      setLoaded(true);
    };

    void loadFromServer();
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(storageKey, JSON.stringify(appState));
    }
  }, [appState, loaded]);

  const totalNearMisses = appState.nearMisses.length;
  const monthlyNearMisses = appState.nearMisses.filter((nearMiss) => isInCurrentMonth(nearMiss.recordedAt)).length;
  const monthlyKnowledgeGrowth = appState.nearMisses.filter((nearMiss) => isInCurrentMonth(nearMiss.recordedAt)).reduce((total, nearMiss) => total + (nearMiss.knowledgePoints ?? 0), 0);
  const monthlySkillGrowth = (appState.acquiredSkills ?? []).filter((skill) => isInCurrentMonth(skill.recordedAt)).reduce((total, skill) => total + skill.points, 0);
  const monthlyAchievementGrowth = (appState.achievementRecords ?? []).filter((achievement) => isInCurrentMonth(achievement.recordedAt)).reduce((total, achievement) => total + achievement.points, 0);
  const monthlyEngineerGrowth = appState.quests.filter((quest) => quest.xpGranted && isInCurrentMonth(quest.dueAt)).reduce((total, quest) => total + quest.xp, 0) + monthlySkillGrowth + monthlyKnowledgeGrowth + monthlyAchievementGrowth;
  const currentLevel = levelFromXp(appState.totalXp);
  const latestNearMiss = [...appState.nearMisses].sort((first, second) => new Date(second.recordedAt).getTime() - new Date(first.recordedAt).getTime())[0];
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
    setPage("quests");
  };

  const submitSkillFromKnowledgeForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const aiEvaluation = readAiFeedback(event.currentTarget);
    if (!aiEvaluation || !form.workContext.trim() || !form.description.trim() || !form.confidentialityConfirmed) {
      throw new Error("A current AI evaluation is required before registration.");
    }
    await registerSkill(form, aiEvaluation);

    setForm(blankForm());
    setShowOptional(false);
    setDraftMessages(initialDraftMessages);
    setPage("quests");
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

  const registerSkill = async (skillForm: DraftForm, aiEvaluation: AiFeedback) => {
    const title = skillForm.workContext.trim();
    if (!title) throw new Error("Skill title is required.");
    const risk = calculateKnowledgeRisk(skillForm);

    const response = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: skillForm.description.trim(),
        confidentialityConfirmed: skillForm.confidentialityConfirmed,
        potentialImpact: skillForm.potentialImpact.trim(),
        perceivedCause: skillForm.perceivedCause.trim(),
        detectionTrigger: skillForm.detectionTrigger.trim(),
        reuseIdea: skillForm.userCountermeasure.trim(),
        actualHarm: skillForm.actualHarm,
        status: skillForm.status,
        occurrence: risk.occurrence,
        severity: risk.severity,
        detectability: risk.detectability,
        rpn: risk.rpn,
        riskLevel: risk.riskLevel,
        recordedAt: new Date(skillForm.occurredAt).toISOString(),
        aiEvaluation,
      }),
    });

    if (!response.ok) throw new Error(`Skill registration failed with status ${response.status}.`);
    const refreshed = await refreshServerState(appState);
    setAppState(refreshed);
  };

  const registerKnowledge = async (title: string, yearMonth: string, aiEvaluation: AiFeedback) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error("Knowledge content is required.");

    const response = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordedAt: `${yearMonth}-01T00:00:00.000Z`,
        content: cleanTitle,
        aiEvaluation,
      }),
    });

    if (!response.ok) throw new Error(`Knowledge registration failed with status ${response.status}.`);
    const refreshed = await refreshServerState(appState);
    setAppState(refreshed);
  };

  const registerAchievement = async (title: string, yearMonth: string, aiEvaluation: AiFeedback) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error("Achievement title is required.");

    const response = await fetch("/api/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cleanTitle,
        recordedAt: `${yearMonth}-01T00:00:00.000Z`,
        aiEvaluation,
      }),
    });

    if (!response.ok) throw new Error(`Achievement registration failed with status ${response.status}.`);
    const refreshed = await refreshServerState(appState);
    setAppState(refreshed);
  };

  const deleteListItem = async (item: SearchListItem) => {
    const kindLabel = listKindLabels[item.kind];
    if (!window.confirm(`${kindLabel}「${item.title}」を削除しますか？`)) return;

    const endpoint = item.kind === "knowledge" ? "/api/knowledge" : item.kind === "skill" ? "/api/skills" : "/api/achievements";
    const response = await fetch(`${endpoint}?id=${encodeURIComponent(item.recordId)}`, { method: "DELETE" });

    if (!response.ok) {
      window.alert("削除できませんでした。時間をおいて再度お試しください。");
      return;
    }

    const refreshed = await refreshServerState(appState);
    setAppState(refreshed);
  };

  const generateReport = async (yearMonth: string) => {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearMonth }),
    });

    if (!response.ok) {
      throw new Error(`Report generation failed with status ${response.status}.`);
    }

    const report = (await response.json()) as AiReport;
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
        <div className="brand"><span className="brand-mark"><ShieldCheck size={21} /></span><span>skill hant</span></div>
        <nav className="nav" aria-label="主ナビゲーション">
          <NavButton icon={<BarChart3 size={18} />} label="ダッシュボード" active={page === "dashboard"} onClick={() => setPage("dashboard")} />
          <NavButton icon={<Swords size={18} />} label="獲得ナレッジ" active={page === "create"} onClick={() => setPage("create")} />
          <NavButton icon={<Plus size={18} />} label="スキル登録" active={page === "quests"} onClick={startNewDraft} />
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
        {page === "create" && <QuestView registerKnowledge={registerKnowledge} />}
        {page === "list" && <ListView items={listItems} searchText={searchText} setSearchText={setSearchText} listKindFilter={listKindFilter} setListKindFilter={setListKindFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} deleteItem={deleteListItem} />}
        {page === "quests" && <CreateView form={form} setForm={setForm} showOptional={showOptional} setShowOptional={setShowOptional} onSubmit={submitSkillFromKnowledgeForm} messages={draftMessages} chatInput={chatInput} setChatInput={setChatInput} sendDraftMessage={sendDraftMessage} resetDraftDiscussion={resetDraftDiscussion} />}
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
        <span className="badge">skill hant</span>
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

function CreateView({ form, setForm, showOptional, setShowOptional, onSubmit, messages, chatInput, setChatInput, sendDraftMessage, resetDraftDiscussion }: { form: DraftForm; setForm: (form: DraftForm) => void; showOptional: boolean; setShowOptional: (value: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>; messages: ChatMessage[]; chatInput: string; setChatInput: (value: string) => void; sendDraftMessage: (text: string) => void; resetDraftDiscussion: () => void }) {
  const draftContext = buildDraftContext(form);
  const [hasCurrentEvaluation, setHasCurrentEvaluation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasCurrentEvaluation || !readAiFeedback(event.currentTarget)) {
      setSubmitError("最新の入力内容でAI評価を取得してから登録してください。");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    try {
      await onSubmit(event);
    } catch (error) {
      console.error("Failed to register skill", error);
      setSubmitError("登録に失敗しました。入力内容とデータベース接続を確認して、もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="create-layout">
      <form className="card stack create-form" onSubmit={(event) => void submit(event)}>
        <div className="page-head"><div><h2>スキル登録</h2><p className="subtle">経験や気づきを入力すると、スキルポイントをAIが評価します。</p></div></div>
        <div className="two-col">
          <label>発生日時<input type="datetime-local" value={form.occurredAt} onChange={(event) => setForm({ ...form, occurredAt: event.target.value })} required /></label>
          <label>影響の有無<select value={form.actualHarm} onChange={(event) => setForm({ ...form, actualHarm: event.target.value as HarmLevel })}><option value="none">なし</option><option value="minor">軽微</option><option value="occurred">あり</option></select></label>
          <label>ステータス<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as NearMissStatus })}><option value="considering">検討中</option><option value="completed">完了</option></select></label>
        </div>
        <label>スキルの対象<input maxLength={200} value={form.workContext} onChange={(event) => setForm({ ...form, workContext: event.target.value })} placeholder="例: 本番ネットワーク設定変更" required /></label>
        <label>気づき・学びの内容<textarea maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="経験から得た気づきや学びを記録します" required /></label>
        <button className="secondary" type="button" onClick={() => setShowOptional(!showOptional)}>{showOptional ? "詳細を閉じる" : "詳細を追加"}</button>
        {showOptional && <div className="stack">
          <label>想定される影響<textarea value={form.potentialImpact} onChange={(event) => setForm({ ...form, potentialImpact: event.target.value })} /></label>
          <label>原因の自己認識<textarea value={form.perceivedCause} onChange={(event) => setForm({ ...form, perceivedCause: event.target.value })} /></label>
          <label>発見契機<textarea value={form.detectionTrigger} onChange={(event) => setForm({ ...form, detectionTrigger: event.target.value })} /></label>
          <label>次に活かす工夫<textarea value={form.userCountermeasure} onChange={(event) => setForm({ ...form, userCountermeasure: event.target.value })} /></label>
        </div>}
        <label className="check-row"><input type="checkbox" checked={form.confidentialityConfirmed} onChange={(event) => setForm({ ...form, confidentialityConfirmed: event.target.checked })} />登録内容に顧客名、APIキー、秘密鍵などの機密情報が含まれていないことを確認しました。</label>
        <AiFeedbackPreview
          kind="skill"
          pointUnit="SP"
          title={form.workContext}
          content={draftContext}
          extraContext={{ actualHarm: form.actualHarm, status: form.status, riskLevel: calculateKnowledgeRisk(form).riskLevel }}
          onValidityChange={setHasCurrentEvaluation}
        />
        {submitError && <p className="feedback-error" role="alert">{submitError}</p>}
        <div className="form-actions"><span className="help">最新のAI評価を確認し、必須項目と機密情報確認が完了すると登録できます。</span><button className="primary" type="submit" disabled={!hasCurrentEvaluation || isSubmitting || !form.workContext.trim() || !form.description.trim() || !form.confidentialityConfirmed}><Sparkles size={18} />{isSubmitting ? "登録中…" : "この内容で登録"}</button></div>
      </form>

      <aside className="card stack create-discussion" aria-label="登録内容についてAIとディスカッション">
        <div className="card-head"><div><h2>AI整理メモ</h2><p className="subtle">入力中のスキルを、AIと一緒に整理できます。</p></div><span className="status-pill"><Bot size={14} />draft</span></div>
        <div className="summary-box"><strong>スキル下書き</strong><p>{draftContext}</p></div>
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

function ListView({ items, searchText, setSearchText, listKindFilter, setListKindFilter, statusFilter, setStatusFilter, deleteItem }: { items: SearchListItem[]; searchText: string; setSearchText: (value: string) => void; listKindFilter: ListKind; setListKindFilter: (value: ListKind) => void; statusFilter: "all" | NearMissStatus; setStatusFilter: (value: "all" | NearMissStatus) => void; deleteItem: (item: SearchListItem) => void }) {
  const [searchInput, setSearchInput] = useState(searchText);

  return (
    <section className="card stack">
      <form className="inline-row" onSubmit={(event) => { event.preventDefault(); setSearchText(searchInput); }}>
        <label><span className="help">キーワード検索</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="タイトル、内容、AI判定理由、日付" /></label>
        <button className="ghost" type="submit"><Search size={17} />検索</button>
      </form>
      <div className="tabs">
        {(["all", "knowledge", "skill", "achievement"] as const).map((kind) => <button key={kind} className={`chip ${listKindFilter === kind ? "active" : ""}`} onClick={() => setListKindFilter(kind)}>{listKindLabels[kind]}</button>)}
      </div>
      <div className="tabs">
        {(["all", "considering", "completed"] as const).map((status) => <button key={status} className={`chip ${statusFilter === status ? "active" : ""}`} onClick={() => setStatusFilter(status)}>{status === "all" ? "全ステータス" : nearMissStatusLabels[status]}</button>)}
      </div>
      <div className="list">
        {items.map((item) => <article key={item.id} className="list-item"><div className="list-item-open" aria-label={`${item.title}の詳細`}><div><div className="list-title"><span className={`kind-badge ${item.kind}`}>{listKindLabels[item.kind]}</span><strong>{item.title}</strong></div><p className="subtle">{item.summary}</p><span className="small">{item.meta}</span></div></div><span className="point-pills"><span className={`point-pill ${item.kind === "skill" ? "skill" : item.kind === "achievement" ? "achievement" : ""}`}>{getListItemPointLabel(item)}</span><button className="delete-icon" type="button" aria-label={`${item.title}を削除`} title="削除" onClick={() => deleteItem(item)}><Trash2 size={17} /></button></span></article>)}
        {items.length === 0 && <div className="empty slim">条件に一致する登録データはありません。</div>}
      </div>
    </section>
  );
}

function QuestView({ registerKnowledge }: { registerKnowledge: (title: string, yearMonth: string, aiEvaluation: AiFeedback) => Promise<void> }) {
  const [skillText, setSkillText] = useState("");
  const [skillYearMonth, setSkillYearMonth] = useState(currentMonthInput);
  const [hasCurrentEvaluation, setHasCurrentEvaluation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const evaluation = readAiFeedback(event.currentTarget);
    if (!hasCurrentEvaluation || !evaluation) {
      setSubmitError("最新の入力内容でAI評価を取得してから登録してください。");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    try {
      await registerKnowledge(skillText, skillYearMonth, evaluation);
      setSkillText("");
    } catch (error) {
      console.error("Failed to register knowledge", error);
      setSubmitError("登録に失敗しました。入力内容とデータベース接続を確認して、もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="card stack" onSubmit={(event) => void submit(event)}>
      <label>年月<input type="month" value={skillYearMonth} onChange={(event) => setSkillYearMonth(event.target.value)} /></label>
      <textarea className="large-entry" value={skillText} onChange={(event) => setSkillText(event.target.value)} placeholder="身についたナレッジを入力" />
      <AiFeedbackPreview kind="knowledge" pointUnit="KP" title={skillText} content={skillText} extraContext={{ yearMonth: skillYearMonth }} onValidityChange={setHasCurrentEvaluation} />
      {submitError && <p className="feedback-error" role="alert">{submitError}</p>}
      <button className="primary" type="submit" disabled={!hasCurrentEvaluation || isSubmitting || !skillText.trim()}>{isSubmitting ? "登録中…" : "この内容で登録"}</button>
    </form>
  );
}

function AchievementView({ registerAchievement }: { registerAchievement: (title: string, yearMonth: string, aiEvaluation: AiFeedback) => Promise<void> }) {
  const [achievementText, setAchievementText] = useState("");
  const [achievementYearMonth, setAchievementYearMonth] = useState(currentMonthInput);
  const [hasCurrentEvaluation, setHasCurrentEvaluation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const evaluation = readAiFeedback(event.currentTarget);
    if (!hasCurrentEvaluation || !evaluation) {
      setSubmitError("最新の入力内容でAI評価を取得してから登録してください。");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    try {
      await registerAchievement(achievementText, achievementYearMonth, evaluation);
      setAchievementText("");
    } catch (error) {
      console.error("Failed to register achievement", error);
      setSubmitError("登録に失敗しました。入力内容とデータベース接続を確認して、もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="card stack" onSubmit={(event) => void submit(event)}>
      <label>年月<input type="month" value={achievementYearMonth} onChange={(event) => setAchievementYearMonth(event.target.value)} /></label>
      <textarea className="large-entry" value={achievementText} onChange={(event) => setAchievementText(event.target.value)} placeholder="達成した実績を入力" />
      <AiFeedbackPreview kind="achievement" pointUnit="AP" title={achievementText} content={achievementText} extraContext={{ yearMonth: achievementYearMonth }} onValidityChange={setHasCurrentEvaluation} />
      {submitError && <p className="feedback-error" role="alert">{submitError}</p>}
      <button className="primary" type="submit" disabled={!hasCurrentEvaluation || isSubmitting || !achievementText.trim()}>{isSubmitting ? "登録中…" : "この内容で登録"}</button>
    </form>
  );
}

function AiFeedbackPreview({ kind, pointUnit, title, content, extraContext, onValidityChange }: { kind: "knowledge" | "skill" | "achievement"; pointUnit: "KP" | "SP" | "AP"; title: string; content: string; extraContext?: Record<string, unknown>; onValidityChange?: (isValid: boolean) => void }) {
  const [feedback, setFeedback] = useState<AiFeedback | null>(null);
  const [evaluatedContent, setEvaluatedContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const currentContent = JSON.stringify({ title: title.trim(), content: content.trim(), extraContext });
  const isStale = Boolean(feedback && evaluatedContent !== currentContent);

  useEffect(() => {
    onValidityChange?.(Boolean(feedback && !isStale));
  }, [feedback, isStale, onValidityChange]);

  const evaluate = async () => {
    if (!title.trim() && !content.trim()) return;
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title: title.trim(), content: content.trim(), extraContext }),
      });
      if (!response.ok) throw new Error("AI評価を取得できませんでした。");
      setFeedback((await response.json()) as AiFeedback);
      setEvaluatedContent(currentContent);
    } catch {
      setError("AIフィードバックを取得できませんでした。時間をおいて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="ai-feedback-preview" aria-live="polite">
      <div className="ai-feedback-head">
        <div><strong><Bot size={17} />AIフィードバック</strong><p className="help">登録前にポイントの目安と判定理由を確認できます。</p></div>
        <button className="secondary" type="button" disabled={isLoading || (!title.trim() && !content.trim())} onClick={() => void evaluate()}>
          <Sparkles size={16} />{isLoading ? "評価中…" : feedback ? "AI評価を再取得" : "AI評価を取得"}
        </button>
      </div>
      {feedback && <div className={`ai-feedback-result ${isStale ? "stale" : ""}`}>
        <span className="feedback-points">{feedback.points}{pointUnit}</span>
        <p>{feedback.reason}</p>
      </div>}
      {feedback && !isStale && <>
        <input type="hidden" name="aiPoints" value={feedback.points} />
        <input type="hidden" name="aiReason" value={feedback.reason} />
        <input type="hidden" name="aiRiskLevel" value={feedback.riskLevel ?? ""} />
      </>}
      {error && <p className="feedback-error">{error}</p>}
    </section>
  );
}

function ReportView({ reports, generateReport }: { reports: AiReport[]; generateReport: (yearMonth: string) => Promise<void> }) {
  const [selectedPeriod, setSelectedPeriod] = useState(reports[0]?.periodKey ?? currentMonthInput());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const displayedReport = reports.find((report) => report.periodKey === selectedPeriod);

  const createReport = async () => {
    setIsGenerating(true);
    setError("");
    try {
      await generateReport(selectedPeriod);
    } catch (cause) {
      console.error("Failed to generate monthly report", cause);
      setError("レポートを作成できませんでした。時間をおいて再度お試しください。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="card stack">
      <div className="card-head"><div><h2>月次レポート</h2><p className="subtle">選択した年月のナレッジ・スキル・実績を集計します。</p></div><button className="primary" type="button" disabled={isGenerating} onClick={() => void createReport()}><Sparkles size={16} />{isGenerating ? "作成中…" : "月次レポートを作成"}</button></div>
      <div className="report-item report-picker"><label>対象年月<input type="month" value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)} required /></label></div>
      {error && <p className="feedback-error" role="alert">{error}</p>}
      {displayedReport ? <>
        <div className="report-item"><strong>月次評価</strong><p>{displayedReport.monthlyEvaluation.title}</p><p className="subtle">{displayedReport.monthlyEvaluation.message}</p><p className="small">{displayedReport.monthlyEvaluation.focus}</p></div>
        <div className="report-item"><strong>エンジニア力評価</strong><p>{displayedReport.engineerEvaluation.title}</p><p className="subtle">{displayedReport.engineerEvaluation.message}</p><p className="small">{displayedReport.engineerEvaluation.nextAction}</p></div>
      </> : <div className="empty slim">選択した年月のレポートは保存されていません。</div>}
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
  return fields.length ? fields.join(" / ") : "まだスキル内容がありません。左側に対象と気づき・学びの内容を入力すると、AI整理メモに反映されます。";
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
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja").replace(/\s+/g, " ").trim();
  const queryWords = normalize(searchText).split(" ").filter(Boolean);
  const matches = (values: Array<string | number | null | undefined>) => {
    if (queryWords.length === 0) return true;
    const haystack = normalize(values.filter((value) => value != null).join(" "));
    return queryWords.every((word) => haystack.includes(word));
  };
  const items: SearchListItem[] = [];

  if (kindFilter === "all" || kindFilter === "knowledge") {
    items.push(...appState.nearMisses.filter((entry) => statusFilter === "all" && matches([entry.content, entry.knowledgePointReason, entry.recordedAt, entry.knowledgePoints])).map((entry) => ({
      id: `knowledge-${entry.id}`,
      recordId: entry.id,
      kind: "knowledge" as const,
      title: entry.content,
      summary: entry.knowledgePointReason,
      meta: formatShortDate(entry.recordedAt),
      knowledgePoints: entry.knowledgePoints,
      skillPoints: calculateRelatedSkillPoints(entry.id, appState.quests),
      nearMissId: entry.id,
    })));
  }

  if (statusFilter === "all" && (kindFilter === "all" || kindFilter === "skill")) {
    items.push(...(appState.acquiredSkills ?? []).filter((skill) => matches([skill.title, skill.description, skill.potentialImpact, skill.perceivedCause, skill.detectionTrigger, skill.userCountermeasure, skill.reason, skill.recordedAt, skill.points])).map((skill) => ({
      id: `skill-${skill.id}`,
      recordId: skill.id,
      kind: "skill" as const,
      title: skill.title,
      summary: skill.description || skill.reason,
      meta: formatShortDate(skill.recordedAt),
      skillPoints: skill.points,
    })));
  }

  if (statusFilter === "all" && (kindFilter === "all" || kindFilter === "achievement")) {
    items.push(...(appState.achievementRecords ?? []).filter((achievement) => matches([achievement.title, achievement.reason, achievement.recordedAt, achievement.points])).map((achievement) => ({
      id: `achievement-${achievement.id}`,
      recordId: achievement.id,
      kind: "achievement" as const,
      title: achievement.title,
      summary: achievement.reason,
      meta: formatShortDate(achievement.recordedAt),
      achievementPoints: achievement.points,
    })));
  }

  return items;
}

function buildDraftCoachReply(text: string, form: DraftForm) {
  const work = form.workContext.trim() || "今回の作業";
  const event = form.description.trim() || "起こりそうだったこと";
  const impact = form.potentialImpact.trim() ? `想定影響は「${form.potentialImpact.trim()}」なので、` : "";
  const trigger = form.detectionTrigger.trim() ? `発見契機の「${form.detectionTrigger.trim()}」は有効に働いています。` : "発見契機も入れておくと、検出できた理由まで対策に変えやすくなります。";

  if (!form.workContext.trim() || !form.description.trim()) {
    return "左側の対象と気づき・学びをもう少し入れると、再利用できるスキルとして整理しやすくなります。まずは何について、何を学んだかを1文ずつで十分です。";
  }
  if (text.includes("機密")) {
    const masked = maskSecrets(buildDraftContext(form));
    return masked === buildDraftContext(form) ? "登録下書きには典型的なAPIキー、Bearerトークン、秘密鍵の形式は見当たりません。顧客名や実IPなど固有情報は、保存前に一般化しておくとAI送信時も扱いやすいです。" : "登録下書きに機密候補があります。AIへ渡す前提では該当部分をマスクし、画面に残す原文も必要最小限にしてください。";
  }
  if (text.includes("原因")) {
    return `${work}で得た「${event}」という気づきは、識別情報、確認タイミング、手順の曖昧さに分けて整理すると再利用しやすいです。${trigger}`;
  }
  if (text.includes("完了")) {
    return `${work}のスキル完了条件は、次回使える確認観点、判断基準、活用場面が1つずつ書けていることです。証跡として登録日と見直し予定を残すと扱いやすいです。`;
  }
  if (text.includes("対策") || text.includes("強")) {
    return `${impact}スキルとして強くするなら、チェック観点、レビュー観点、自動検証のどれに転用できるかを追記すると価値が上がります。`;
  }
  return `${work}の下書きを前提に見ると、「${event}」は次回の判断材料として残す価値があります。活用場面、確認観点、再利用できる形を追記するとスキルとして使いやすくなります。`;
}

function isInCurrentMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function buildMonthlyRegistrationFeedback(nearMisses: KnowledgeEntry[], acquiredSkills: AcquiredSkill[] = [], achievementRecords: AchievementRecord[] = []) {
  const monthlyItems = nearMisses.filter((nearMiss) => isInCurrentMonth(nearMiss.recordedAt));
  const monthlySkills = acquiredSkills.filter((skill) => isInCurrentMonth(skill.recordedAt));
  const monthlyAchievements = achievementRecords.filter((achievement) => isInCurrentMonth(achievement.recordedAt));
  const knowledgePoints = monthlyItems.reduce((total, nearMiss) => total + (nearMiss.knowledgePoints ?? 0), 0);
  const skillPoints = monthlySkills.reduce((total, skill) => total + skill.points, 0);
  const achievementPoints = monthlyAchievements.reduce((total, achievement) => total + achievement.points, 0);
  if (monthlyItems.length === 0 && monthlySkills.length === 0 && monthlyAchievements.length === 0) {
    return {
      title: "次の一歩を始める準備ができています",
      message: "今月はまだ登録がありませんが、空白は悪い状態ではありません。過去の経験を見直して、次に残したい気づきを選ぶための余白として使えます。",
      focus: "次のステップ: まず1件、対象と気づき・学びだけを短く登録しましょう。小さな記録でも、成長の見える化はそこから始まります。",
    };
  }

  return {
    title: `今月も前に進めています`,
    message: `ナレッジ${monthlyItems.length}件、スキル${monthlySkills.length}件、実績${monthlyAchievements.length}件を登録できています。内訳は${knowledgePoints}KP、${skillPoints}SP、${achievementPoints}APです。日々の学びを記録できていて、成長の土台が積み上がっています。`,
    focus: buildMonthlyFocus(monthlyItems, monthlySkills, monthlyAchievements),
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

function buildMonthlyFocus(monthlyItems: KnowledgeEntry[], monthlySkills: AcquiredSkill[], monthlyAchievements: AchievementRecord[]) {
  if (monthlyAchievements.length > 0) {
    return `次のステップ: 実績「${monthlyAchievements[0].title}」は素晴らしい成果です。この成果を再現できるように、使った判断や工夫を1件ナレッジ化しておきましょう。`;
  }
  if (monthlySkills.length > 0) {
    return `次のステップ: スキル「${monthlySkills[0].title}」を登録できているのは良い流れです。次はそのスキルを使った場面や成果を実績として残すと、成長がより伝わります。`;
  }
  if (monthlyItems.length > 0) {
    return `次のステップ: 最新ナレッジ「${monthlyItems[0].content.slice(0, 40)}」は良い記録です。次に使える確認観点や判断基準を追記すると、再利用しやすくなります。`;
  }
  return "次のステップ: まずはナレッジ、スキル、実績のいずれかを1件残しましょう。小さな記録で十分です。";
}

function buildEngineerAssessment(totalEngineerPower: number, monthlyGrowth: number, latestNearMiss?: KnowledgeEntry, acquiredSkills: AcquiredSkill[] = [], achievementRecords: AchievementRecord[] = []) {
  const level = levelFromXp(totalEngineerPower);
  const knowledgeFocus = latestNearMiss?.content.trim() ? `「${latestNearMiss.content.slice(0, 32)}」` : "日々の気づき";
  const monthlySkills = acquiredSkills.filter((skill) => isInCurrentMonth(skill.recordedAt));
  const monthlyAchievements = achievementRecords.filter((achievement) => isInCurrentMonth(achievement.recordedAt));
  if (monthlyGrowth >= 50) {
    return {
      title: `Lv ${level} 大きく前進しています`,
      message: `今月は${monthlyGrowth}EP向上しています。スキル${monthlySkills.length}件、実績${monthlyAchievements.length}件も積み上がっていて、経験を成果までつなげる動きがはっきり見えます。とても良い伸び方です。`,
      nextAction: monthlyAchievements.length > 0 ? `次のステップ: 実績「${monthlyAchievements[0].title}」を軸に、再現できるスキルやナレッジを追加しましょう。成果をもう一度出せる形に残すと、評価がさらに強くなります。` : `次のステップ: ${knowledgeFocus}から、確認観点や自動チェックなど再利用できるスキルを1件記録しましょう。`,
    };
  }
  if (monthlyGrowth > 0) {
    return {
      title: `Lv ${level} 良いペースで積み上がっています`,
      message: `今月は${monthlyGrowth}EP向上しています。ナレッジ、スキル、実績の登録を通じて、経験をきちんと資産化できています。この継続はしっかり価値があります。`,
      nextAction: monthlySkills.length > 0 ? `次のステップ: スキル「${monthlySkills[0].title}」を実務で使った成果を、実績として登録しましょう。できたことまで残すと、自信にも評価にもつながります。` : `次のステップ: ${knowledgeFocus}から、次に使える確認観点や身についたスキルを1つ追加しましょう。`,
    };
  }
  return {
    title: `Lv ${level} ここから伸ばせます`,
    message: "今月のエンジニア力向上はまだ0EPですが、これは出遅れではありません。最初の1件を残せば、成長の記録はすぐに動き始めます。",
    nextAction: `次のステップ: ${knowledgeFocus}に関する小さな学びを1件記録しましょう。完璧な文章でなくて大丈夫です。`,
  };
}

function buildRegistrationTrend(nearMisses: KnowledgeEntry[]): TrendPoint[] {
  const sorted = [...nearMisses].sort((first, second) => new Date(first.recordedAt).getTime() - new Date(second.recordedAt).getTime());
  let runningTotal = 0;
  const points: TrendPoint[] = [{ label: "開始", value: 0 }];

  sorted.forEach((nearMiss) => {
    runningTotal += 1;
    points.push({ label: formatShortDate(nearMiss.recordedAt), value: runningTotal });
  });

  if (points.length === 1) {
    points.push({ label: "現在", value: 0 });
  }

  return points;
}

function buildEngineerTrend(quests: Quest[], acquiredSkills: AcquiredSkill[], nearMisses: KnowledgeEntry[], achievementRecords: AchievementRecord[], totalEngineerPower: number): TrendPoint[] {
  const events = [
    ...quests.filter((quest) => quest.xpGranted).map((quest) => ({ date: quest.dueAt, points: quest.xp })),
    ...acquiredSkills.map((skill) => ({ date: skill.recordedAt, points: skill.points })),
    ...nearMisses.filter((nearMiss) => (nearMiss.knowledgePoints ?? 0) > 0).map((nearMiss) => ({ date: nearMiss.recordedAt, points: nearMiss.knowledgePoints ?? 0 })),
    ...achievementRecords.map((achievement) => ({ date: achievement.recordedAt, points: achievement.points })),
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


function formatShortDate(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
