<script>
	let { data } = $props();

	// Pass user_id to ElevenLabs so the post-call webhook can match the call
	// back to the applicant. The widget serializes this via the `vars` URL
	// param and the ElevenLabs backend exposes it at
	// data.conversation_initiation_client_data.dynamic_variables.user_id.
	const dynamicVariables = JSON.stringify({
		user_id: data.userId,
		user_name: data.userName
	});
</script>

<svelte:head>
	<title>Lendy — Verificación por Voz</title>
</svelte:head>

<div class="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-white">
	<div class="max-w-md w-full text-center space-y-6">
		<div class="space-y-2">
			<h1 class="text-2xl font-bold">Lendy</h1>
			<p class="text-gray-400">Verificación por voz</p>
		</div>

		<div class="bg-gray-800 rounded-2xl p-6 space-y-4">
			<p class="text-lg">
				Hola <span class="font-semibold text-green-400">{data.userName}</span>
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
			<elevenlabs-convai agent-id={data.agentId} dynamic-variables={dynamicVariables}
			></elevenlabs-convai>
		</div>

		<p class="text-gray-600 text-xs">
			Tus datos son confidenciales y se usan solo para evaluar tu solicitud.
		</p>
	</div>
</div>

