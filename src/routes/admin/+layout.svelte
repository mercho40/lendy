<script>
	let { children } = $props();
</script>

<div class="min-h-screen bg-gray-50">
	<nav class="bg-white border-b border-gray-200 px-6 py-3">
		<div class="flex items-center gap-6">
			<a href="/admin" class="text-lg font-bold text-gray-900">GrameenBot</a>
			<a href="/admin/users" class="text-sm text-gray-600 hover:text-gray-900">Usuarios</a>
			<a href="/admin/groups" class="text-sm text-gray-600 hover:text-gray-900">Grupos</a>
			<a href="/admin/loans" class="text-sm text-gray-600 hover:text-gray-900">Prestamos</a>
		</div>
	</nav>
	<main class="p-6">
		{@render children()}
	</main>
</div>
