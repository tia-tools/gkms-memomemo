import { useEffect, useMemo, useState } from "preact/hooks";
import { hasGaps } from "../memo/coverage.ts";
import { findRow } from "../memo/edit.ts";
import { emptyMemo, type Memo, PLAN_IDS, planOf, type PlanId, sectionsOf } from "../memo/types.ts";
import type { Catalog } from "./catalog.ts";
import { PLAN_LABELS } from "./labels.ts";
import { type Page, PageContext } from "./page.ts";
import { QuickTable } from "./QuickTable.tsx";
import { SectionView } from "./Section.tsx";
import { Settings } from "./Settings.tsx";
import type { SheetIndex } from "./sheets.ts";

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

/**
 * The memo page (Milestone 4): the three tabs, each with its 早見表, the 「未所持がある行だけ表示」
 * toggle and its sections, and the settings. The memo lives here, in memory; Milestone 5 saves it.
 */
export function MemoPage({ catalog, sheets, initial }: { catalog: Catalog; sheets: SheetIndex; initial?: Memo }) {
  const defaultIdol = catalog.data.idols[0]?.id ?? "";
  const [memo, setMemo] = useState<Memo>(() => initial ?? emptyMemo());
  const [tab, setTab] = useState<PlanId>("sense");
  const [idol, setIdol] = useState(defaultIdol);
  const [counting, setCounting] = useState(true);
  const [gapsOnly, setGapsOnly] = useState(false);
  const [highlighted, highlight] = useHighlight();
  const page = useMemo<Page>(() => {
    const jumpTo = (rowId: string) => {
      const place = findRow(memo, rowId);
      if (place === null) return;
      setTab(planOf(place.section));
      if (!hasGaps(place.row)) setGapsOnly(false);
      highlight(rowId);
    };
    return { catalog, sheets, idol, defaultIdol, memo, setMemo, jumpTo, highlighted };
  }, [catalog, sheets, idol, defaultIdol, memo, highlighted, highlight]);
  return (
    <PageContext.Provider value={page}>
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
      <Settings idols={catalog.data.idols} idol={idol} onIdol={setIdol} counting={counting} onCounting={setCounting} />
    </PageContext.Provider>
  );
}
