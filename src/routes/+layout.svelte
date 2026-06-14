<script lang="ts">
	import { browser } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';
	import { initLocale } from '$lib/i18n';

	let { children } = $props();

	// Resolve locale during init (before first paint) rather than in onMount, so English
	// visitors don't see a flash of the French default. ssr=false, so this is client-only.
	if (browser) initLocale();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
