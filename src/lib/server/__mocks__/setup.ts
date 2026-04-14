// Set env vars before any module loads
process.env.DATABASE_URL = 'postgresql://fake:fake@localhost/fake';
process.env.MP_ACCESS_TOKEN = 'TEST-fake-token';
process.env.BASE_URL = 'http://localhost:3000';
process.env.KAPSO_API_KEY = 'test-key';
process.env.KAPSO_API_BASE_URL = 'https://api.kapso.ai/meta/whatsapp';
process.env.KAPSO_PHONE_NUMBER_ID = '1234567890';
process.env.ANTHROPIC_API_KEY = 'test-key';
