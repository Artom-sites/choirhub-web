import React from 'react';

export default function TermsTextEn() {
    return (
        <>
            <p className="text-xs text-text-secondary">Last updated: March 10, 2026</p>

            {/* 1. General */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">1. General Provisions</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    These Terms of Use (hereinafter — &quot;Terms&quot;) regulate
                    access to and use of the &quot;MyChoir&quot; application (hereinafter —
                    &quot;App&quot;), available on mobile devices and via the web interface.
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                    By using the App, you confirm that you
                    have read and agree to these Terms.
                    If you do not agree with any provision
                    — please discontinue using the App.
                </p>
            </section>

            {/* 2. Operator */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">2. Operator</h3>
                <ul className="list-none space-y-1 text-sm text-text-secondary">
                    <li><strong>Operator:</strong> Individual — Artem Dulia</li>
                    <li><strong>Jurisdiction:</strong> Ukraine</li>
                    <li><strong>Email:</strong> <a href="mailto:artom.devv@gmail.com" className="text-teal-400 hover:text-teal-300 hover:underline">artom.devv@gmail.com</a></li>
                </ul>
            </section>

            {/* 3. Description */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">3. Service Description</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    MyChoir is a non-commercial platform for
                    organizing choir services, providing tools for collaboration and repertoire management.
                </p>
            </section>

            <section className="space-y-3 mt-4">
                 <p className="text-sm text-text-secondary leading-relaxed italic">
                     Note: The full, legally binding text of these Terms of Use is currently available in Ukrainian. Please switch the language to Ukrainian to read the complete provisions.
                 </p>
            </section>

            <footer className="border-t border-border pt-4 mt-4">
                <p className="text-xs text-text-secondary text-center">© 2026 MyChoir. All rights reserved.</p>
            </footer>
        </>
    );
}
