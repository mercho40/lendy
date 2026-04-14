<script lang="ts">
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import { pesos } from '$lib/format';

	let { data }: { data: PageData } = $props();
	let s = $derived(data.stats);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-semibold tracking-tight">Dashboard</h1>
		<p class="text-muted-foreground">Estado general del sistema</p>
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
				<Card.Description>Grupos</Card.Description>
				<Card.Title class="text-3xl tabular-nums">
					{s.groups.forming + s.groups.active + s.groups.defaulted}
				</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.groups.active} activos · {s.groups.forming} en formación
				{#if s.groups.defaulted > 0}· {s.groups.defaulted} en default{/if}
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

	<Card.Root>
		<Card.Header>
			<Card.Title>Resumen</Card.Title>
			<Card.Description>Vista rápida para la demo</Card.Description>
		</Card.Header>
		<Card.Content class="text-sm text-muted-foreground">
			Los usuarios interactúan por WhatsApp con el agente. Se agrupan de a 5,
			reciben préstamos de $5.000 a $50.000 en 4 cuotas semanales al 5% flat,
			y pagan por MercadoPago. Usá las pestañas de arriba para ver el detalle.
		</Card.Content>
	</Card.Root>
</div>
