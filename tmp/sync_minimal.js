
const { google } = require('googleapis');

// Env variables manually extracted from .env.local via assistant or passed in
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN
});

const people = google.people({ version: 'v1', auth: oauth2Client });

async function syncContact(data) {
    try {
        const response = await people.people.createContact({
            requestBody: {
                names: [{ givenName: data.firstName, familyName: data.lastName }],
                emailAddresses: [{ value: data.email }],
                phoneNumbers: [{ value: data.phone }],
            }
        });
        return response.data.resourceName;
    } catch (e) {
        console.error(`Error creating contact for ${data.email}:`, e.response?.data || e.message);
        // Try searching if already exists
        try {
            const search = await people.people.searchContacts({
                query: data.email,
                readMask: 'names,emailAddresses'
            });
            return search.data.results?.[0]?.person?.resourceName || null;
        } catch (sErr) {
            return null;
        }
    }
}

async function run() {
    const clients = [
        { id: "6645b6fb-3a48-412e-83ee-7a6d730a8bcb", email: "marverariver2803@gmail.com", firstName: "Mariela", lastName: "Rivera", phone: "+56930266552" },
        { id: "adc594e2-b1a9-4a7a-a96f-d12568089527", email: "carrasco.wladimir@gmail.com", firstName: "Wladimir", lastName: "Carrasco", phone: "+56979853486" }
    ];

    for (const c of clients) {
        console.log(`Syncing ${c.email}...`);
        const resourceName = await syncContact(c);
        if (resourceName) {
            console.log(`RESULT_ID:${c.id}:${resourceName}`);
        }
    }
}

run();
