import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db';
import { users, groups, loans, payments } from '../db/schema';
import { createPaymentPreference } from '../mercadopago';
import { sendText } from '../whatsapp';

export const TOOL_SCHEMAS = [
	{
		name: 'save_user_profile',
		description:
			'Guarda los datos del usuario y marca el onboarding como completo. Llamar SOLO cuando tenés todos los datos: nombre, dni, monthly_income (pesos ARS) y occupation.',
		input_schema: {
			type: 'object' as const,
			properties: {
				name: { type: 'string', description: 'Nombre completo' },
				dni: { type: 'string', description: 'DNI argentino (solo números, sin puntos)' },
				monthly_income: {
					type: 'integer',
					description: 'Ingreso mensual en pesos ARS (entero)'
				},
				occupation: { type: 'string', description: 'Ocupación / trabajo' }
			},
			required: ['name', 'dni', 'monthly_income', 'occupation']
		}
	},
	{
		name: 'create_group',
		description:
			'Crea un grupo nuevo del que el usuario es primer miembro. Devuelve el invite_code de 6 caracteres para compartir.',
		input_schema: {
			type: 'object' as const,
			properties: {
				group_name: { type: 'string', description: 'Nombre del grupo' }
			},
			required: ['group_name']
		}
	},
	{
		name: 'join_group',
		description:
			'Une al usuario a un grupo existente usando el código de invitación de 6 caracteres. Si el grupo llega a 5 miembros, pasa a estado active.',
		input_schema: {
			type: 'object' as const,
			properties: {
				invite_code: { type: 'string', description: 'Código de 6 caracteres' }
			},
			required: ['invite_code']
		}
	},
	{
		name: 'get_group_status',
		description:
			'Devuelve el estado del grupo del usuario: miembros, préstamos activos de cada uno, cuotas pendientes y mora.',
		input_schema: { type: 'object' as const, properties: {} }
	},
	{
		name: 'create_loan',
		description:
			'Crea un préstamo para el usuario. Solo si el grupo está active y el usuario no tiene préstamo activo. Monto entre 5000 y 50000 pesos ARS. Calcula cuota con 5% flat en 4 cuotas semanales.',
		input_schema: {
			type: 'object' as const,
			properties: {
				amount: {
					type: 'integer',
					description: 'Monto en pesos ARS (entre 5000 y 50000)'
				}
			},
			required: ['amount']
		}
	},
	{
		name: 'generate_payment_link',
		description:
			'Genera un link de MercadoPago para la próxima cuota del préstamo indicado. Devuelve el link que tenés que pasarle al usuario.',
		input_schema: {
			type: 'object' as const,
			properties: {
				loan_id: { type: 'integer', description: 'ID del préstamo' }
			},
			required: ['loan_id']
		}
	},
	{
		name: 'notify_group',
		description:
			'Manda un mensaje por WhatsApp a todos los miembros del grupo del usuario excepto él mismo. Usar para anuncios de mora o confirmaciones de pago.',
		input_schema: {
			type: 'object' as const,
			properties: {
				message: { type: 'string', description: 'Texto a enviar a los demás miembros' }
			},
			required: ['message']
		}
	}
];

function randomInviteCode(): string {
	return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function pesosToCents(p: number): number {
	return Math.round(p * 100);
}

async function getUser(userId: number) {
	const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	return u;
}

export async function handleTool(
	name: string,
	input: Record<string, unknown>,
	ctx: { userId: number }
): Promise<unknown> {
	switch (name) {
		case 'save_user_profile': {
			await db
				.update(users)
				.set({
					name: input.name as string,
					dni: input.dni as string,
					monthlyIncome: input.monthly_income as number,
					occupation: input.occupation as string,
					onboardingComplete: true
				})
				.where(eq(users.id, ctx.userId));
			return { ok: true, message: 'Perfil guardado' };
		}

		case 'create_group': {
			const user = await getUser(ctx.userId);
			if (user.groupId) return { error: 'Ya pertenecés a un grupo' };
			const [g] = await db
				.insert(groups)
				.values({ name: input.group_name as string, inviteCode: randomInviteCode() })
				.returning();
			await db.update(users).set({ groupId: g.id }).where(eq(users.id, ctx.userId));
			return {
				ok: true,
				group_id: g.id,
				invite_code: g.inviteCode,
				message: `Grupo creado. Compartí este código para que se sumen: ${g.inviteCode}`
			};
		}

		case 'join_group': {
			const user = await getUser(ctx.userId);
			if (user.groupId) return { error: 'Ya pertenecés a un grupo' };
			const code = (input.invite_code as string).toUpperCase().trim();
			const [g] = await db.select().from(groups).where(eq(groups.inviteCode, code)).limit(1);
			if (!g) return { error: 'Código inválido' };
			if (g.status !== 'forming') return { error: 'El grupo ya está cerrado' };
			const members = await db.select().from(users).where(eq(users.groupId, g.id));
			if (members.length >= g.maxMembers) return { error: 'El grupo ya está completo' };
			await db.update(users).set({ groupId: g.id }).where(eq(users.id, ctx.userId));
			const newCount = members.length + 1;
			if (newCount >= g.maxMembers) {
				await db.update(groups).set({ status: 'active' }).where(eq(groups.id, g.id));
			}
			return {
				ok: true,
				group_id: g.id,
				group_name: g.name,
				members: newCount,
				max_members: g.maxMembers,
				status: newCount >= g.maxMembers ? 'active' : 'forming'
			};
		}

		case 'get_group_status': {
			const user = await getUser(ctx.userId);
			if (!user.groupId) return { error: 'No pertenecés a ningún grupo' };
			const [g] = await db.select().from(groups).where(eq(groups.id, user.groupId)).limit(1);
			const members = await db.select().from(users).where(eq(users.groupId, g.id));
			const memberInfo = await Promise.all(
				members.map(async (m) => {
					const [loan] = await db
						.select()
						.from(loans)
						.where(and(eq(loans.userId, m.id), ne(loans.status, 'paid')))
						.limit(1);
					return {
						name: m.name ?? m.phone,
						has_active_loan: !!loan,
						loan:
							loan &&
							{
								amount_pesos: Math.round(loan.amount / 100),
								installments_paid: loan.installmentsPaid,
								total_installments: loan.totalInstallments,
								status: loan.status,
								next_due: loan.nextDueDate
							}
					};
				})
			);
			return {
				group_name: g.name,
				status: g.status,
				members_count: members.length,
				max_members: g.maxMembers,
				members: memberInfo
			};
		}

		case 'create_loan': {
			const user = await getUser(ctx.userId);
			if (!user.groupId) return { error: 'Tenés que pertenecer a un grupo' };
			const [g] = await db.select().from(groups).where(eq(groups.id, user.groupId)).limit(1);
			if (g.status !== 'active') return { error: 'El grupo no está activo todavía' };
			const [existing] = await db
				.select()
				.from(loans)
				.where(and(eq(loans.userId, user.id), ne(loans.status, 'paid')))
				.limit(1);
			if (existing) return { error: 'Ya tenés un préstamo activo' };
			const amountPesos = input.amount as number;
			if (amountPesos < 5000 || amountPesos > 50000) {
				return { error: 'El monto tiene que estar entre 5000 y 50000 pesos' };
			}
			const amountCents = pesosToCents(amountPesos);
			const installmentCents = Math.round((amountCents * 1.05) / 4);
			const nextDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
			const [loan] = await db
				.insert(loans)
				.values({
					userId: user.id,
					groupId: g.id,
					amount: amountCents,
					totalInstallments: 4,
					installmentsPaid: 0,
					installmentAmount: installmentCents,
					status: 'active',
					nextDueDate: nextDue
				})
				.returning();
			return {
				ok: true,
				loan_id: loan.id,
				amount_pesos: amountPesos,
				installment_pesos: Math.round(installmentCents / 100),
				total_installments: 4,
				next_due_date: nextDue.toISOString().slice(0, 10),
				message: `Préstamo aprobado: $${amountPesos} en 4 cuotas semanales de $${Math.round(installmentCents / 100)}. Primera vence ${nextDue.toISOString().slice(0, 10)}.`
			};
		}

		case 'generate_payment_link': {
			const loanId = input.loan_id as number;
			const [loan] = await db.select().from(loans).where(eq(loans.id, loanId)).limit(1);
			if (!loan) return { error: 'Préstamo no encontrado' };
			if (loan.userId !== ctx.userId) return { error: 'Ese préstamo no es tuyo' };
			if (loan.status === 'paid') return { error: 'El préstamo ya está pagado' };
			const [pay] = await db
				.insert(payments)
				.values({ loanId: loan.id, amount: loan.installmentAmount, status: 'pending' })
				.returning();
			try {
				const pref = await createPaymentPreference({
					loanId: loan.id,
					paymentId: pay.id,
					amountPesos: Math.round(loan.installmentAmount / 100),
					description: `Cuota ${loan.installmentsPaid + 1}/${loan.totalInstallments} - préstamo #${loan.id}`
				});
				await db
					.update(payments)
					.set({ mpPreferenceId: pref.id, paymentLink: pref.initPoint })
					.where(eq(payments.id, pay.id));
				return {
					ok: true,
					payment_id: pay.id,
					payment_link: pref.initPoint,
					amount_pesos: Math.round(loan.installmentAmount / 100),
					message: `Link de pago generado: ${pref.initPoint}`
				};
			} catch (e: unknown) {
				return { error: `No se pudo generar el link: ${(e as Error).message}` };
			}
		}

		case 'notify_group': {
			const user = await getUser(ctx.userId);
			if (!user.groupId) return { error: 'No pertenecés a ningún grupo' };
			const members = await db
				.select()
				.from(users)
				.where(and(eq(users.groupId, user.groupId), ne(users.id, user.id)));
			const message = input.message as string;
			let sent = 0;
			for (const m of members) {
				try {
					await sendText(m.phone, message);
					sent++;
				} catch {
					/* swallow — hackathon */
				}
			}
			return { ok: true, recipients: sent };
		}

		default:
			return { error: `Tool desconocida: ${name}` };
	}
}
