// Bulk import script for choir members
// Run with: node import_members.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';

// Firebase config (same as in the app)
const firebaseConfig = {
    apiKey: "AIzaSyBvDx6LSE59e-OT-IB2e1cC2vxovCjxSSU",
    authDomain: "mychoir-app.firebaseapp.com",
    projectId: "mychoir-app",
    storageBucket: "mychoir-app.firebasestorage.app",
    messagingSenderId: "580489855407",
    appId: "1:580489855407:web:c9c4206a6cddf59e8f6f85"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// The choir ID to add members to
// You may need to update this - I'll try to find it first
const CHOIR_ID = "JZxMYaVgSA4yYVVxlVsr"; // Update if different

const members = [
    "Акопян Естер",
    "Акопян Надія",
    "Акопян Руслан",
    "Акопян Яна",
    "Алутіс Софія",
    "Бабенчук Аліна",
    "Бабенчук Веніамін",
    "Берчук Іван",
    "Бульчук Ання",
    "Бульчук Люба",
    "Валла Даниїл",
    "Валла Іван",
    "Валла Ірина",
    "Валла Вікторія",
    "Веселуха Валентина",
    "Гарбузовський Максим",
    "Гиріч Альфред",
    "Гриценко Даниїл",
    "Данюк Валентин",
    "Данюк Віталік",
    "Данюк Меріліна",
    "Дверницький Ілля",
    "Дуля Анатолій",
    "Дуля Андрій",
    "Дуля Артьом",
    "Дуля Авенір",
    "Дуля Богдан",
    "Дуля Ерік",
    "Дуля Евеліна",
    "Дуля Люба",
    "Дуля Маріела",
    "Дуля Марк",
    "Дуля Олег",
    "Запара Діна",
    "Ільєва Аліна",
    "Ільєва Світлана",
    "Іордан Олександр",
    "Іордан Даниїл",
    "Іордан Ольга",
    "Іордан Катерина",
    "Кондратьєв Олександер",
    "Кондратьєва Аліна",
    "Левценюк Діана",
    "Лисенко Олександр",
    "Мангар Андрій",
    "Мангар Мілана",
    "Марфіч Софія",
    "Мейстер Давід",
    "Обозний Віталій",
    "Олійник Андрій",
    "Олексієвець Соня",
    "Олексієвець Ярослав",
    "Пелепяк Давід",
    "Пелепяк Ларіса",
    "Петренко Ірина",
    "Ратушний Давід",
    "Стецюк Оксана",
    "Столярчук Іван",
    "Столярчук Інна",
    "Тимченко Дарія",
    "Тимченко Каріна",
    "Юхимук Давід",
    "Юхимук Василь",
    "Хатоєв Констянтин",
    "Швець Ангеліна",
    "Швець Назар",
    "Шевченка Ілля",
    "Швець Інна",
    "Примаченко Валерія",
    "Бульчук Ліда",
    "Шевченко Яша",
    "Таран Анатолій",
    "Таран Інна",
    "Дуля Віолетта",
    "Нетеса Руслан",
    "Цигольніков Віталік",
    "Веселовська Дана",
    "Швець Ання"
];

async function importMembers() {
    console.log(`Importing ${members.length} members to choir ${CHOIR_ID}...`);

    try {
        // First, get existing members to avoid duplicates
        const choirRef = doc(db, "choirs", CHOIR_ID);
        const choirSnap = await getDoc(choirRef);

        if (!choirSnap.exists()) {
            console.error("Choir not found!");
            process.exit(1);
        }

        const existingMembers = choirSnap.data().members || [];
        const existingNames = new Set(existingMembers.map(m => m.name.toLowerCase().trim()));

        console.log(`Found ${existingMembers.length} existing members`);

        // Create member objects for new members only
        const newMembers = [];
        const timestamp = Date.now();

        for (let i = 0; i < members.length; i++) {
            const name = members[i].trim();
            if (!name) continue;

            // Check if already exists
            if (existingNames.has(name.toLowerCase())) {
                console.log(`  Skipping (exists): ${name}`);
                continue;
            }

            newMembers.push({
                id: `manual_${timestamp}_${i}`,
                name: name,
                role: 'member',
                // voice is undefined/not set
            });
        }

        if (newMembers.length === 0) {
            console.log("No new members to add!");
            process.exit(0);
        }

        console.log(`Adding ${newMembers.length} new members...`);

        // Add all new members at once using arrayUnion
        for (const member of newMembers) {
            await updateDoc(choirRef, {
                members: arrayUnion(member)
            });
            console.log(`  Added: ${member.name}`);
        }

        console.log("\n✅ Import complete!");
        console.log(`Total members now: ${existingMembers.length + newMembers.length}`);

    } catch (error) {
        console.error("Error importing members:", error);
        process.exit(1);
    }

    process.exit(0);
}

importMembers();
