<script lang="ts">
  import type { TectonicGame } from '../play/tectonic-game';

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

<div class="grid" role="grid" style="grid-template-columns: repeat({game.instance.width}, 1fr);">
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
    background: #fff;
    border: 1px solid #bbb;
    font-size: clamp(14px, 4vw, 24px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    aspect-ratio: 1;
    box-sizing: border-box;
  }
  .cell.given { font-weight: 700; color: #1b3a8f; }
  .cell.selected { background: #cfe3ff; }
  .cell.conflict { background: #ffd5d5; }
  .cell.thick-top { border-top: 2px solid #222; }
  .cell.thick-bottom { border-bottom: 2px solid #222; }
  .cell.thick-left { border-left: 2px solid #222; }
  .cell.thick-right { border-right: 2px solid #222; }
  .notes { font-size: 10px; color: #888; letter-spacing: 1px; }
</style>
