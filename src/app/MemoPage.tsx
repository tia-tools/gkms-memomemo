import { useEffect, useMemo, useState } from "preact/hooks";
import type { Idol } from "../data/contract.ts";
import { hasGaps } from "../memo/coverage.ts";
import { findRow } from "../memo/edit.ts";
import { type Build, emptyMemo, type Memo, PLAN_IDS, planOf, type PlanId, type SectionId, sectionsOf } from "../memo/types.ts";
import type { Catalog } from "./catalog.ts";
import { countEvent, type Counts, type CountsApi, NO_COUNTS } from "./counts.ts";
import { PLAN_LABELS } from "./labels.ts";
import { type Page, PageContext } from "./page.ts";
import { QuickTable } from "./QuickTable.tsx";
import { SectionView } from "./Section.tsx";
import { HomeScreenHint, Settings } from "./Settings.tsx";
import type { IconIndex } from "./sheets.ts";
import { DEFAULT_SETTINGS, NOT_SAVING, type Saving, type Settings as SavedSettings } from "./storage.ts";
import { ImportPanel, Transfer } from "./Transfer.tsx";
import { useImport, useLinkImport } from "./useImport.ts";
import { useSaving } from "./useSaving.ts";

/** How long a jumped-to row stays highlighted. */
export const HIGHLIGHT_MS = 2000;

function Tabs({ tab, onTab }: { tab: PlanId; onTab: (plan: PlanId) => void }) {
  return (
    <nav role="tablist" class="flex border-b border-slate-300">
      {PLAN_IDS.map((plan) => (
        <button
          key={plan}
          type="button"
          role="tab"
          aria-selected={tab === plan}
          class={`flex-1 px-3 py-2 font-bold ${tab === plan ? "border-b-2 border-pink-500 text-pink-600" : "text-slate-500"}`}
          onClick={() => onTab(plan)}
        >
          {PLAN_LABELS[plan]}
        </button>
      ))}
    </nav>
  );
}

/** Scrolls a jumped-to row into view once it is drawn, and drops its highlight after a while. */
function useHighlight(): [string | null, (rowId: string) => void] {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  useEffect(() => {
    if (highlighted === null) return;
    document.getElementById(`row-${highlighted}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    const timer = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);
  return [highlighted, setHighlighted];
}

/** The counts, loaded once when the page starts; null until then, and if they cannot be had. */
function useCounts(api: CountsApi): Counts | null {
  const [counts, setCounts] = useState<Counts | null>(null);
  useEffect(() => {
    void api.load().then(setCounts);
  }, [api]);
  return counts;
}

/** The saved idol where the data file still has it, else the default (D20's fallback, D34). */
function startIdol(saved: string | null, idols: readonly Idol[]): string {
  return idols.find((i) => i.id === saved)?.id ?? idols[0]?.id ?? "";
}

/**
 * The memo page (Milestones 4 and 5): the three tabs, each with its 早見表, the 「未所持がある行だけ
 * 表示」 toggle and its sections, and the settings with the 引き継ぎコード. It starts from the memo
 * and the settings saved (`initial`, `settings`) and saves each change through `save`; a link's
 * code is offered at the top of the page. `countsApi` loads the counts that rank the pickers and
 * sends a new row's event while counting is on (Milestone 6).
 */
export function MemoPage({
  catalog,
  sheets,
  initial,
  settings = DEFAULT_SETTINGS,
  save = NOT_SAVING,
  countsApi = NO_COUNTS,
}: {
  catalog: Catalog;
  sheets: IconIndex;
  initial?: Memo;
  settings?: SavedSettings;
  save?: Saving;
  countsApi?: CountsApi;
}) {
  const defaultIdol = catalog.data.idols[0]?.id ?? "";
  const [memo, setMemo] = useState<Memo>(() => initial ?? emptyMemo());
  const [tab, setTab] = useState<PlanId>("sense");
  const [idol, setIdol] = useState(() => startIdol(settings.idol, catalog.data.idols));
  const [counting, setCounting] = useState(settings.counting);
  useSaving(save, memo, idol, counting);
  const importing = useImport(memo, setMemo);
  useLinkImport(importing.offer);
  const [gapsOnly, setGapsOnly] = useState(false);
  const [highlighted, highlight] = useHighlight();
  const counts = useCounts(countsApi);
  const page = useMemo<Page>(() => {
    const jumpTo = (rowId: string) => {
      const place = findRow(memo, rowId);
      if (place === null) return;
      setTab(planOf(place.section));
      if (!hasGaps(place.row)) setGapsOnly(false);
      highlight(rowId);
    };
    const countRow = (section: SectionId, build: Build) => {
      if (counting) countsApi.send(countEvent(section, build));
    };
    return { catalog, sheets, idol, defaultIdol, memo, setMemo, jumpTo, highlighted, counts, countRow };
  }, [catalog, sheets, idol, defaultIdol, memo, highlighted, highlight, counts, counting, countsApi]);
  return (
    <PageContext.Provider value={page}>
      <ImportPanel importing={importing} from="link" />
      <Tabs tab={tab} onTab={setTab} />
      <div class="flex flex-col gap-3 pt-3">
        <QuickTable plan={tab} />
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.currentTarget.checked)} />
          未所持がある行だけ表示
        </label>
        {sectionsOf(tab).map((section) => (
          <SectionView key={section} section={section} plan={tab} gapsOnly={gapsOnly} />
        ))}
      </div>
      <Settings idols={catalog.data.idols} idol={idol} onIdol={setIdol} counting={counting} onCounting={setCounting}>
        <HomeScreenHint />
        <Transfer importing={importing} />
      </Settings>
    </PageContext.Provider>
  );
}
