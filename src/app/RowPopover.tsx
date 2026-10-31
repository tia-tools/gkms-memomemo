import { useState } from "preact/hooks";
import type { SkillCard } from "../data/contract.ts";
import { buildProblem, newBuild } from "../memo/build.ts";
import { addRow, changeBuild, isRefusal, type Refusal } from "../memo/edit.ts";
import type { Build, PlanId, Row, SectionId } from "../memo/types.ts";
import { fitKaimaku, nothingToCustomize } from "./customize.ts";
import { newRowId } from "./ids.ts";
import { refusalText } from "./labels.ts";
import { usePage } from "./page.ts";
import { Popover } from "./Popover.tsx";
import { CardStep, Choice, CustomizeStep, HifStep } from "./RowSteps.tsx";

type Step = "card" | "custom" | "hif";
const STEPS: readonly [Step, string][] = [
  ["card", "1 カード"],
  ["custom", "2 カスタマイズ"],
  ["hif", "3 HIFアビリティ"],
];

/** The build being put together; until a card is chosen it has none. */
interface Draft {
  card: SkillCard | undefined;
  build: Build;
}

const NO_BUILD: Build = { card: "", upgrade: 0, customization: [], kaimaku: false, hif: "" };

/** A row's build to change, its 開幕時獲得 fitted to its card where the card is known (D31). */
function draftOf(row: Row | undefined, card: SkillCard | undefined): Draft {
  if (row === undefined) return { card: undefined, build: NO_BUILD };
  return { card, build: card ? fitKaimaku(row.build, card) : row.build };
}

function RefusalNote({ refusal, onJump }: { refusal: Refusal; onJump: (row: string) => void }) {
  return (
    <p role="alert" class="flex flex-wrap items-center gap-2 text-xs text-rose-600">
      {refusalText(refusal)}
      {refusal.refused === "duplicate" && (
        <button type="button" class="rounded border border-rose-300 px-2 py-0.5" onClick={() => onJump(refusal.row)}>
          その行へ
        </button>
      )}
    </p>
  );
}

/**
 * The row popover (D19): the skill card, its customization and 開幕時獲得, and the H.I.F. ability, in
 * three steps. Adding puts the row at the section's end; with `row` it changes that row's build,
 * prefilled. Either way a build already in the tab is refused, naming its section, with a jump
 * there (D13), and a build its card's rules reject (one saved before the data changed) is never
 * saved: the customization step opens again to fix it. A step with nothing to choose is passed over.
 */
export function RowPopover({ plan, section, row, onClose }: { plan: PlanId; section: SectionId; row?: Row; onClose: () => void }) {
  const page = usePage();
  const [draft, setDraft] = useState<Draft>(() => draftOf(row, row && page.catalog.card(row.build.card, row.build.upgrade)));
  const [step, setStep] = useState<Step>("card");
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [broken, setBroken] = useState(false);
  const finish = (build: Build) => {
    if (draft.card && buildProblem(build, draft.card) !== null) return (setBroken(true), setStep("custom"));
    const result = row ? changeBuild(page.memo, row.id, build) : addRow(page.memo, section, newRowId(), build);
    if (isRefusal(result)) return setRefusal(result);
    page.setMemo(result);
    onClose();
  };
  const pickCard = (card: SkillCard) => {
    const build = card === draft.card ? draft.build : newBuild(card.id, card, draft.build.hif);
    setDraft({ card, build });
    setRefusal(null);
    setBroken(false);
    setStep(nothingToCustomize(build, card) ? "hif" : "custom");
  };
  const jump = (target: string) => (page.jumpTo(target), onClose());
  return (
    <Popover label={row ? "行を変更" : "カードを追加"} onClose={onClose}>
      <div class="flex w-[22rem] max-w-full flex-col gap-2">
        <div class="flex gap-1">
          {STEPS.map(([s, label]) => (
            <Choice key={s} pressed={step === s} disabled={s !== "card" && draft.card === undefined} onClick={() => setStep(s)}>
              {label}
            </Choice>
          ))}
        </div>
        {step === "card" && <CardStep plan={plan} chosen={draft.card} onPick={pickCard} />}
        {step === "custom" && draft.card && <CustomizeStep card={draft.card} build={draft.build} onBuild={(build) => (setDraft({ ...draft, build }), setBroken(false))} onNext={() => setStep("hif")} />}
        {step === "hif" && <HifStep plan={plan} chosen={draft.build.hif} onPick={(hif) => finish({ ...draft.build, hif })} />}
        {refusal && <RefusalNote refusal={refusal} onJump={jump} />}
        {broken && (
          <p role="alert" class="text-xs text-rose-600">
            このカードでは選べない組み合わせです。カスタマイズを選び直してください
          </p>
        )}
        {row && draft.card && (
          <button type="button" class="self-end rounded border border-slate-800 px-3 py-1" onClick={() => finish(draft.build)}>
            この内容で保存
          </button>
        )}
      </div>
    </Popover>
  );
}
