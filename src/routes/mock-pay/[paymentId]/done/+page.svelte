<script lang="ts">
	import { page } from '$app/state';
	const status = $derived(page.url.searchParams.get('status') ?? 'approved');
	const approved = $derived(status === 'approved');
</script>

<div class="min-h-screen bg-slate-100 px-4 py-12">
	<div class="mx-auto max-w-md pt-8 text-center">
		<div
			class={approved
				? 'mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600'
				: 'mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600'}
		>
			<svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				{#if approved}
					<path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round" />
				{:else}
					<path d="M6 6l12 12M18 6l-12 12" stroke-linecap="round" stroke-linejoin="round" />
				{/if}
			</svg>
		</div>
		<h1 class="mt-4 text-2xl font-semibold text-slate-900">
			{approved ? 'Pago aprobado' : 'Pago rechazado'}
		</h1>
		<p class="mt-2 text-sm text-slate-500">
			{approved
				? 'Recibimos tu pago. Ya actualizamos tu cuenta. Podés cerrar esta ventana.'
				: 'El pago no se pudo procesar. Volvé a intentar desde WhatsApp.'}
		</p>
	</div>
</div>
