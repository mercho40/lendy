const formatter = new Intl.NumberFormat('es-AR', {
	style: 'currency',
	currency: 'ARS',
	maximumFractionDigits: 0
});

export function pesos(cents: number | null | undefined): string {
	if (!cents) return '$0';
	return formatter.format(Math.round(cents / 100));
}

export function formatDate(d: Date | string | null | undefined): string {
	if (!d) return '—';
	const date = typeof d === 'string' ? new Date(d) : d;
	return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
