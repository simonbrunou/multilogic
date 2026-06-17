<script lang="ts">
	import { browser } from '$app/environment';
	import { initLocale, t } from '$lib/i18n';
	import { initTheme } from '$lib/theme.svelte';
	import '$lib/styles/app.css';

	let { children } = $props();

	// Resolve locale and theme during init (before first paint) rather than in onMount, so
	// visitors don't see a flash of the wrong language/palette. ssr=false, so this is
	// client-only. (The inline script in app.html also pre-applies the theme for safety.)
	if (browser) {
		initLocale();
		initTheme();
	}
</script>

<svelte:head>
	<title>Multilogic</title>
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
	}
	.app-error button {
		min-height: 44px;
		padding: 6px 14px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
		color: var(--text);
		cursor: pointer;
	}
</style>
