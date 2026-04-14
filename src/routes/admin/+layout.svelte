<script lang="ts">
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';

	let { children } = $props();

	const links = [
		{ href: '/admin', label: 'Overview' },
		{ href: '/admin/users', label: 'Usuarios' },
		{ href: '/admin/references', label: 'Referencias' },
		{ href: '/admin/loans', label: 'Préstamos' },
		{ href: '/admin/manager', label: 'Manager' }
	];

	function isActive(href: string) {
		if (href === '/admin') return page.url.pathname === '/admin';
		return page.url.pathname.startsWith(href);
	}
</script>

<div class="min-h-screen bg-background text-foreground">
	<header class="border-b bg-card">
		<div class="mx-auto flex max-w-7xl items-center gap-8 px-6 py-3">
			<a href="/admin" class="flex items-center gap-2">
				<span class="text-lg font-semibold tracking-tight">Lendy</span>
				<span class="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">admin</span>
			</a>
			<nav class="flex items-center gap-1">
				{#each links as link (link.href)}
					<a
						href={link.href}
						class={cn(
							'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
							isActive(link.href)
								? 'bg-muted text-foreground'
								: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
						)}
					>
						{link.label}
					</a>
				{/each}
			</nav>
			<div class="ml-auto">
				<ThemeToggle />
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-7xl px-6 py-8">
		{@render children()}
	</main>
</div>
