
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy | MyChoir',
    description: 'Privacy Policy for MyChoir application',
};

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-zinc-950 text-gray-200 p-6 md:p-12 max-w-4xl mx-auto font-sans">
            <h1 className="text-4xl font-bold mb-4 text-white">Privacy Policy</h1>
            <p className="text-gray-400 mb-8">Last updated: February 18, 2026</p>

            <section className="space-y-10">
                {/* 1. Introduction */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">1. Introduction</h2>
                    <p className="text-gray-300 leading-relaxed">
                        Welcome to <strong>MyChoir</strong>. We are committed to protecting your privacy and ensuring transparency in how we handle your data.
                        This Privacy Policy explains how we collect, use, store, and share information about you when you use our mobile application and website.
                    </p>
                    <p className="text-gray-300 leading-relaxed">
                        By using MyChoir, you agree to the collection and use of information in accordance with this policy.
                    </p>
                </div>

                {/* 2. Data Controller */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">2. Data Controller</h2>
                    <p className="text-gray-300 leading-relaxed">
                        The data controller responsible for your personal information is:
                    </p>
                    <ul className="list-none space-y-2 ml-1 text-gray-300">
                        <li><strong>Developer:</strong> Artom Dula</li>
                        <li><strong>Contact Email:</strong> <a href="mailto:artom.devv@gmail.com" className="text-blue-400 hover:text-blue-300 hover:underline font-medium">artom.devv@gmail.com</a></li>
                        <li><strong>Telegram:</strong> <a href="https://t.me/artom_dev" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline font-medium">@artom_dev</a></li>
                        <li><strong>Website:</strong> <a href="https://artom.dev" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline font-medium">https://artom.dev</a></li>
                    </ul>
                </div>

                {/* 3. Information We Collect */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">3. Information We Collect</h2>
                    <p className="text-gray-300">We collect minimal data necessary to provide the MyChoir service:</p>

                    <h3 className="text-lg font-medium text-white mt-4">3.1 Account Information (Google Sign-In)</h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-1 ml-2">
                        <li>Full Name</li>
                        <li>Email Address</li>
                        <li>Profile Photo URL (we do not store the image file, only the link provided by Google)</li>
                        <li>Firebase User ID (Unique Identifier)</li>
                    </ul>

                    <h3 className="text-lg font-medium text-white mt-4">3.2 Choir Participation Data</h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-1 ml-2">
                        <li>Choir memberships and roles (e.g., Regent, Singer)</li>
                        <li>Voice part (e.g., Soprano, Bass)</li>
                        <li>Attendance records (presence at services/rehearsals)</li>
                    </ul>

                    <h3 className="text-lg font-medium text-white mt-4">3.3 User-Generated Content</h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-1 ml-2">
                        <li><strong>Sheet Music:</strong> PDF files and song metadata (title, composer) that you upload.</li>
                        <li><strong>Service Plans:</strong> Lists of songs scheduled for specific dates.</li>
                        <li><strong>Local Annotations:</strong> Drawings or notes made on PDF scores are stored <strong>locally on your device</strong> and are not transmitted to our servers.</li>
                    </ul>

                    <h3 className="text-lg font-medium text-white mt-4">3.4 Technical Data</h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-1 ml-2">
                        <li><strong>Push Notification Tokens:</strong> A unique device token used <strong>exclusively</strong> to deliver functional app notifications (e.g., "New Service Added"). This is not used for tracking or marketing.</li>
                    </ul>
                </div>

                {/* 4. Purpose of Data Collection (Legal Basis) */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">4. Legal Basis & Purpose (GDPR Art. 6)</h2>
                    <p className="text-gray-300">We process your data under the following legal bases:</p>
                    <ul className="list-disc list-inside text-gray-300 space-y-2 ml-2">
                        <li><strong>Contractual Necessity:</strong> To provide the core features of the app (Sign-in, Choir Management, Sheet Music access).</li>
                        <li><strong>Legitimate Interest:</strong> To maintain the security of the app, prevent abuse, and allow choir leaders (Regents) to manage their groups.</li>
                        <li><strong>Consent:</strong> For sending optional push notifications. You can revoke this consent at any time in your device settings.</li>
                    </ul>
                </div>

                {/* 5. Data Sharing & Third Parties */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">5. Third-Party Service Providers</h2>
                    <p className="text-gray-300">
                        We use trusted third-party services to operate the app. These providers access your data only to perform specific tasks on our behalf:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div className="bg-zinc-900/50 p-4 rounded border border-zinc-800">
                            <h4 className="font-bold text-white">Google Firebase</h4>
                            <p className="text-sm text-gray-400">Authentication, Database (Firestore), Cloud Functions, and Push Notifications.</p>
                        </div>
                        <div className="bg-zinc-900/50 p-4 rounded border border-zinc-800">
                            <h4 className="font-bold text-white">Cloudflare R2</h4>
                            <p className="text-sm text-gray-400">Secure storage for PDF sheet music files.</p>
                        </div>
                        <div className="bg-zinc-900/50 p-4 rounded border border-zinc-800">
                            <h4 className="font-bold text-white">Vercel</h4>
                            <p className="text-sm text-gray-400">Hosting for the web application and API endpoints.</p>
                        </div>
                    </div>
                </div>

                {/* 6. No Ads or Tracking */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">6. No Advertising or Tracking</h2>
                    <p className="text-gray-300 leading-relaxed">
                        We do <strong>not</strong> sell your data. We do <strong>not</strong> use advertising SDKs. We do <strong>not</strong> track your activity across other apps or websites. All data collection is strictly limited to the functionality of the choir management tools.
                    </p>
                </div>

                {/* 7. Data Retention & Deletion */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">7. Data Retention & Account Deletion</h2>
                    <p className="text-gray-300">
                        We retain your data only as long as your account is active. You can delete your account at any time directly within the app:
                    </p>
                    <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-lg">
                        <p className="font-medium text-white mb-2">To delete your account:</p>
                        <ol className="list-decimal list-inside text-gray-300 space-y-1 ml-2">
                            <li>Go to <strong>Profile</strong> tab.</li>
                            <li>Tap <strong>Settings</strong> (or scroll to bottom).</li>
                            <li>Select <strong>Delete Account</strong>.</li>
                            <li>Confirm the action.</li>
                        </ol>
                    </div>
                    <p className="text-gray-300 mt-2">
                        <strong>What happens when you delete your account?</strong>
                    </p>
                    <ul className="list-disc list-inside text-gray-300 space-y-1 ml-2">
                        <li>Your personal data (Name, Email, UID) is <strong>permanently deleted</strong> from our database.</li>
                        <li>Your authentication record is removed from Firebase Auth.</li>
                        <li>Your custom access claims are revoked.</li>
                        <li>Your Push Notification tokens are invalidated.</li>
                        <li>You are removed from all choir member lists.</li>
                    </ul>
                </div>

                {/* 8. Children's Privacy */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">8. Children's Privacy</h2>
                    <p className="text-gray-300">
                        Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from anyone under the age of 13. If You are a parent or guardian and You are aware that Your child has provided Us with Personal Data, please contact Us.
                    </p>
                </div>

                {/* 9. Contact Us */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">9. Contact Us</h2>
                    <p className="text-gray-300">
                        If you have any questions about this Privacy Policy, please contact us:
                    </p>
                    <p className="text-gray-300">
                        By email: <a href="mailto:artom.devv@gmail.com" className="text-blue-400 hover:text-blue-300 hover:underline">artom.devv@gmail.com</a>
                    </p>
                </div>
            </section>
        </main>
    );
}
