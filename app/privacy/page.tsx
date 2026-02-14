
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy | MyChoir',
    description: 'Privacy Policy for MyChoir application',
};

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-background text-text-primary p-6 md:p-12 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-white">Privacy Policy</h1>
            <p className="text-gray-400 mb-8">Last updated: February 15, 2026</p>

            <section className="space-y-8">
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-white">1. Introduction</h2>
                    <p className="text-gray-300 leading-relaxed">
                        Welcome to MyChoir ("we," "our," or "us"). We are committed to protecting your privacy and transparency handling your data.
                        This Privacy Policy states how we collect, use, and share information about you when you use our mobile application and website.
                    </p>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-white">2. Information We Collect</h2>
                    <ul className="list-disc list-inside text-gray-300 space-y-3 ml-2">
                        <li>
                            <strong className="text-white">Account Information:</strong> When you sign up, we collect your name and email address from your authentication provider (Google, Apple, or Email Sign-in) to create your account and identify you within your choir.
                        </li>
                        <li>
                            <strong className="text-white">Profile Photo:</strong> We may access and display your profile picture URL provided by your authentication provider (e.g., Google or Apple). We do <strong className="text-white">not</strong> upload or store the image file itself on our servers; we only store the reference URL to display it within the app.
                        </li>
                        <li>
                            <strong className="text-white">Choir Data:</strong> We store information related to your choir participation, including membership status, role (e.g., Regent, Singer), voice part, and attendance records.
                        </li>
                        <li>
                            <strong className="text-white">User Content (Sheet Music):</strong> We store PDF files and song metadata that you explicitly upload to the platform for sharing with your choir.
                        </li>
                        <li>
                            <strong className="text-white">Push Notification Tokens:</strong> We collect a unique device token to send you functional notifications about choir events. This token is used <strong className="text-white">exclusively</strong> for delivering app notifications and is not used for advertising, profiling, or tracking.
                        </li>
                    </ul>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-white">3. How We Use Your Information</h2>
                    <p className="text-gray-300 leading-relaxed">
                        We use the collected information solely for the following purposes:
                    </p>
                    <ul className="list-disc list-inside text-gray-300 space-y-1 ml-2">
                        <li>To provide, maintain, and improve the functionality of the App.</li>
                        <li>To manage choir rosters, voice parts, and attendance tracking.</li>
                        <li>To facilitate the secure sharing of sheet music within your authorized choir.</li>
                        <li>To send functional notifications regarding upcoming services, rehearsals, or schedule changes.</li>
                        <li>To verify your identity and prevent unauthorized access.</li>
                    </ul>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-white">4. Third-Party Services</h2>
                    <p className="text-gray-300 leading-relaxed">
                        We engage trusted third-party service providers to perform functions and provide services to us. These providers have access to your personal information only as needed to perform these services:
                    </p>
                    <ul className="list-disc list-inside text-gray-300 space-y-2 ml-2">
                        <li>
                            <strong className="text-white">Google Firebase:</strong> Used for secure authentication, database hosting, cloud functions, and analytics (if applicable).
                        </li>
                        <li>
                            <strong className="text-white">Cloudflare R2:</strong> Used for the secure storage and delivery of sheet music files (PDFs).
                        </li>
                        <li>
                            <strong className="text-white">Vercel:</strong> Used for hosting our web services and API endpoints.
                        </li>
                    </ul>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-white">5. Data Retention & Deletion</h2>
                    <p className="text-gray-300 leading-relaxed">
                        We retain your personal data only for as long as your account is active. You have the right to delete your account at any time directly within the App:
                    </p>
                    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg my-4">
                        <ol className="list-decimal list-inside text-gray-300 space-y-1 ml-2">
                            <li>Navigate to your <strong>Profile</strong>.</li>
                            <li>Select <strong>Delete Account</strong>.</li>
                            <li>Confirm your choice.</li>
                        </ol>
                    </div>
                    <p className="text-gray-300 mt-2">
                        <strong>Upon account deletion:</strong>
                    </p>
                    <ul className="list-disc list-inside text-gray-300 space-y-1 ml-2 mt-2">
                        <li>Your authentication credentials, personal email, and unique User ID are permanently removed from our active user database.</li>
                        <li>Your Push Notification tokens are immediately invalidated and removed.</li>
                        <li>Your historical attendance records and choir membership entry may be retained as an anonymized "archived" record (Ghost User) solely to preserve the integrity of past choir statistics. This record is no longer linked to your personal identity or contact information.</li>
                    </ul>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-white">6. Children's Privacy</h2>
                    <p className="text-gray-300 leading-relaxed">
                        Our App is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13 without verifiable parental consent. If we learn we have collected or received personal information from a child under 13 without verification of parental consent, we will delete that information.
                    </p>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-white">7. Contact Us</h2>
                    <p className="text-gray-300 leading-relaxed">
                        If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at <a href="mailto:support@mychoir.app" className="text-blue-400 hover:text-blue-300 underline">support@mychoir.app</a>.
                    </p>
                </div>
            </section>
        </main>
    );
}
