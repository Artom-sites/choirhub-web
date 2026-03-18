const admin = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");

async function checkAuth() {
    console.log("Testing GoogleAuth resolution in this environment...");
    try {
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/firebase.messaging']
        });
        const client = await auth.getClient();
        
        console.log("Client acquired:", client.constructor.name);
        
        if (client.email) {
             console.log("Service Account Email:", client.email);
        } else {
             console.log("No Service Account email attached to client.");
        }
        
        const accessToken = await client.getAccessToken();
        console.log("Access Token received?", !!accessToken.token);
        if (accessToken.token) {
             console.log("Access Token prefix:", accessToken.token.substring(0, 15) + "...");
             
             // Try a dummy request to FCM
             console.log("Sending dummy request to FCM to test token validity...");
             const fetch = require("node-fetch");
             const res = await fetch(`https://fcm.googleapis.com/v1/projects/choirhub-8bfa2/messages:send`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: { token: "dummy", notification: { title: "Test" } } })
             });
             const data = await res.json();
             console.log("FCM Response:", data);
        }
        
    } catch (e) {
        console.error("Auth Error:", e);
    }
}

checkAuth();
