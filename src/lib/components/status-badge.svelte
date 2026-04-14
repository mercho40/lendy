<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';

	let { status, label }: { status: string; label?: string } = $props();

	const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
		// Conversation states (pipeline)
		onboarding: 'secondary',
		verification: 'secondary',
		credit_decision: 'default',
		active_loan: 'default',
		// Loans
		active: 'default',
		paid: 'outline',
		overdue: 'destructive',
		defaulted: 'destructive',
		// Payments
		pending: 'secondary',
		approved: 'default',
		rejected: 'destructive',
		// References
		contacted: 'secondary',
		responded: 'default',
		failed: 'destructive',
		positive: 'default',
		neutral: 'outline',
		negative: 'destructive'
	};

	const labels: Record<string, string> = {
		// Conversation states
		onboarding: 'Onboarding',
		verification: 'Verificación',
		credit_decision: 'Decisión',
		active_loan: 'Préstamo activo',
		// Loans
		active: 'Activo',
		paid: 'Pagado',
		overdue: 'Mora',
		defaulted: 'En default',
		// Payments
		pending: 'Pendiente',
		approved: 'Aprobado',
		rejected: 'Rechazado',
		// References
		contacted: 'Contactada',
		responded: 'Respondió',
		failed: 'Falló',
		positive: 'Positivo',
		neutral: 'Neutro',
		negative: 'Negativo'
	};

	const variant = $derived(variants[status] ?? 'outline');
	const text = $derived(label ?? labels[status] ?? status);
</script>

<Badge {variant}>{text}</Badge>
