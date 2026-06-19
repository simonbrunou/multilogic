<script lang="ts">
  import type { GrecoStore } from '$lib/play/greco.svelte';
  import { t } from '$lib/i18n';
  import { gridKeyboard } from '$lib/play/grid-nav';

  let { store }: { store: GrecoStore } = $props();

  const isOpen = (i: number) => !store.isFullyGiven(i);
  const firstOpen = $derived(
    store.digitClues.findIndex((_: number | null, i: number) => !store.isFullyGiven(i))
  );
  const tabStop = $derived(store.selected ?? firstOpen);

  const letterChar = (k: number): string => String.fromCharCode(65 + k);

  const filled = $derived(store.cells.filter((v) => v !== 0).length);
  const sel = $derived(store.selected);
  const selDigit = $derived(sel !== null ? store.digits[sel] : -1);
  const selLetter = $derived(sel !== null ? store.letters[sel] : -1);
  const selDigitLocked = $derived(sel !== null && store.isDigitGiven(sel));
  const selLetterLocked = $derived(sel !== null && store.isLetterGiven(sel));
</script>

<div class="board">
  <div
    class="grid"
    role="grid"
    aria-label={t('aria.grid', { label: t('puzzle.grecolatin') })}
    style="--n: {store.n}"
    use:gridKeyboard={{
      cols: store.n,
      total: store.n * store.n,
      focusable: isOpen,
      selected: store.selected,
      onselect: (i) => store.select(i)
    }}
  >
    {#each store.cells as _v, i (i)}
      {@const digitGiven = store.isDigitGiven(i)}
      {@const letterGiven = store.isLetterGiven(i)}
      {@const fullyGiven = digitGiven && letterGiven}
      {@const partialGiven = (digitGiven || letterGiven) && !fullyGiven}
      {@const isSelected = store.selected === i}
      <button
        class="cell"
        class:given={fullyGiven}
        class:partial-given={partialGiven}
        class:selected={isSelected}
        data-cell={i}
        tabindex={i === tabStop ? 0 : -1}
        onclick={() => store.select(i)}
        aria-label={t('aria.cellAt', {
          row: Math.floor(i / store.n) + 1,
          col: (i % store.n) + 1,
          value: (store.letters[i] >= 0 ? letterChar(store.letters[i]) : '') +
                 (store.digits[i] >= 0 ? String(store.digits[i] + 1) : '') || t('aria.empty')
        })}
        aria-current={isSelected ? 'true' : undefined}
      >
        <span class="token letter-token" class:given={letterGiven}>
          {store.letters[i] >= 0 ? letterChar(store.letters[i]) : ''}
        </span>
        <span class="token digit-token" class:given={digitGiven}>
          {store.digits[i] >= 0 ? String(store.digits[i] + 1) : ''}
        </span>
      </button>
    {/each}
  </div>

  <!-- Letter picker: A..n -->
  <div class="picker-row">
    <span class="picker-label">{t('greco.letter')}</span>
    {#each Array.from({ length: store.n }, (_, k) => k) as k (k)}
      <button
        class="let-btn"
        class:active={selLetter === k}
        disabled={selLetterLocked}
        onclick={() => store.setLetter(k)}
        aria-label={t('aria.letter', { char: letterChar(k) })}
      >
        {letterChar(k)}
      </button>
    {/each}
  </div>

  <!-- Digit picker: 1..n -->
  <div class="picker-row">
    <span class="picker-label">{t('greco.digit')}</span>
    {#each Array.from({ length: store.n }, (_, k) => k) as k (k)}
      <button
        class="sym-btn"
        class:active={selDigit === k}
        disabled={selDigitLocked}
        onclick={() => store.setDigit(k)}
        aria-label={t('aria.digit', { n: k + 1 })}
      >
        {k + 1}
      </button>
    {/each}
  </div>

  <!-- Action buttons -->
  <div class="actions">
    <button class="action-btn undo-btn" onclick={() => store.undo()} disabled={!store.canUndo}>↶ {t('greco.undo')}</button>
    <button class="action-btn erase-btn" onclick={() => store.clear()}>{t('greco.erase')}</button>
    <button class="action-btn hint-btn" onclick={() => store.hint()}>💡 {t('greco.hint')}</button>
  </div>

  <!-- Status line: neutral progress only, no mistake feedback. The solved banner lives on the
       route (shared SolvedBanner), so completion UI is consistent with the other puzzles. -->
  <div class="status">
    <span>{t('greco.placed', { filled, total: store.n * store.n })}</span>
  </div>
</div>

<style>
  .board {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: min(92vw, 480px);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    aspect-ratio: 1;
    width: 100%;
    border: 2px solid var(--grid-line);
    gap: 1px;
    background: var(--grid-line);
  }

  .cell {
    border: none;
    background: var(--surface);
    color: var(--text);
    font-size: clamp(11px, 3.5vw, 20px);
    font-weight: 600;
    display: flex;
    align-items: center;
    /* Letter pinned left, digit pinned right, so a missing dimension shows as an empty
       half — the eye can scan the grid for what's still unplaced at a glance. */
    justify-content: space-between;
    cursor: pointer;
    aspect-ratio: 1;
    transition: filter 0.1s;
    /* Percentage padding (relative to cell width) pulls the pinned letter/digit inward
       toward the centre. A middle ground: centring them together was too cramped to scan,
       but pinning them to the hard edges (space-between + tiny padding) left too big a gap.
       Scales with cell size, so the spacing holds across every grid size n. */
    padding-inline: 24%;
  }

  .letter-token { text-align: left; }
  .digit-token { text-align: right; }

  /* Partial-given cells are still clickable (the open dimension is editable), so they get hover too. */
  .cell:hover:not(.given) {
    filter: brightness(0.92);
  }

  .cell.given {
    font-weight: 800;
    background: var(--surface-3);
    border: 2px solid var(--border);
    box-sizing: border-box;
    cursor: default;
  }

  .cell.partial-given {
    background: var(--surface-2);
    border: 2px solid var(--border);
    box-sizing: border-box;
  }

  .cell.selected {
    outline: 3px solid var(--ring);
    outline-offset: -2px;
    z-index: 1;
  }

  .token {
    line-height: 1;
  }

  .token.given {
    font-weight: 800;
    color: var(--text);
  }

  .picker-row {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }

  .picker-label {
    font-size: 13px;
    color: var(--text-muted);
    min-width: 56px;
  }

  .sym-btn,
  .let-btn {
    width: 44px;
    height: 44px;
    border: 2px solid var(--border);
    border-radius: 6px;
    background: var(--surface-2);
    font-weight: 600;
    cursor: pointer;
    font-size: 15px;
    color: var(--text);
  }

  .sym-btn:disabled,
  .let-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .let-btn {
    font-weight: 700;
  }

  .sym-btn.active,
  .let-btn.active {
    border-color: var(--accent);
    background: var(--selected-bg);
    color: var(--text);
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    min-height: 44px;
    padding: 7px 18px;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
  }

  .undo-btn,
  .erase-btn {
    background: var(--surface-2);
    color: var(--text);
  }

  .undo-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .hint-btn {
    background: var(--warning-bg);
    border-color: var(--warning-border);
    color: var(--warning-text);
  }

  .status {
    display: flex;
    gap: 12px;
    font-size: 14px;
    color: var(--text-muted);
  }
</style>
