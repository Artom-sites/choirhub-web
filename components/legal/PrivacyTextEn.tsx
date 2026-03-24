import React from 'react';

export default function PrivacyTextEn() {
    return (
        <>
            <p className="text-xs text-text-secondary">Last updated: March 22, 2026</p>

            {/* 1. Introduction */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">1. Introduction</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    This Privacy Policy describes how the &quot;MyChoir&quot; application (hereinafter referred to as the &quot;App&quot;)
                    collects, uses, stores, and protects user personal data.
                    By using the App, you acknowledge that you have read and agree
                    with the terms of this Policy.
                </p>
            </section>

            {/* A. Data Controller */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">2. Data Controller</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    The data controller operator is:
                </p>
                <ul className="list-none space-y-1 text-sm text-text-secondary">
                    <li><strong>Operator:</strong> Individual — Artem Dulia</li>
                    <li><strong>Jurisdiction:</strong> Ukraine</li>
                    <li><strong>Privacy Email:</strong> <a href="mailto:artom.devv@gmail.com" className="text-teal-400 hover:text-teal-300 hover:underline">artom.devv@gmail.com</a></li>
                    <li><strong>Telegram:</strong> <a href="https://t.me/artom_dev" className="text-teal-400 hover:text-teal-300 hover:underline">@artom_dev</a></li>
                </ul>
            </section>
            
            <section className="space-y-3 mt-4">
                 <p className="text-sm text-text-secondary leading-relaxed italic">
                     Note: The full, legally binding text of this Privacy Policy is currently available in Ukrainian. Please switch the language to Ukrainian to read the complete provisions regarding data collection, GDPR rights, third-party sharing, and account deletion.
                 </p>
            </section>

            <footer className="border-t border-border pt-4 mt-4">
                <p className="text-xs text-text-secondary text-center">© 2026 MyChoir. All rights reserved.</p>
            </footer>
        </>
    );
}
