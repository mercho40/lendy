<script>
	import { page } from '$app/state';

	const userId = page.url.searchParams.get('user') ?? '';
	const userName = page.url.searchParams.get('name') ?? 'Usuario';
	const agentId = 'agent_7601kp6cks47ehat26gjm20y2p86';
</script>

<svelte:head>
	<title>GrameenBot — Verificación por Voz</title>
</svelte:head>

<div class="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-white">
	<div class="max-w-md w-full text-center space-y-6">
		<div class="space-y-2">
			<h1 class="text-2xl font-bold">GrameenBot</h1>
			<p class="text-gray-400">Verificación por voz</p>
		</div>

		<div class="bg-gray-800 rounded-2xl p-6 space-y-4">
			<p class="text-lg">
				Hola <span class="font-semibold text-green-400">{userName}</span>
			</p>
			<p class="text-gray-300 text-sm">
				Para completar tu solicitud de microcrédito, necesitamos hacerte unas preguntas
				rápidas por voz. Tocá el botón para iniciar.
			</p>
			<p class="text-gray-500 text-xs">
				La conversación dura menos de 2 minutos.
			</p>
		</div>

		<div class="flex justify-center">
			<elevenlabs-convai agent-id={agentId} data-user-id={userId}></elevenlabs-convai>
		</div>

		<p class="text-gray-600 text-xs">
			Tus datos son confidenciales y se usan solo para evaluar tu solicitud.
		</p>
	</div>
</div>

<script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async></script>
