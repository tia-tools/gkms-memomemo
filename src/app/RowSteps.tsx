import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";
import type { SkillCard, SkillCardRarity } from "../data/contract.ts";
import { type BuildProblem, type CardRules, isBuildProblem, kaimakuRule, kaimakuSwitch, stepLimit, withCustomization } from "../memo/build.ts";
import type { Build, PlanId } from "../memo/types.ts";
import { type HifEntry, stepText } from "./catalog.ts";
import { chosenStep, pickStep, stepOpen, switchKaimaku } from "./customize.ts";
import { CardIcon } from "./Icon.tsx";
import { usePage } from "./page.ts";
import { byRarity, FILTER_RARITIES, search, toggled } from "./picker.ts";

/** A choice that shows whether it is chosen. */
export function Choice({ pressed, disabled, onClick, children }: { pressed: boolean; disabled?: boolean; onClick: () => void; children: ComponentChildren }) {
  const look = pressed ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white";
  return (
    <button type="button" aria-pressed={pressed} disabled={disabled} class={`rounded border px-2 py-1 text-xs disabled:opacity-30 ${look}`} onClick={onClick}>
      {children}
    </button>
  );
}

function SearchBox({ value, onInput, label }: { value: string; onInput: (text: string) => void; label: string }) {
  return (
    <input
      type="search"
      aria-label={label}
      placeholder={label}
      class="w-full rounded border border-slate-300 px-2 py-1"
      value={value}
      onInput={(e) => onInput(e.currentTarget.value)}
    />
  );
}

/** A grid of icons with their names, the chosen one ringed. */
function IconGrid<T>({ entries, keyOf, nameOf, cardOf, chosen, plan, onPick }: {
  entries: readonly T[];
  keyOf: (entry: T) => string;
  nameOf: (entry: T) => string;
  /** The card whose icon stands for the entry: a card itself, or an ability's base card. */
  cardOf: (entry: T) => SkillCard;
  chosen: (entry: T) => boolean;
  plan: PlanId;
  onPick: (entry: T) => void;
}) {
  return (
    <div class="grid max-h-[50vh] grid-cols-5 gap-1 overflow-y-auto">
      {entries.map((entry) => (
        <button key={keyOf(entry)} type="button" aria-pressed={chosen(entry)} class={`flex flex-col items-center gap-0.5 rounded p-0.5 ${chosen(entry) ? "ring-2 ring-slate-800" : ""}`} onClick={() => onPick(entry)}>
          <CardIcon card={cardOf(entry)} plan={plan} size="var(--pick-icon)" name={nameOf(entry)} />
          <span class="w-full truncate text-center text-[10px]">{nameOf(entry)}</span>
        </button>
      ))}
      {entries.length === 0 && <p class="col-span-5 py-2 text-center text-xs text-slate-500">見つかりません</p>}
    </div>
  );
}

/** The card step's rarity toggles (D56); with none on, every rarity shows. */
function RarityFilter({ on, onToggle }: { on: ReadonlySet<SkillCardRarity>; onToggle: (rarity: SkillCardRarity) => void }) {
  return (
    <div class="flex gap-1" role="group" aria-label="レアリティ">
      {FILTER_RARITIES.map((rarity) => (
        <Choice key={rarity} pressed={on.has(rarity)} onClick={() => onToggle(rarity)}>
          {rarity}
        </Choice>
      ))}
    </div>
  );
}

/** Step 1: the skill card, the plan's cards then the free ones (D8, D19), by name and by rarity (D56). */
export function CardStep({ plan, chosen, onPick }: { plan: PlanId; chosen: SkillCard | undefined; onPick: (card: SkillCard) => void }) {
  const { catalog } = usePage();
  const [query, setQuery] = useState("");
  const [rarities, setRarities] = useState<ReadonlySet<SkillCardRarity>>(new Set());
  const cards = useMemo(() => byRarity(search(catalog.tabCards(plan), query, (c) => c.name), rarities), [catalog, plan, query, rarities]);
  return (
    <>
      <SearchBox value={query} onInput={setQuery} label="カード名" />
      <RarityFilter on={rarities} onToggle={(rarity) => setRarities(toggled(rarities, rarity))} />
      <IconGrid entries={cards} keyOf={(c) => `${c.id}:${c.upgrade}`} nameOf={(c) => c.name} cardOf={(c) => c} chosen={(c) => c === chosen} plan={plan} onPick={onPick} />
    </>
  );
}

/** Step 3: the H.I.F. ability, drawn with its card's icon (D6, D19). */
export function HifStep({ plan, chosen, onPick }: { plan: PlanId; chosen: string; onPick: (hif: string) => void }) {
  const { catalog } = usePage();
  const [query, setQuery] = useState("");
  const abilities = useMemo(() => search(catalog.tabAbilities(plan), query, (h) => h.card.name), [catalog, plan, query]);
  return (
    <>
      <SearchBox value={query} onInput={setQuery} label="HIFアビリティのカード名" />
      <IconGrid<HifEntry>
        entries={abilities}
        keyOf={(h) => h.ability.id}
        nameOf={(h) => h.card.name}
        cardOf={(h) => h.card}
        chosen={(h) => h.ability.id === chosen}
        plan={plan}
        onPick={(h) => onPick(h.ability.id)}
      />
    </>
  );
}

/** The 開幕時獲得 switch (D40): fixed on for a base card, off and locked while the customization is past the cap. */
function KaimakuSwitch({ build, card, onBuild }: { build: Build; card: CardRules; onBuild: (build: Build) => void }) {
  const state = kaimakuSwitch(build, card);
  if (state === "unavailable") return null;
  const cap = kaimakuRule(card)?.cap ?? 0;
  return (
    <label class="flex items-center gap-2">
      <input type="checkbox" checked={build.kaimaku} disabled={state !== "switchable"} onChange={() => onBuild(switchKaimaku(build, card))} />
      開幕時獲得
      {state === "blocked" && <span class="text-xs text-slate-500">{cap === 0 ? "カスタマイズなしのときだけ" : `カスタマイズ${cap}回までのときだけ`}</span>}
    </label>
  );
}

/** Step 2: the customization, なし first, a kind's steps on its own line, and 開幕時獲得 (D7, D19, D39, D40). */
export function CustomizeStep({ card, build, onBuild, onNext }: { card: SkillCard; build: Build; onBuild: (build: Build) => void; onNext: () => void }) {
  const apply = (result: Build | BuildProblem) => {
    if (!isBuildProblem(result)) onBuild(result);
  };
  return (
    <div class="flex flex-col gap-2">
      <p class="font-bold">{card.name}</p>
      <div class="flex flex-col gap-1">
        <div>
          <Choice pressed={build.customization.length === 0} onClick={() => apply(withCustomization(build, [], card))}>
            なし
          </Choice>
        </div>
        {card.customization.kinds.map((kind) => (
          <div key={kind.id} class="flex flex-wrap gap-1">
            {kind.steps.map(({ step }) => {
              const pressed = chosenStep(build, kind.id) === step;
              return (
                <Choice key={step} pressed={pressed} disabled={!pressed && !stepOpen(build, kind.id, step, card)} onClick={() => apply(pickStep(build, kind.id, step, card))}>
                  {stepText(kind, step)}
                </Choice>
              );
            })}
          </div>
        ))}
      </div>
      {card.customization.kinds.length > 0 && <p class="text-xs text-slate-500">合計{stepLimit(card)}回まで</p>}
      <KaimakuSwitch build={build} card={card} onBuild={onBuild} />
      <button type="button" class="self-end rounded bg-slate-800 px-4 py-1.5 text-white" onClick={onNext}>
        次へ
      </button>
    </div>
  );
}
