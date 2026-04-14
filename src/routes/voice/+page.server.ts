import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return {
		userId: url.searchParams.get('user') ?? '',
		userName: url.searchParams.get('name') ?? 'Usuario',
		agentId: 'agent_7601kp6cks47ehat26gjm20y2p86'
	};
};
