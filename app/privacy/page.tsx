
import { Metadata } from 'next';
import BackButton from '@/components/legal/BackButton';
import PrivacyText from '@/components/legal/PrivacyText';

export const metadata: Metadata = {
    title: 'Privacy Policy | MyChoir',
    description: 'Privacy Policy for MyChoir application',
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background text-text-secondary px-6 pb-6 md:px-12 md:pb-12 font-sans pt-[env(safe-area-inset-top)]">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="border-b border-border pb-6 pt-6">
                    <BackButton />
                    <h1 className="text-3xl font-bold text-text-primary mb-2">Політика конфіденційності</h1>
                </header>

                <div className="prose prose-invert max-w-none">
                    <PrivacyText />
                </div>
            </div>
        </div>
    );
}
