<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { pesos } from '$lib/format';

	let { data }: { data: PageData } = $props();
	let pending = $state<'approve' | 'reject' | null>(null);
</script>

<div class="min-h-screen bg-slate-100 px-4 py-12">
	<div class="mx-auto max-w-md space-y-6">
		<div class="flex items-center justify-center gap-2 pt-4">
			<div class="h-8 w-8 rounded-full bg-sky-400"></div>
			<span class="text-lg font-semibold tracking-tight text-slate-900">MercadoPago</span>
			<span class="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-amber-800">
				sandbox
			</span>
		</div>

		<div class="rounded-xl bg-white p-6 shadow-sm">
			<div class="space-y-1">
				<p class="text-sm text-slate-500">Total a pagar</p>
				<p class="text-4xl font-semibold tabular-nums text-slate-900">
					{pesos(data.payment.amountCents)}
				</p>
			</div>

			<div class="mt-6 space-y-2 border-t pt-4 text-sm">
				<div class="flex justify-between">
					<span class="text-slate-500">Pagador</span>
					<span class="font-medium text-slate-900">{data.user.name}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-slate-500">Concepto</span>
					<span class="text-slate-900">
						Cuota {data.loan.installmentsPaid + 1}/{data.loan.totalInstallments}
					</span>
				</div>
				<div class="flex justify-between">
					<span class="text-slate-500">Método</span>
					<span class="text-slate-900">Tarjeta terminada en ••4242 (mock)</span>
				</div>
			</div>

			<form
				method="POST"
				action="?/approve"
				use:enhance={() => {
					pending = 'approve';
					return async ({ update }) => {
						await update();
					};
				}}
				class="mt-6"
			>
				<button
					type="submit"
					disabled={pending !== null}
					class="w-full rounded-lg bg-sky-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-sky-600 disabled:opacity-60"
				>
					{pending === 'approve' ? 'Procesando…' : 'Pagar'}
				</button>
			</form>

			<form
				method="POST"
				action="?/reject"
				use:enhance={() => {
					pending = 'reject';
					return async ({ update }) => {
						await update();
					};
				}}
				class="mt-2"
			>
				<button
					type="submit"
					disabled={pending !== null}
					class="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
				>
					{pending === 'reject' ? 'Procesando…' : 'Simular rechazo'}
				</button>
			</form>
		</div>

		<p class="text-center text-xs text-slate-400">
			Checkout mockeado para demo — no se procesa ninguna transacción real.
		</p>
	</div>
</div>
