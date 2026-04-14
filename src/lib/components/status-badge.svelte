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
		verification: 'Verification',
		credit_decision: 'Decision',
		active_loan: 'Active loan',
		// Loans
		active: 'Active',
		paid: 'Paid',
		overdue: 'Overdue',
		defaulted: 'Defaulted',
		// Payments
		pending: 'Pending',
		approved: 'Approved',
		rejected: 'Rejected',
		// References
		contacted: 'Contacted',
		responded: 'Responded',
		failed: 'Failed',
		positive: 'Positive',
		neutral: 'Neutral',
		negative: 'Negative'
	};

	const variant = $derived(variants[status] ?? 'outline');
	const text = $derived(label ?? labels[status] ?? status);
</script>

<Badge {variant}>{text}</Badge>
