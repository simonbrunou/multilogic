<script lang="ts">
  import type { GrecoStore } from '$lib/play/greco.svelte';
  import { t } from '$lib/i18n';

  let { store }: { store: GrecoStore } = $props();

  const letterChar = (k: number): string => String.fromCharCode(65 + k);

  // A cell shows its letter then its digit, e.g. "A4"; either part may be absent while solving.
  function cellText(digit: number, letter: number): string {
    const l = letter >= 0 ? letterChar(letter) : '';
    const d = digit >= 0 ? String(digit + 1) : '';
    return `${l}${d}`;
  }

  const result = $derived(store.result);
  const filled = $derived(store.cells.filter((v) => v !== 0).length);
  const sel = $derived(store.selected);
  const selDigit = $derived(sel !== null ? store.digits[sel] : -1);
  const selLetter = $derived(sel !== null ? store.letters[sel] : -1);
</script>

<div class="board">
  <div class="grid" role="grid" style="--n: {store.n}">
    {#each store.cells as _v, i (i)}
      {@const isGiven = store.givens[i] !== 0}
      {@const isSelected = store.selected === i}
      <button
        class="cell"
        class:given={isGiven}
        class:selected={isSelected}
        onclick={() => store.select(i)}
        aria-label={t('aria.cellAt', {
          row: Math.floor(i / store.n) + 1,
          col: (i % store.n) + 1,
          value: cellText(store.digits[i], store.letters[i]) || t('aria.empty')
        })}
        aria-pressed={isSelected}
      >
        {cellText(store.digits[i], store.letters[i])}
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
        onclick={() => store.setDigit(k)}
      >
        {k + 1}
      </button>
    {/each}
  </div>

  <!-- Action buttons -->
  <div class="actions">
    <button class="action-btn erase-btn" onclick={() => store.clear()}>{t('greco.erase')}</button>
    <button class="action-btn hint-btn" onclick={() => store.hint()}>💡 {t('greco.hint')}</button>
  </div>

  <!-- Status line: neutral progress only, no mistake feedback -->
  <div class="status">
    <span>{t('greco.placed', { filled, total: store.n * store.n })}</span>
  </div>

  <!-- Win banner -->
  {#if result.complete && result.valid}
    <div class="win-banner">{t('greco.solvedBanner')}</div>
  {/if}
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
    font-size: clamp(14px, 4vw, 24px);
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    aspect-ratio: 1;
    transition: filter 0.1s;
  }

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

  .cell.selected {
    outline: 3px solid var(--ring);
    outline-offset: -2px;
    z-index: 1;
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

  .erase-btn {
    background: var(--surface-2);
    color: var(--text);
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

  .win-banner {
    background: var(--success-bg);
    color: var(--success-contrast);
    padding: 10px 22px;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 700;
    text-align: center;
  }
</style>
