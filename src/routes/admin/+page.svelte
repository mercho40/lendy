<script lang="ts">
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import { pesos } from '$lib/format';

	let { data }: { data: PageData } = $props();
	let s = $derived(data.stats);

	const pipelineLabels: Record<string, string> = {
		onboarding: 'Onboarding',
		verification: 'Verificación',
		credit_decision: 'Decisión',
		active_loan: 'Préstamo activo'
	};
	const pipelineOrder: (keyof typeof s.pipeline)[] = [
		'onboarding',
		'verification',
		'credit_decision',
		'active_loan'
	];
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-semibold tracking-tight">Dashboard</h1>
		<p class="text-muted-foreground">Pipeline de crédito y métricas clave</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header>
				<Card.Description>Usuarios</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{s.users.total}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.users.onboarded} con onboarding completo
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Referencias</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{s.references.total}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.references.responded} respondieron · {s.references.positive} positivas
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Préstamos</Card.Description>
				<Card.Title class="text-3xl tabular-nums">
					{s.loans.active + s.loans.overdue + s.loans.paid}
				</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.loans.active} activos · {s.loans.paid} pagados
				{#if s.loans.overdue > 0}
					· <span class="font-medium text-destructive">{s.loans.overdue} en mora</span>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Prestado total</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{pesos(s.lentCents)}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				Cobrado: {pesos(s.collectedCents)}
			</Card.Content>
		</Card.Root>
	</div>

	<div>
		<h2 class="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
			Pipeline
		</h2>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each pipelineOrder as key, i (key)}
				<Card.Root>
					<Card.Header>
						<Card.Description class="flex items-center gap-2">
							<span
								class="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium tabular-nums text-muted-foreground"
								>{i + 1}</span
							>
							{pipelineLabels[key]}
						</Card.Description>
						<Card.Title class="text-3xl tabular-nums">{s.pipeline[key]}</Card.Title>
					</Card.Header>
					<Card.Content class="text-xs text-muted-foreground">
						{#if key === 'onboarding'}Recolectando datos básicos{/if}
						{#if key === 'verification'}Consultando referencias{/if}
						{#if key === 'credit_decision'}Evaluando oferta{/if}
						{#if key === 'active_loan'}Con préstamo vivo{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	</div>
</div>
