import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';

export const whatsapp = new WhatsAppClient({
	baseUrl: process.env.KAPSO_BASE_URL!,
	kapsoApiKey: process.env.KAPSO_API_KEY!
});
