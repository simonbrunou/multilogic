<script lang="ts">
  import type { GrecoStore } from '$lib/play/greco.svelte';

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
        aria-label="case {i}"
        aria-pressed={isSelected}
      >
        {cellText(store.digits[i], store.letters[i])}
      </button>
    {/each}
  </div>

  <!-- Letter picker: A..n -->
  <div class="picker-row">
    <span class="picker-label">Lettre :</span>
    {#each Array.from({ length: store.n }, (_, k) => k) as k (k)}
      <button
        class="let-btn"
        class:active={selLetter === k}
        onclick={() => store.setLetter(k)}
        aria-label="lettre {letterChar(k)}"
      >
        {letterChar(k)}
      </button>
    {/each}
  </div>

  <!-- Digit picker: 1..n -->
  <div class="picker-row">
    <span class="picker-label">Chiffre :</span>
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
    <button class="action-btn erase-btn" onclick={() => store.clear()}>Effacer</button>
    <button class="action-btn hint-btn" onclick={() => store.hint()}>💡 Indice</button>
  </div>

  <!-- Status line: neutral progress only, no mistake feedback -->
  <div class="status">
    <span>{filled}/{store.n * store.n} placées</span>
  </div>

  <!-- Win banner -->
  {#if result.complete && result.valid}
    <div class="win-banner">Résolu ! Vous avez complété le carré gréco-latin !</div>
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
    border: 2px solid #222;
    gap: 1px;
    background: #222;
  }

  .cell {
    border: none;
    background: #fff;
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
    background: #ececec;
    border: 2px solid #555;
    box-sizing: border-box;
    cursor: default;
  }

  .cell.selected {
    outline: 3px solid #1b3a8f;
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
    color: #555;
    min-width: 56px;
  }

  .sym-btn,
  .let-btn {
    width: 34px;
    height: 34px;
    border: 2px solid #ccc;
    border-radius: 6px;
    background: #f4f5f7;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
    color: #333;
  }

  .let-btn {
    font-weight: 700;
  }

  .sym-btn.active,
  .let-btn.active {
    border-color: #1b3a8f;
    background: #cfe3ff;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 7px 18px;
    border: 1px solid #ccc;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
  }

  .erase-btn {
    background: #f4f5f7;
  }

  .hint-btn {
    background: #fffbe6;
    border-color: #e6c200;
    color: #5a4600;
  }

  .status {
    display: flex;
    gap: 12px;
    font-size: 14px;
    color: #444;
  }

  .win-banner {
    background: #1b8f3a;
    color: #fff;
    padding: 10px 22px;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 700;
    text-align: center;
  }
</style>
