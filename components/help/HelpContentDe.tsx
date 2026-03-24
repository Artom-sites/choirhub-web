import React from 'react';
import { Music2, Calendar, Users, Archive, Palette, Shield, User, FileText, Filter, Download, Trash2 } from "lucide-react";

export default function HelpContentDe({ activeTab, openExternal, isNative }: { activeTab: string, openExternal: (url: string) => void, isNative: boolean }) {
    return (
        <>
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <section>
                        <h3 className="text-2xl font-bold text-text-primary mb-4">Willkommen bei MyChoir! 👋</h3>
                        <p className="text-text-secondary leading-relaxed">
                            Dies ist eine App zur Organisation des Chorlebens. Sehen Sie sich das Repertoire an, 
                            planen Sie Gottesdienste, üben Sie Stimmen, erhalten Sie Benachrichtigungen und verwalten Sie Ihren Chor.
                        </p>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Music2 className="w-6 h-6 text-purple-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">Repertoire</h4>
                            <p className="text-xs text-text-secondary">Liederdatenbank des Chores mit Noten und Stimmen.</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Calendar className="w-6 h-6 text-blue-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">Gottesdienste</h4>
                            <p className="text-xs text-text-secondary">Plan für Gottesdienste mit Liedern und Anwesenheitserfassung.</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Users className="w-6 h-6 text-green-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">Mitglieder</h4>
                            <p className="text-xs text-text-secondary">Liste der Chormitglieder, Stimmen und Anwesenheitsstatistiken.</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Archive className="w-6 h-6 text-amber-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">MChA Archiv</h4>
                            <p className="text-xs text-text-secondary">Tausende Lieder aus dem MSC ECB Katalog (für MSC Chöre).</p>
                        </div>
                    </div>

                    <section className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-5 rounded-3xl border border-indigo-500/20">
                        <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                            <Palette className="w-5 h-5 text-indigo-400" />
                            Designs
                        </h4>
                        <p className="text-sm text-text-secondary">
                            Wechseln Sie im App-Header zwischen dunklem und hellem Modus.
                            Ein Systemmodus, der den Geräteeinstellungen folgt, ist ebenfalls verfügbar.
                        </p>
                    </section>
                </div>
            )}

            {/* ROLES TAB */}
            {activeTab === 'roles' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Zugriffsstufen</h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        <div className="p-5 md:p-6 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 h-full">
                            <div className="flex items-center gap-3 mb-3">
                                <Shield className="w-5 h-5 text-indigo-400" />
                                <h4 className="font-bold text-text-primary">Dirigent (Admin)</h4>
                            </div>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Volle Kontrolle über den Chor 👑</li>
                                <li>Lieder hinzufügen, bearbeiten und löschen</li>
                                <li>Gottesdienstpläne erstellen und bearbeiten</li>
                                <li>Mitglieder und ihre Rollen verwalten</li>
                                <li>Einladungscodes erstellen</li>
                                <li>Push-Benachrichtigungen senden</li>
                                <li>Anwesenheitsstatistiken einsehen</li>
                                <li>Choreinstellungen (Name, Symbol)</li>
                            </ul>
                        </div>

                        <div className="p-5 md:p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 h-full">
                            <div className="flex items-center gap-3 mb-3">
                                <User className="w-5 h-5 text-emerald-400" />
                                <h4 className="font-bold text-text-primary">Assistenzdirigent</h4>
                            </div>
                            <p className="text-sm text-text-secondary mb-3">
                                Ein Chormitglied mit erweiterten Rechten über einen Admin-Code:
                            </p>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Kann Lieder zum Repertoire hinzufügen</li>
                                <li>Kann Anwesenheitsstatistiken einsehen</li>
                                <li>Kann Gottesdienste bearbeiten</li>
                            </ul>
                        </div>

                        <div className="p-5 md:p-6 rounded-3xl bg-surface border border-border h-full">
                            <div className="flex items-center gap-3 mb-3">
                                <User className="w-5 h-5 text-gray-400" />
                                <h4 className="font-bold text-text-primary">Chormitglied</h4>
                            </div>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Repertoire und Stimmen ansehen 👀</li>
                                <li>Gottesdienstplan ansehen</li>
                                <li>Für Anwesenheit abstimmen ("Ich komme" / "Komme nicht")</li>
                                <li>PDF-Dateien herunterladen</li>
                                <li>Synchronisation (Offline-Modus)</li>
                            </ul>
                        </div>

                        <div className="p-5 md:p-6 rounded-3xl bg-surface border border-border h-full lg:col-span-2">
                            <h4 className="font-bold text-text-primary mb-2">🎭 Benutzerdefinierte Rollen und Stimmen</h4>
                            <p className="text-sm text-text-secondary">
                                Der Dirigent kann benutzerdefinierte Rollen (z. B. "Begleiter") und benutzerdefinierte Gesangsstimmen (z. B. "Bariton" oder "Schüler") erstellen. Diese individuellen Stimmen werden automatisch in der Statistik der Stimmbalance berücksichtigt.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SONGS TAB */}
            {activeTab === 'songs' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Arbeiten mit Liedern</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-400" />
                                Stimmen und Partitur
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Jedes Lied kann mehrere Stimmen haben: Partitur, Sopran, Alt, Tenor, Bass.
                                Wechseln Sie zwischen ihnen über die Reiter oben auf dem Lieder-Bildschirm.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Filter className="w-5 h-5 text-purple-400" />
                                Kategorien und Filter
                            </h4>
                            <p className="text-sm text-text-secondary mb-3">
                                Lieder werden automatisch nach Kategorien gruppiert: Weihnachten, Ostern, Erntedankfest, etc.
                                Verwenden Sie Filter im Repertoire für eine schnelle Suche.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Alle</span>
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Weihnachten</span>
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Ostern</span>
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Erntedankfest</span>
                            </div>
                        </div>

                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                Anmerkungen und Notizen
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Öffnen Sie die Noten im Vollbildmodus und drücken Sie auf den Stift, um zu zeichnen,
                                zu unterstreichen oder Notizen zu machen. Ihre Markierungen sind privat und werden auf dem Gerät gespeichert.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Archive className="w-5 h-5 text-amber-400" />
                                MChA Archiv
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Ein globaler Katalog mit Tausenden von Liedern von MSC ECB. Suchen Sie nach Liedern,
                                betrachten Sie Noten und fügen Sie sie mit einem Klick dem Repertoire Ihres Chores hinzu.
                            </p>
                            <p className="text-xs text-text-secondary/60 mt-3 italic">
                                Nur verfügbar für Chöre vom Typ "MSC ECB Chor".
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Download className="w-5 h-5 text-green-400" />
                                Offline Modus
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Lieder, die Sie geöffnet haben, werden automatisch für den Offline-Zugriff zwischengespeichert.
                                Sie können die PDF-Datei auch über die Schaltfläche oben rechts auf Ihr Gerät herunterladen.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Trash2 className="w-5 h-5 text-red-400" />
                                Papierkorb
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Gelöschte Lieder landen im Papierkorb und können wiederhergestellt werden.
                                Der Zugriff auf den Papierkorb erfolgt über das 🗑️-Symbol auf der Repertoirekarte.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SERVICES TAB */}
            {activeTab === 'services' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Gottesdienste und Zeitplan</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2">📅 Einen Gottesdienst erstellen</h4>
                            <p className="text-sm text-text-secondary">
                                Der Dirigent kann einen neuen Gottesdienst mit Datum, Uhrzeit und Liedliste erstellen.
                                Drücken Sie die "+"-Taste in der Registerkarte "Gottesdienste".
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">🎵 Lieder für den Gottesdienst</h4>
                            <p className="text-sm text-text-secondary">
                                Jeder Gottesdienst hat seine eigene Liederliste. Die Chormitglieder sehen die Noten für ihren
                                Gottesdienst direkt auf der Karte. Die Reihenfolge der Lieder kann durch Ziehen geändert werden.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">✅ Anwesenheitserfassung (Umfrage)</h4>
                            <p className="text-sm text-text-secondary">
                                Der Dirigent kann die Anwesenheit manuell markieren oder eine Push-Benachrichtigung mit Schaltflächen wie „Ich komme“ / „Komme nicht“ senden.
                                Die Antworten der Chormitglieder werden automatisch in den Anwesenheitsstatistiken gespeichert.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">📊 Chorstatistik</h4>
                            <p className="text-sm text-text-secondary">
                                Detaillierte Statistiken sind im Profil des Chores verfügbar: Anwesenheitsdiagramm, Balance aller Stimmen (einschließlich benutzerdefinierter) und die am häufigsten gesungenen Lieder.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">📁 Gottesdienstarchiv</h4>
                            <p className="text-sm text-text-secondary">
                                Vergangene Gottesdienste werden automatisch archiviert. Sie können zur
                                Analyse des Repertoires und der Statistik eingesehen werden.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ADMIN TAB */}
            {activeTab === 'admin' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Dirigentenwerkzeuge</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">1</span>
                                Einladungscodes 🔑
                            </h4>
                            <p className="text-sm text-text-secondary mb-3">
                                Erstellen Sie Codes, damit neue Mitglieder beitreten können. Code-Arten:
                            </p>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li><b>Regulärer Code</b> — für Chormitglieder mit Basisrechten</li>
                                <li><b>Admin-Code</b> — für Assistenten mit erweiterten Rechten</li>
                            </ul>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">2</span>
                                Mitgliederverwaltung 👥
                            </h4>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Stimme und Rolle eines Mitglieds ändern</li>
                                <li>Stimmführer ernennen</li>
                                <li>Doppelte Profile zusammenführen</li>
                                <li>Mitglieder entfernen</li>
                            </ul>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">3</span>
                                Benachrichtigungen 📢
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Senden Sie Push-Benachrichtigungen an alle Chormitglieder oder einzelne Stimmen.
                                Ideal für eilige Ankündigungen und Erinnerungen.
                            </p>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">4</span>
                                Statistiken 📊
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Zeigen Sie Anwesenheitsstatistiken für jedes Mitglied an,
                                analysieren Sie die Aktivität der Stimmen und planen Sie Proben.
                            </p>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">5</span>
                                Choreinstellungen ⚙️
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Ändern Sie den Namen und das Symbol des Chores über das Einstellungsmenü
                                (klicken Sie auf das Chorlogo oben).
                            </p>
                        </section>
                    </div>
                </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Benachrichtigungen</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2">🔔 Push-Benachrichtigungen</h4>
                            <p className="text-sm text-text-secondary">
                                Erhalten Sie Benachrichtigungen über neue Gottesdienste, Planänderungen und
                                Nachrichten vom Dirigenten direkt auf Ihr Handy.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">⚙️ Einstellungen</h4>
                            <p className="text-sm text-text-secondary mb-3">
                                Verwalten Sie Benachrichtigungen im Abschnitt "Konto" → "Benachrichtigungen":
                            </p>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Alle Benachrichtigungen aktivieren/deaktivieren</li>
                                {!isNative && (
                                    <li>Benachrichtigungen im Browser erlauben</li>
                                )}
                            </ul>
                        </div>

                        <div className="bg-amber-500/10 p-5 md:p-6 rounded-3xl border border-amber-500/20 h-full md:col-span-2">
                            <h4 className="font-bold text-text-primary mb-2">⚠️ Wichtig</h4>
                            {isNative ? (
                                <p className="text-sm text-text-secondary">
                                    Stellen Sie sicher, dass Sie den Empfang von Push-Benachrichtigungen in den Einstellungen Ihres Geräts zugelassen haben (Einstellungen → Benachrichtigungen → MyChoir).
                                </p>
                            ) : (
                                <p className="text-sm text-text-secondary">
                                    Um Push-Benachrichtigungen zu erhalten, müssen Sie diese im Browser zulassen.
                                    Wenn Sie sie versehentlich blockiert haben, gehen Sie zu Ihren Browsereinstellungen.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* FAQ TAB */}
            {activeTab === 'faq' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Häufig gestellte Fragen</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2">Wie trete ich einem Chor bei?</h4>
                            <p className="text-sm text-text-secondary">
                                Bitten Sie den Dirigenten Ihres Chors um einen Einladungscode.
                                Geben Sie ihn nach der Registrierung auf dem Anmeldebildschirm ein.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">Wie erstelle ich einen eigenen Chor?</h4>
                            <p className="text-sm text-text-secondary">
                                Wählen Sie auf dem Anmeldebildschirm "Neuen Chor erstellen".
                                Geben Sie einen Namen ein und wählen Sie einen Chortyp: „MSC ECB Chor“ (mit Zugriff auf das MChA Archiv)
                                oder „Normaler Chor“ (nur eigenes Repertoire).
                                Sie werden automatisch zum Dirigenten.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">Wie füge ich dem Repertoire ein Lied hinzu?</h4>
                            <p className="text-sm text-text-secondary">
                                Drücken Sie das "+" im Abschnitt "Lieder". Für MSC-Chöre ist
                                auch eine Suche im MChA Archiv möglich. Oder erstellen Sie Ihr eigenes Lied durch Hochladen einer PDF-Datei.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">Wie lösche ich mein Konto?</h4>
                            <p className="text-sm text-text-secondary">
                                Gehen Sie zu "Konto" → scrollen Sie nach unten → "Konto löschen".
                                Alle Ihre Daten werden unwiderruflich gelöscht.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">Wie kontaktiere ich den Support?</h4>
                            <div className="space-y-1.5 text-sm text-text-secondary mt-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 text-center">📧</span>
                                    <button onClick={() => openExternal('mailto:artom.devv@gmail.com')} className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">artom.devv@gmail.com</button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-6 text-center">💬</span>
                                    <button onClick={() => openExternal('https://t.me/artom_dev')} className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">@artom_dev</button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-6 text-center">🌐</span>
                                    <button onClick={() => openExternal('https://artom.dev')} className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">artom.dev</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
