import type { PageServerLoad } from './$types';
import QRCode from 'qrcode';

const WHATSAPP_NUMBER_E164 = '12012520899';
const WHATSAPP_DISPLAY = '+1 (201) 252 0899';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER_E164}`;

export const load: PageServerLoad = async () => {
	const qrSvg = await QRCode.toString(WHATSAPP_URL, {
		type: 'svg',
		margin: 2,
		width: 240,
		color: { dark: '#000000', light: '#ffffff' }
	});
	return {
		whatsappNumber: WHATSAPP_DISPLAY,
		whatsappUrl: WHATSAPP_URL,
		qrSvg
	};
};
