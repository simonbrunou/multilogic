<script lang="ts">
  import type { TectonicGame } from '../play/tectonic-game';
  import { t } from '$lib/i18n';
  import { gridKeyboard } from '../play/grid-nav';

  let {
    game,
    selected = null,
    tick = 0,
    conflicts = new Set<number>(),
    highlightErrors = true,
    onselect
  }: {
    game: TectonicGame;
    selected: number | null;
    tick?: number;
    conflicts?: Set<number>;
    highlightErrors?: boolean;
    onselect: (i: number) => void;
  } = $props();

  const cellView = $derived.by(() => { void tick; return [...game.cells]; });
  const tabStop = $derived(selected ?? 0);
  const label = (i: number, v: number) =>
    t('aria.cellAt', {
      row: Math.floor(i / game.instance.width) + 1,
      col: (i % game.instance.width) + 1,
      value: v !== 0 ? String(v) : t('aria.empty')
    });

  function hasThickTop(i: number): boolean {
    const row = Math.floor(i / game.instance.width);
    if (row === 0) return true;
    return game.instance.regions[i] !== game.instance.regions[i - game.instance.width];
  }
  function hasThickBottom(i: number): boolean {
    const row = Math.floor(i / game.instance.width);
    if (row === game.instance.height - 1) return true;
    return game.instance.regions[i] !== game.instance.regions[i + game.instance.width];
  }
  function hasThickLeft(i: number): boolean {
    const col = i % game.instance.width;
    if (col === 0) return true;
    return game.instance.regions[i] !== game.instance.regions[i - 1];
  }
  function hasThickRight(i: number): boolean {
    const col = i % game.instance.width;
    if (col === game.instance.width - 1) return true;
    return game.instance.regions[i] !== game.instance.regions[i + 1];
  }
</script>

<div
  class="grid"
  role="grid"
  aria-label={t('aria.grid', { label: t('puzzle.tectonic') })}
  style="grid-template-columns: repeat({game.instance.width}, 1fr);"
  use:gridKeyboard={{ cols: game.instance.width, total: cellView.length, focusable: () => true, selected, onselect }}
>
  {#each cellView as v, i (i)}
    <button
      class="cell"
      class:given={game.isGiven(i)}
      class:selected={selected === i}
      class:conflict={highlightErrors && conflicts.has(i)}
      class:thick-top={hasThickTop(i)}
      class:thick-bottom={hasThickBottom(i)}
      class:thick-left={hasThickLeft(i)}
      class:thick-right={hasThickRight(i)}
      aria-current={selected === i ? 'true' : undefined}
      aria-label={label(i, v)}
      data-cell={i}
      tabindex={i === tabStop ? 0 : -1}
      onclick={() => onselect(i)}
    >
      {#if v !== 0}{v}{:else if game.notes[i].size}<span class="notes">{[...game.notes[i]].sort().join('')}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    aspect-ratio: 1;
    width: min(92vw, 480px);
    gap: 0;
  }
  .cell {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    font-size: clamp(14px, 4vw, 24px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    aspect-ratio: 1;
    box-sizing: border-box;
  }
  .cell.given { font-weight: 700; color: var(--accent); }
  .cell.selected { background: var(--selected-bg); }
  .cell.conflict { background: var(--danger-bg); color: var(--danger); box-shadow: inset 0 0 0 2px var(--danger); text-decoration: underline wavy var(--danger); text-underline-offset: 2px; }
  .cell.thick-top { border-top: 2px solid var(--grid-line); }
  .cell.thick-bottom { border-bottom: 2px solid var(--grid-line); }
  .cell.thick-left { border-left: 2px solid var(--grid-line); }
  .cell.thick-right { border-right: 2px solid var(--grid-line); }
  .notes { font-size: 10px; color: var(--text-muted); letter-spacing: 1px; }
</style>
