<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Lendy — AI-native microcredit</title>
	<meta
		name="description"
		content="An AI-native microcredit lender, operated end-to-end by autonomous agents."
	/>
</svelte:head>

<div class="relative min-h-screen overflow-hidden bg-background text-foreground">
	<!-- ambient gradient -->
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_theme(colors.primary/10),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_theme(colors.primary/5),_transparent_60%)]"
	></div>

	<div class="relative mx-auto flex min-h-screen max-w-6xl flex-col">
		<!-- Top bar -->
		<header class="flex items-center justify-between px-6 py-6">
			<div class="flex items-center gap-2">
				<span class="inline-block h-6 w-6 rounded-full bg-foreground text-background"></span>
				<span class="text-lg font-semibold tracking-tight">Lendy</span>
			</div>
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<a
					href="https://github.com/mercho40/lendy"
					class="underline-offset-4 hover:text-foreground hover:underline"
					target="_blank"
					rel="noopener"
				>
					GitHub
				</a>
			</div>
		</header>

		<!-- Hero -->
		<main class="flex flex-1 flex-col justify-center gap-12 px-6 py-16 lg:flex-row lg:items-center">
			<div class="flex-1">
				<div
					class="mb-6 inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
				>
					AI-native lender · hackathon demo
				</div>
				<h1
					class="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
				>
					A microcredit financier, operated end-to-end by AI agents.
				</h1>
				<p class="mt-6 max-w-2xl text-lg text-muted-foreground">
					Lendy underwrites people the traditional system can't see. Six agents handle
					onboarding, voice verification, social vouching, credit decision, disbursement and
					collections — all on WhatsApp, all autonomous.
				</p>

				<div class="mt-10 flex flex-wrap items-center gap-3">
					<Button href="/admin" size="lg">Open admin dashboard →</Button>
					<Button href="/admin/manager" size="lg" variant="outline">
						Talk to the manager agent
					</Button>
				</div>

				<dl class="mt-16 grid grid-cols-2 gap-x-10 gap-y-6 text-sm sm:grid-cols-4">
					<div>
						<dt class="text-muted-foreground">Agents</dt>
						<dd class="mt-1 text-2xl font-semibold tabular-nums">6</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Human ops team</dt>
						<dd class="mt-1 text-2xl font-semibold tabular-nums">4</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Onboarding</dt>
						<dd class="mt-1 text-2xl font-semibold">WhatsApp</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Underwriting</dt>
						<dd class="mt-1 text-2xl font-semibold">Claude 4.6</dd>
					</div>
				</dl>
			</div>

			<!-- QR card -->
			<aside class="shrink-0 lg:w-[300px]">
				<div class="rounded-2xl border bg-card p-6 shadow-sm">
					<div class="mb-4 flex items-center justify-between">
						<span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Try the bot
						</span>
						<span
							class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
						>
							<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
							Live
						</span>
					</div>

					<div
						class="mx-auto flex aspect-square w-full max-w-[240px] items-center justify-center rounded-xl bg-white p-3 [&_svg]:h-full [&_svg]:w-full"
					>
						{@html data.qrSvg}
					</div>

					<p class="mt-4 text-center text-xs text-muted-foreground">
						Scan to chat on WhatsApp
					</p>
					<a
						href={data.whatsappUrl}
						target="_blank"
						rel="noopener"
						class="mt-1 block text-center font-mono text-sm font-medium text-foreground underline-offset-4 hover:underline"
					>
						{data.whatsappNumber}
					</a>
				</div>
			</aside>
		</main>

		<!-- Footer -->
		<footer class="border-t px-6 py-6 text-xs text-muted-foreground">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<span>© 2026 Lendy · hackathon build</span>
				<span class="font-mono">Claude · Kapso · ElevenLabs · MercadoPago · Neon · Vercel</span>
			</div>
		</footer>
	</div>
</div>
