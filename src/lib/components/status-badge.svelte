<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';

	type Status =
		| 'forming'
		| 'active'
		| 'defaulted'
		| 'paid'
		| 'overdue'
		| 'pending'
		| 'approved'
		| 'rejected'
		| 'onboarding'
		| 'group_formation'
		| 'payment_pending';

	let { status, label }: { status: Status | string; label?: string } = $props();

	const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
		forming: 'secondary',
		active: 'default',
		paid: 'outline',
		defaulted: 'destructive',
		overdue: 'destructive',
		pending: 'secondary',
		approved: 'default',
		rejected: 'destructive',
		onboarding: 'secondary',
		group_formation: 'secondary',
		payment_pending: 'secondary'
	};

	const labels: Record<string, string> = {
		forming: 'En formación',
		active: 'Activo',
		paid: 'Pagado',
		defaulted: 'En default',
		overdue: 'Mora',
		pending: 'Pendiente',
		approved: 'Aprobado',
		rejected: 'Rechazado',
		onboarding: 'Onboarding',
		group_formation: 'Armando grupo',
		payment_pending: 'Pago pendiente'
	};

	const variant = $derived(variants[status] ?? 'outline');
	const text = $derived(label ?? labels[status] ?? status);
</script>

<Badge {variant}>{text}</Badge>
