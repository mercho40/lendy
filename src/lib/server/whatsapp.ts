import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import { KAPSO_API_KEY, KAPSO_API_BASE_URL, KAPSO_PHONE_NUMBER_ID } from '$env/static/private';

export const whatsapp = new WhatsAppClient({
	baseUrl: KAPSO_API_BASE_URL,
	kapsoApiKey: KAPSO_API_KEY
});

export const PHONE_NUMBER_ID = KAPSO_PHONE_NUMBER_ID;

export async function sendText(to: string, body: string) {
	return whatsapp.messages.sendText({
		phoneNumberId: PHONE_NUMBER_ID,
		to,
		body
	});
}
