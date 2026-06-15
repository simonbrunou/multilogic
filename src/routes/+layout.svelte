<script lang="ts">
	import { browser } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';
	import { initLocale, t } from '$lib/i18n';

	let { children } = $props();

	// Resolve locale during init (before first paint) rather than in onMount, so English
	// visitors don't see a flash of the French default. ssr=false, so this is client-only.
	if (browser) initLocale();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:boundary onerror={(error) => console.error('[multilogic] render error', error)}>
	{@render children()}

	{#snippet failed(_error, reset)}
		<main class="app-error">
			<p>{t('error.title')}</p>
			<button onclick={reset}>{t('error.reload')}</button>
		</main>
	{/snippet}
</svelte:boundary>

<style>
	.app-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 32px 12px;
		font-family: system-ui, sans-serif;
	}
	.app-error button {
		padding: 6px 14px;
		border: 1px solid #ccc;
		border-radius: 8px;
		background: #f4f5f7;
		cursor: pointer;
	}
</style>
