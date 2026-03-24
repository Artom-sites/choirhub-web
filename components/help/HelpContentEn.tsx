import React from 'react';
import { Music2, Calendar, Users, Archive, Palette, Shield, User, FileText, Filter, Download, Trash2 } from "lucide-react";

export default function HelpContentEn({ activeTab, openExternal, isNative }: { activeTab: string, openExternal: (url: string) => void, isNative: boolean }) {
    return (
        <>
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <section>
                        <h3 className="text-2xl font-bold text-text-primary mb-4">Welcome to MyChoir! 👋</h3>
                        <p className="text-text-secondary leading-relaxed">
                            This is an app for organizing choir life. View repertoire, service plans,
                            learn parts, get notifications, and manage your choir.
                        </p>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Music2 className="w-6 h-6 text-purple-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">Repertoire</h4>
                            <p className="text-xs text-text-secondary">Choir song database with sheet music and parts.</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Calendar className="w-6 h-6 text-blue-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">Services</h4>
                            <p className="text-xs text-text-secondary">Schedule of services with songs and attendance tracking.</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Users className="w-6 h-6 text-green-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">Members</h4>
                            <p className="text-xs text-text-secondary">List of choristers, parts, and attendance statistics.</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Archive className="w-6 h-6 text-amber-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">MChA Archive</h4>
                            <p className="text-xs text-text-secondary">Thousands of songs from the MSC ECB catalog (for MSC choirs).</p>
                        </div>
                    </div>

                    <section className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-5 rounded-3xl border border-indigo-500/20">
                        <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                            <Palette className="w-5 h-5 text-indigo-400" />
                            Themes
                        </h4>
                        <p className="text-sm text-text-secondary">
                            Switch between dark and light themes in the app header.
                            A system mode is also available, which follows your device settings.
                        </p>
                    </section>
                </div>
            )}

            {/* ROLES TAB */}
            {activeTab === 'roles' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Access Levels</h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        <div className="p-5 md:p-6 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 h-full">
                            <div className="flex items-center gap-3 mb-3">
                                <Shield className="w-5 h-5 text-indigo-400" />
                                <h4 className="font-bold text-text-primary">Conductor (Admin)</h4>
                            </div>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Full control over the choir 👑</li>
                                <li>Add, edit, and delete songs</li>
                                <li>Create and edit service plans</li>
                                <li>Manage members and their roles</li>
                                <li>Create invitation codes</li>
                                <li>Send push notifications</li>
                                <li>View attendance statistics</li>
                                <li>Choir settings (name, icon)</li>
                            </ul>
                        </div>

                        <div className="p-5 md:p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 h-full">
                            <div className="flex items-center gap-3 mb-3">
                                <User className="w-5 h-5 text-emerald-400" />
                                <h4 className="font-bold text-text-primary">Assistant Conductor</h4>
                            </div>
                            <p className="text-sm text-text-secondary mb-3">
                                A member with elevated rights via Admin code:
                            </p>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Can add songs to the repertoire</li>
                                <li>Can view attendance statistics</li>
                                <li>Can edit services</li>
                            </ul>
                        </div>

                        <div className="p-5 md:p-6 rounded-3xl bg-surface border border-border h-full">
                            <div className="flex items-center gap-3 mb-3">
                                <User className="w-5 h-5 text-gray-400" />
                                <h4 className="font-bold text-text-primary">Chorister (Member)</h4>
                            </div>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>View repertoire and parts 👀</li>
                                <li>View service schedule</li>
                                <li>Vote for attendance ("I will be there" / "Won't be there")</li>
                                <li>Download PDF files</li>
                                <li>Synchronization (offline mode)</li>
                            </ul>
                        </div>

                        <div className="p-5 md:p-6 rounded-3xl bg-surface border border-border h-full lg:col-span-2">
                            <h4 className="font-bold text-text-primary mb-2">🎭 Custom Roles and Parts</h4>
                            <p className="text-sm text-text-secondary">
                                The conductor can create custom roles (e.g., "Accompanist") and custom vocal parts (e.g., "Baritone" or "Student"). These custom parts are automatically included in the voice balance statistics.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SONGS TAB */}
            {activeTab === 'songs' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Working with Songs</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-400" />
                                Parts and Score
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Each song can have multiple parts: Score, Soprano, Alto, Tenor, Bass.
                                Switch between them using the tabs at the top of the song screen.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Filter className="w-5 h-5 text-purple-400" />
                                Categories and Filters
                            </h4>
                            <p className="text-sm text-text-secondary mb-3">
                                Songs are automatically grouped by categories: Christmas, Easter, Harvest, etc.
                                Use filters in the repertoire for quick searching.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">All</span>
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Christmas</span>
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Easter</span>
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Harvest</span>
                            </div>
                        </div>

                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                Annotations and Notes
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Open sheet music in full screen and press the pencil to draw,
                                underline, or write notes. Your markings are personal and stored on the device.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Archive className="w-5 h-5 text-amber-400" />
                                MChA Archive
                            </h4>
                            <p className="text-sm text-text-secondary">
                                A global catalog with thousands of songs from MSC ECB. Search for songs,
                                view sheet music, and add them to your choir's repertoire with one tap.
                            </p>
                            <p className="text-xs text-text-secondary/60 mt-3 italic">
                                Available only for choirs of the "MSC ECB Choir" type.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Download className="w-5 h-5 text-green-400" />
                                Offline Mode
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Songs you've opened are automatically cached for offline access.
                                You can also download the PDF to your device using the button in the top right corner.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Trash2 className="w-5 h-5 text-red-400" />
                                Trash
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Deleted songs go to the trash and can be restored.
                                Access the trash via the 🗑️ icon on the repertoire card.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SERVICES TAB */}
            {activeTab === 'services' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Services and Schedule</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2">📅 Creating a Service</h4>
                            <p className="text-sm text-text-secondary">
                                The conductor can create a new service with a date, time, and song list.
                                Press the "+" button on the "Services" tab.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">🎵 Service Songs</h4>
                            <p className="text-sm text-text-secondary">
                                Each service has its own song list. Choristers see sheet music for their
                                service right on the card. Song order can be changed by dragging.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">✅ Attendance Marking (Poll)</h4>
                            <p className="text-sm text-text-secondary">
                                The conductor can mark attendance manually, or send a push notification with "I will be there" / "Won't be there" buttons.
                                Choristers' replies are automatically saved in attendance statistics.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">📊 Choir Statistics</h4>
                            <p className="text-sm text-text-secondary">
                                Detailed statistics are available in the choir profile: attendance chart, balance of all voices (including custom), and top most frequently performed songs.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">📁 Service Archive</h4>
                            <p className="text-sm text-text-secondary">
                                Past services are automatically archived. They can be viewed
                                for repertoire analysis and statistics.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ADMIN TAB */}
            {activeTab === 'admin' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Conductor Tools</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">1</span>
                                Invitation Codes 🔑
                            </h4>
                            <p className="text-sm text-text-secondary mb-3">
                                Create codes for new members to join. Code types:
                            </p>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li><b>Regular code</b> — for choristers with basic rights</li>
                                <li><b>Admin code</b> — for assistants with elevated rights</li>
                            </ul>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">2</span>
                                Member Management 👥
                            </h4>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Change member's part and role</li>
                                <li>Assign part leaders</li>
                                <li>Merge duplicate profiles</li>
                                <li>Remove members</li>
                            </ul>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">3</span>
                                Notifications 📢
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Send push notifications to all choir members or specific parts.
                                Ideal for urgent announcements and reminders.
                            </p>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">4</span>
                                Statistics 📊
                            </h4>
                            <p className="text-sm text-text-secondary">
                                View attendance statistics for each member,
                                analyze part activity, and plan rehearsals.
                            </p>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">5</span>
                                Choir Settings ⚙️
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Change the choir's name and icon through the settings menu
                                (tap on the choir logo in the header).
                            </p>
                        </section>
                    </div>
                </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Notifications</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2">🔔 Push Notifications</h4>
                            <p className="text-sm text-text-secondary">
                                Get notified about new services, schedule changes, and
                                conductor messages right on your phone.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">⚙️ Settings</h4>
                            <p className="text-sm text-text-secondary mb-3">
                                Manage notifications in the "Account" → "Notifications" section:
                            </p>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Enable/disable all notifications</li>
                                {!isNative && (
                                    <li>Allow notifications in browser</li>
                                )}
                            </ul>
                        </div>

                        <div className="bg-amber-500/10 p-5 md:p-6 rounded-3xl border border-amber-500/20 h-full md:col-span-2">
                            <h4 className="font-bold text-text-primary mb-2">⚠️ Important</h4>
                            {isNative ? (
                                <p className="text-sm text-text-secondary">
                                    Make sure you have allowed push notifications in your device settings (Settings → Notifications → MyChoir).
                                </p>
                            ) : (
                                <p className="text-sm text-text-secondary">
                                    To receive push notifications, you need to allow them in your browser.
                                    If you accidentally blocked them, go to your browser settings.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* FAQ TAB */}
            {activeTab === 'faq' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Frequently Asked Questions</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2">How to join a choir?</h4>
                            <p className="text-sm text-text-secondary">
                                Get an invitation code from your choir conductor.
                                Enter it on the login screen after registering.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">How to create my own choir?</h4>
                            <p className="text-sm text-text-secondary">
                                On the login screen, select "Create new choir".
                                Enter a name and choose a choir type: "MSC ECB Choir" (with access to MChA Archive)
                                or "Regular choir" (own repertoire only).
                                You will automatically become the conductor.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">How to add a song to the repertoire?</h4>
                            <p className="text-sm text-text-secondary">
                                Press "+" in the "Songs" section. For MSC choirs,
                                search in the MChA Archive is also available. Or create your own song by uploading a PDF.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">How to delete my account?</h4>
                            <p className="text-sm text-text-secondary">
                                Go to "Account" → scroll down → "Delete account".
                                All your data will be permanently erased.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">How to contact support?</h4>
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
