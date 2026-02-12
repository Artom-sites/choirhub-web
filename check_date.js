const isUpcoming = (dateStr, timeStr) => {
    const now = new Date();
    const parts = dateStr.split('-');
    if (parts.length < 3) return false;

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);

    const serviceDate = new Date(year, month, day);

    if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        serviceDate.setHours(hours, minutes, 0, 0);
        console.log(`Checking ${dateStr} ${timeStr} -> ${serviceDate.toLocaleString()} vs Now: ${now.toLocaleString()}`);
        return serviceDate > now;
    } else {
        serviceDate.setHours(23, 59, 59, 999);
        console.log(`Checking ${dateStr} (No Time) -> ${serviceDate.toLocaleString()} vs Now: ${now.toLocaleString()}`);
        return serviceDate >= now;
    }
};

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

console.log("--- Test Cases ---");
console.log(`Today is: ${todayStr}`);
console.log(`Current Time: ${today.toLocaleTimeString()}`);

console.log("1. Today 10:00 (Past):", isUpcoming(todayStr, "10:00"));
console.log("2. Today 23:00 (Future):", isUpcoming(todayStr, "23:00"));
console.log("3. Today No Time (All Day):", isUpcoming(todayStr, undefined));
console.log("4. Today Empty String Time:", isUpcoming(todayStr, ""));
console.log("5. Tomorrow 10:00:", isUpcoming("2026-02-13", "10:00"));
