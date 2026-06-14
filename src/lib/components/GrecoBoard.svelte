<script lang="ts">
  import { decodePair } from '../../engine/puzzles/grecolatin/rules';
  import type { GrecoStore } from '$lib/play/greco.svelte';

  let { store }: { store: GrecoStore } = $props();

  // Up to 9 distinct background colours for the colour dimension
  const PALETTE = [
    '#fde8a0', // 0 yellow
    '#a8d8f0', // 1 blue
    '#b8f0b8', // 2 green
    '#f0b8b8', // 3 red/pink
    '#d8b8f0', // 4 purple
    '#f0d8b8', // 5 orange
    '#b8f0f0', // 6 teal
    '#f0b8e8', // 7 pink
    '#c8e8c8', // 8 light green
  ] as const;

  function cellLabel(v: number, n: number): string {
    const p = decodePair(v, n);
    if (!p) return '';
    return String(p.a + 1);
  }

  function cellBg(v: number, n: number, isSelected: boolean, isConflict: boolean): string {
    if (isConflict) return '#ffd5d5';
    if (isSelected) return '#cfe3ff';
    const p = decodePair(v, n);
    if (!p) return '#fff';
    return PALETTE[p.b % PALETTE.length];
  }

  const result = $derived(store.result);
  const conflicts = $derived(result.conflicts);
  const filled = $derived(store.cells.filter((v) => v !== 0).length);
</script>

<div class="board">
  <div class="grid" role="grid" style="--n: {store.n}">
    {#each store.cells as v, i (i)}
      {@const isGiven = store.givens[i] !== 0}
      {@const isSelected = store.selected === i}
      {@const isConflict = conflicts.has(i)}
      <button
        class="cell"
        class:given={isGiven}
        class:selected={isSelected}
        class:conflict={isConflict}
        style="background: {cellBg(v, store.n, isSelected, isConflict)}"
        onclick={() => store.select(i)}
        aria-label="case {i}"
        aria-pressed={isSelected}
      >
        {cellLabel(v, store.n)}
      </button>
    {/each}
  </div>

  <!-- Symbol picker: 1..n -->
  <div class="picker-row">
    <span class="picker-label">Symbole :</span>
    {#each Array.from({ length: store.n }, (_, k) => k) as k (k)}
      <button
        class="sym-btn"
        class:active={store.symbol === k}
        onclick={() => { store.symbol = k; }}
      >
        {k + 1}
      </button>
    {/each}
  </div>

  <!-- Colour picker: n swatches -->
  <div class="picker-row">
    <span class="picker-label">Couleur :</span>
    {#each Array.from({ length: store.n }, (_, k) => k) as k (k)}
      <button
        class="col-btn"
        class:active={store.colour === k}
        style="background: {PALETTE[k % PALETTE.length]}"
        onclick={() => { store.colour = k; }}
        aria-label="couleur {k + 1}"
      ></button>
    {/each}
  </div>

  <!-- Action buttons -->
  <div class="actions">
    <button class="action-btn place-btn" onclick={() => store.place()}>Placer</button>
    <button class="action-btn erase-btn" onclick={() => store.clear()}>Effacer</button>
    <button class="action-btn hint-btn" onclick={() => store.hint()}>💡 Indice</button>
  </div>

  <!-- Status line -->
  <div class="status">
    <span>{filled}/{store.n * store.n} placées</span>
    {#if result.valid}
      <span class="valid">valide ✓</span>
    {:else}
      <span class="conflict-label">conflit ✗</span>
    {/if}
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
    border: 2px solid #555;
    box-sizing: border-box;
    cursor: default;
  }

  .cell.selected {
    outline: 3px solid #1b3a8f;
    outline-offset: -2px;
    z-index: 1;
  }

  .cell.conflict {
    outline: 3px solid #cc0000;
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

  .sym-btn {
    width: 34px;
    height: 34px;
    border: 2px solid #ccc;
    border-radius: 6px;
    background: #f4f5f7;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
  }

  .sym-btn.active {
    border-color: #1b3a8f;
    background: #cfe3ff;
  }

  .col-btn {
    width: 34px;
    height: 34px;
    border: 2px solid #ccc;
    border-radius: 6px;
    cursor: pointer;
  }

  .col-btn.active {
    border-color: #1b3a8f;
    outline: 2px solid #1b3a8f;
    outline-offset: 1px;
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

  .place-btn {
    background: #1b3a8f;
    color: #fff;
    border-color: #1b3a8f;
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

  .valid {
    color: #1b8f3a;
    font-weight: 600;
  }

  .conflict-label {
    color: #cc0000;
    font-weight: 600;
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
