import type { users, groups, loans } from '../db/schema';

type User = typeof users.$inferSelect;
type Group = typeof groups.$inferSelect;
type Loan = typeof loans.$inferSelect;

export type AgentContext = {
	user: User;
	group: Group | null;
	groupMemberCount: number;
	activeLoan: Loan | null;
};

const BASE = `Sos el asistente de GrameenBot, un sistema de microcréditos grupales por WhatsApp inspirado en el Grameen Bank.

REGLAS:
- Hablás en español rioplatense, informal, cálido y directo. Respuestas cortas (máx 3-4 oraciones) salvo que haga falta explicar un monto o link.
- Nunca inventés datos ni montos. Si no sabés algo, usá una tool o pedilo.
- Los montos siempre están en pesos argentinos (ARS).
- Los préstamos son microcréditos grupales: 5 personas co-responsables. Si alguien no paga, el grupo se entera. Esa es la lógica del producto.
- Usás tools para todo lo que requiera cambios de estado o datos externos. No simules resultados.
- Cuando el usuario pide un préstamo, siempre generá el link de pago después de crearlo.
- Si el grupo todavía está en "forming", no se pueden pedir préstamos. Avisá.`;

function formatLoan(loan: Loan): string {
	const remaining = loan.totalInstallments - loan.installmentsPaid;
	const amountPesos = Math.round(loan.amount / 100);
	const cuotaPesos = Math.round(loan.installmentAmount / 100);
	const due = loan.nextDueDate ? new Date(loan.nextDueDate).toISOString().slice(0, 10) : 'sin fecha';
	return `préstamo activo: $${amountPesos}, cuota $${cuotaPesos}, pagadas ${loan.installmentsPaid}/${loan.totalInstallments}, quedan ${remaining}, próx. vencimiento ${due}, estado ${loan.status}`;
}

export function buildSystemPrompt(ctx: AgentContext): string {
	const { user, group, groupMemberCount, activeLoan } = ctx;

	const state: string[] = [];
	state.push(`- Teléfono: ${user.phone}`);
	state.push(`- Nombre: ${user.name ?? '(desconocido)'}`);
	state.push(`- DNI: ${user.dni ?? '(desconocido)'}`);
	state.push(`- Ingreso mensual: ${user.monthlyIncome ? `$${user.monthlyIncome}` : '(desconocido)'}`);
	state.push(`- Ocupación: ${user.occupation ?? '(desconocida)'}`);
	state.push(`- Onboarding completo: ${user.onboardingComplete ? 'sí' : 'no'}`);

	if (!group) {
		state.push('- Sin grupo.');
	} else {
		state.push(
			`- Grupo: "${group.name}" (código ${group.inviteCode}), estado ${group.status}, miembros ${groupMemberCount}/${group.maxMembers}`
		);
	}
	state.push(`- ${activeLoan ? formatLoan(activeLoan) : 'Sin préstamo activo.'}`);

	let guide: string;
	if (!user.onboardingComplete) {
		guide = `ESTADO: ONBOARDING. Pedí los datos que faltan (nombre, DNI, ingreso mensual en ARS, ocupación) de forma conversacional — no un formulario. Cuando los tengas todos, llamá save_user_profile. No ofrezcas préstamos todavía.`;
	} else if (!group) {
		guide = `ESTADO: SIN GRUPO. Explicá brevemente el modelo grupal (5 personas co-responsables). Ofrecé crear un grupo (pedí nombre → create_group) o unirse a uno existente (pedí código de 6 caracteres → join_group).`;
	} else if (group.status === 'forming') {
		guide = `ESTADO: GRUPO EN FORMACIÓN. Faltan ${group.maxMembers - groupMemberCount} miembros. Recordale el código ${group.inviteCode} para que invite gente. Si pide préstamo, aclarale que el grupo tiene que estar completo.`;
	} else if (group.status === 'active' && !activeLoan) {
		guide = `ESTADO: GRUPO ACTIVO, SIN PRÉSTAMO. Puede pedir un préstamo entre $5000 y $50000 en 4 cuotas semanales con 5% de interés flat. Si lo pide, llamá create_loan con el monto en pesos, después generate_payment_link con el loan_id devuelto, y mandale el link.`;
	} else if (activeLoan) {
		guide = `ESTADO: CON PRÉSTAMO ACTIVO. Si pide pagar, llamá generate_payment_link para generar un nuevo link de cuota. Si pregunta por el grupo o mora, usá get_group_status.`;
	} else {
		guide = `ESTADO: ACTIVO. Respondé dudas y usá tools según haga falta.`;
	}

	return [BASE, '\nESTADO ACTUAL DEL USUARIO:', ...state, '\n' + guide].join('\n');
}
