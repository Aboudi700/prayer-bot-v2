const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const axios = require('axios');
const cron = require('node-cron');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const CONFIG = {
    CITY: 'Jeddah',
    COUNTRY: 'Saudi Arabia',
    METHOD: 4,
    TIMEZONE: 'Asia/Riyadh'
};

const player = createAudioPlayer();
let currentPrayerTimes = {};
let scheduledTextReminders = new Map();

// COMPREHENSIVE ATHKAR COLLECTION
const MORNING_ATHKAR = [
    {
        arabic: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لا إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
        transliteration: "Asbahna wa asbahal-mulku lillah, walhamdulillah, la ilaha illallah wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa 'ala kulli shay'in qadeer",
        meaning: "We have reached the morning and at this very time all sovereignty belongs to Allah. All praise is for Allah. There is none worthy of worship but Allah, alone, without any partner. To Him belongs all sovereignty and praise and He is over all things omnipotent.",
        times: 1
    },
    {
        arabic: "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ",
        transliteration: "Allahumma bika asbahna, wa bika amsayna, wa bika nahya, wa bika namutu wa ilaykan-nushur",
        meaning: "O Allah, by Your leave we have reached the morning and by Your leave we have reached the evening, by Your leave we live and die and unto You is our resurrection.",
        times: 1
    },
    {
        arabic: "اللَّهُمَّ أَنْتَ رَبِّي لا إِلَهَ إِلا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لا يَغْفِرُ الذُّنُوبَ إِلا أَنْتَ",
        transliteration: "Allahumma anta rabbi la ilaha illa anta, khalaqtani wa ana 'abduka, wa ana 'ala 'ahdika wa wa'dika mastata'tu, a'uthu bika min sharri ma sana'tu, abu'u laka bini'matika 'alayya, wa abu'u bidhanbi faghfir li fa innahu la yaghfirudh-dhunuba illa anta",
        meaning: "O Allah, You are my Lord, none has the right to be worshipped except You. You created me and I am Your servant. I abide by Your covenant and promise as best I can. I take refuge in You from the evil of what I have done. I acknowledge Your favor upon me and I acknowledge my sin, so forgive me, for verily none can forgive sin except You.",
        times: 1
    },
    {
        arabic: "اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لا إِلَهَ إِلا أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ، وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لا إِلَهَ إِلا أَنْتَ",
        transliteration: "Allahumma 'afini fi badani, allahumma 'afini fi sam'i, allahumma 'afini fi basari, la ilaha illa anta. Allahumma inni a'uthu bika minal-kufri, wal-faqri, wa a'uthu bika min 'adhabil-qabri, la ilaha illa anta",
        meaning: "O Allah, grant me health in my body. O Allah, grant me health in my hearing. O Allah, grant me health in my sight. There is none worthy of worship but You. O Allah, I take refuge with You from disbelief and poverty, and I take refuge with You from the punishment of the grave. There is none worthy of worship but You.",
        times: 3
    },
    {
        arabic: "حَسْبِيَ اللَّهُ لا إِلَهَ إِلا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ",
        transliteration: "Hasbiyallahu la ilaha illa huwa, 'alayhi tawakkaltu, wa huwa rabbul-'arshil-'azheem",
        meaning: "Allah is sufficient for me. There is none worthy of worship but Him. I have placed my trust in Him, and He is the Lord of the Majestic Throne.",
        times: 7
    },
    {
        arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
        transliteration: "Subhanallahi wa bihamdihi",
        meaning: "How perfect Allah is and I praise Him.",
        times: 100
    },
    {
        arabic: "أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ",
        transliteration: "Astaghfirullah wa atubu ilayh",
        meaning: "I seek forgiveness from Allah and repent to Him.",
        times: 100
    },
    {
        arabic: "لا إِلَهَ إِلا اللَّهُ وَحْدَهُ لا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
        transliteration: "La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa 'ala kulli shay'in qadeer",
        meaning: "There is none worthy of worship but Allah alone, without any partner. To Him belongs the sovereignty and to Him belongs all praise, and He is over all things omnipotent.",
        times: 10
    }
];

const EVENING_ATHKAR = [
    {
        arabic: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لا إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
        transliteration: "Amsayna wa amsal-mulku lillah, walhamdulillah, la ilaha illallah wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa 'ala kulli shay'in qadeer",
        meaning: "We have reached the evening and at this very time all sovereignty belongs to Allah. All praise is for Allah. There is none worthy of worship but Allah, alone, without any partner. To Him belongs all sovereignty and praise and He is over all things omnipotent.",
        times: 1
    },
    {
        arabic: "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ",
        transliteration: "Allahumma bika amsayna, wa bika asbahna, wa bika nahya, wa bika namutu wa ilaykal-maseer",
        meaning: "O Allah, by Your leave we have reached the evening and by Your leave we have reached the morning, by Your leave we live and die and unto You is our return.",
        times: 1
    },
    {
        arabic: "اللَّهُمَّ أَنْتَ رَبِّي لا إِلَهَ إِلا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لا يَغْفِرُ الذُّنُوبَ إِلا أَنْتَ",
        transliteration: "Allahumma anta rabbi la ilaha illa anta, khalaqtani wa ana 'abduka, wa ana 'ala 'ahdika wa wa'dika mastata'tu, a'uthu bika min sharri ma sana'tu, abu'u laka bini'matika 'alayya, wa abu'u bidhanbi faghfir li fa innahu la yaghfirudh-dhunuba illa anta",
        meaning: "O Allah, You are my Lord, none has the right to be worshipped except You. You created me and I am Your servant. I abide by Your covenant and promise as best I can. I take refuge in You from the evil of what I have done. I acknowledge Your favor upon me and I acknowledge my sin, so forgive me, for verily none can forgive sin except You.",
        times: 1
    },
    {
        arabic: "اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لا إِلَهَ إِلا أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ، وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لا إِلَهَ إِلا أَنْتَ",
        transliteration: "Allahumma 'afini fi badani, allahumma 'afini fi sam'i, allahumma 'afini fi basari, la ilaha illa anta. Allahumma inni a'uthu bika minal-kufri, wal-faqri, wa a'uthu bika min 'adhabil-qabri, la ilaha illa anta",
        meaning: "O Allah, grant me health in my body. O Allah, grant me health in my hearing. O Allah, grant me health in my sight. There is none worthy of worship but You. O Allah, I take refuge with You from disbelief and poverty, and I take refuge with You from the punishment of the grave. There is none worthy of worship but You.",
        times: 3
    },
    {
        arabic: "حَسْبِيَ اللَّهُ لا إِلَهَ إِلا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ",
        transliteration: "Hasbiyallahu la ilaha illa huwa, 'alayhi tawakkaltu, wa huwa rabbul-'arshil-'azheem",
        meaning: "Allah is sufficient for me. There is none worthy of worship but Him. I have placed my trust in Him, and He is the Lord of the Majestic Throne.",
        times: 7
    },
    {
        arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
        transliteration: "Subhanallahi wa bihamdihi",
        meaning: "How perfect Allah is and I praise Him.",
        times: 100
    },
    {
        arabic: "أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ",
        transliteration: "Astaghfirullah wa atubu ilayh",
        meaning: "I seek forgiveness from Allah and repent to Him.",
        times: 100
    },
    {
        arabic: "آمَنَّا بِاللَّهِ وَحْدَهُ لا شَرِيكَ لَهُ، وَكَفَرْنَا بِمَا يُعْبَدُ مِنْ دُونِهِ",
        transliteration: "Amanna billahi wahdahu la sharika lah, wa kafarna bima yu'badu min dunih",
        meaning: "We believe in Allah alone without any partner, and we disbelieve in whatever is worshipped besides Him.",
        times: 3
    }
];

// FALLBACK QURAN VERSES (Arabic)
const FALLBACK_QURAN_VERSES = [
    {
        text: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
        reference: "القرآن 94:6"
    },
    {
        text: "وَمَا أَرْسَلْنَاكَ إِلَّا رَحْمَةً لِّلْعَالَمِينَ",
        reference: "القرآن 21:107"
    },
    {
        text: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
        reference: "القرآن 2:286"
    },
    {
        text: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
        reference: "القرآن 13:28"
    },
    {
        text: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ",
        reference: "القرآن 65:3"
    },
    {
        text: "وَرَحْمَتِي وَسِعَتْ كُلَّ شَيْءٍ",
        reference: "القرآن 7:156"
    },
    {
        text: "إِنَّ الصَّلَاةَ تَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنكَرِ",
        reference: "القرآن 29:45"
    },
    {
        text: "وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ",
        reference: "القرآن 57:4"
    },
    {
        text: "فَاذْكُرُونِي أَذْكُرْكُمْ",
        reference: "القرآن 2:152"
    },
    {
        text: "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا",
        reference: "القرآن 65:2"
    }
];

// FIXED: Function to get comprehensive Athkar package (split into multiple messages)
async function sendAthkarPackage(message, isMorning = true) {
    const athkarList = isMorning ? MORNING_ATHKAR : EVENING_ATHKAR;
    const time = isMorning ? "الصباح" : "المساء";
    
    // Send header first
    await message.channel.send(`🕌 **باقة أذكار ${time} الكاملة** 🌟\n\n` +
                              `*هذه الأذكار من السنة النبوية الصحيحة*\n` +
                              `────────────────────`);

    // Send each thikr in separate messages to avoid character limit
    for (let i = 0; i < athkarList.length; i++) {
        const thikr = athkarList[i];
        
        let thikrMessage = `**${i + 1}. ${thikr.times > 1 ? `(${thikr.times} مرة)` : ''}**\n`;
        thikrMessage += `📖 ${thikr.arabic}\n`;
        thikrMessage += `*${thikr.transliteration}*\n`;
        thikrMessage += `"${thikr.meaning}"\n`;
        
        // Add separator between thikr
        if (i < athkarList.length - 1) {
            thikrMessage += `────────────────────`;
        }
        
        await message.channel.send(thikrMessage);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Send footer
    await message.channel.send(`\n📖 * recite these ${time} Athkar for protection and blessings *`);
}

// FIXED: Function to get daily single Athkar
function getDailyAthkar(isMorning = true) {
    const athkarList = isMorning ? MORNING_ATHKAR : EVENING_ATHKAR;
    const randomThikr = athkarList[Math.floor(Math.random() * athkarList.length)];
    const time = isMorning ? "الصباح" : "المساء";
    
    return `🕌 **ذكر ${time}**\n\n` +
           `${randomThikr.arabic}\n\n` +
           `*${randomThikr.transliteration}*\n` +
           `"${randomThikr.meaning}"\n\n` +
           `*كرر ${randomThikr.times} مرة للثواب الأعظم*`;
}

// FIXED: Function to get next prayer time with proper timezone handling
function getNextPrayer() {
    const now = new Date();
    
    // Convert to Saudi Arabia timezone properly
    const saudiTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Riyadh"}));
    const currentTime = saudiTime.getHours() * 60 + saudiTime.getMinutes(); // Convert to minutes
    
    const prayerTimes = [
        { name: 'Fajr', time: currentPrayerTimes.Fajr },
        { name: 'Dhuhr', time: currentPrayerTimes.Dhuhr },
        { name: 'Asr', time: currentPrayerTimes.Asr },
        { name: 'Maghrib', time: currentPrayerTimes.Maghrib },
        { name: 'Isha', time: currentPrayerTimes.Isha }
    ];
    
    // Convert prayer times to minutes (assuming 24-hour format from API)
    const prayerMinutes = prayerTimes.map(prayer => {
        const [hours, minutes] = prayer.time.split(':').map(Number);
        return {
            name: prayer.name,
            minutes: hours * 60 + minutes,
            time: prayer.time
        };
    });
    
    // Find next prayer
    let nextPrayer = null;
    for (const prayer of prayerMinutes) {
        if (prayer.minutes > currentTime) {
            nextPrayer = prayer;
            break;
        }
    }
    
    // If no prayer found today, use first prayer tomorrow (Fajr)
    if (!nextPrayer) {
        nextPrayer = {
            name: 'Fajr',
            minutes: prayerMinutes[0].minutes + (24 * 60), // Add 24 hours
            time: prayerMinutes[0].time
        };
    }
    
    // Calculate time difference
    const timeDiff = nextPrayer.minutes - currentTime;
    const hoursLeft = Math.floor(timeDiff / 60);
    const minutesLeft = timeDiff % 60;
    
    // Format the time display
    let timeDisplay = '';
    if (hoursLeft > 0 && minutesLeft > 0) {
        timeDisplay = `${hoursLeft} hours ${minutesLeft} minutes`;
    } else if (hoursLeft > 0) {
        timeDisplay = `${hoursLeft} hours`;
    } else {
        timeDisplay = `${minutesLeft} minutes`;
    }
    
    // Add appropriate message based on time left
    let statusMessage = '';
    if (hoursLeft > 1) {
        statusMessage = 'Relax and prepare!';
    } else if (hoursLeft > 0 || minutesLeft > 30) {
        statusMessage = 'Get ready soon!';
    } else {
        statusMessage = 'Prayer is very soon! Get ready!';
    }
    
    return {
        name: nextPrayer.name,
        time: nextPrayer.time,
        hoursLeft: hoursLeft,
        minutesLeft: minutesLeft,
        timeDisplay: timeDisplay,
        statusMessage: statusMessage
    };
}

// QURAN FUNCTIONS (API + Fallback)
async function getQuranVerse() {
    try {
        // Try API first (75% chance)
        if (Math.random() < 0.75) {
            return await getQuranFromAPI();
        } else {
            // Use curated popular surahs (25% chance)
            return await getCuratedQuranVerse();
        }
    } catch (error) {
        // Fallback to static verses if API fails
        return getFallbackQuranVerse();
    }
}

async function getQuranFromAPI() {
    try {
        const response = await axios.get('https://api.alquran.cloud/v1/ayah/random');
        const verse = response.data.data;
        return `📖 **آية قرآنية**\n${verse.text}\n*سورة ${verse.surah.englishName} - الآية ${verse.numberInSurah}*`;
    } catch (error) {
        throw new Error('API failed');
    }
}

async function getCuratedQuranVerse() {
    const popularSurahs = [
        { number: 1, name: 'الفاتحة' },
        { number: 2, name: 'البقرة' }, 
        { number: 36, name: 'يس' },
        { number: 55, name: 'الرحمن' },
        { number: 67, name: 'الملك' },
        { number: 112, name: 'الإخلاص' }
    ];
    
    const surah = popularSurahs[Math.floor(Math.random() * popularSurahs.length)];
    
    try {
        const response = await axios.get(`https://api.alquran.cloud/v1/surah/${surah.number}/ar`);
        const verses = response.data.data.ayahs;
        const randomVerse = verses[Math.floor(Math.random() * Math.min(verses.length, 10))]; // First 10 verses
        
        return `📖 **آية قرآنية**\n${randomVerse.text}\n*سورة ${surah.name} - الآية ${randomVerse.numberInSurah}*`;
    } catch (error) {
        throw new Error('Curated API failed');
    }
}

function getFallbackQuranVerse() {
    const randomVerse = FALLBACK_QURAN_VERSES[Math.floor(Math.random() * FALLBACK_QURAN_VERSES.length)];
    return `📖 **آية قرآنية**\n${randomVerse.text}\n*${randomVerse.reference}*`;
}

client.once('ready', async () => {
    console.log(`✅ Bot online: ${client.user.tag}`);
    client.user.setActivity('Prayer Reminders', { type: ActivityType.Listening });
    await fetchPrayerTimes();
    scheduleAllTextReminders();
    scheduleDailyInspiration();
    console.log('🤖 Bot ready - Quran API & Athkar loaded!');
});

// MESSAGE HANDLER WITH ALL COMMANDS
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    console.log(`💬 Message: ${message.content}`);

    if (message.content === '!prayertimes') {
        let response = `🕌 Accurate Prayer Times for ${CONFIG.CITY}:\n`;
        for (const [prayer, time] of Object.entries(currentPrayerTimes)) {
            response += `**${prayer}**: ${time}\n`;
        }
        message.channel.send(response);
    }

    // FIXED: Next prayer command with improved formatting
    if (message.content === '!next') {
        const nextPrayer = getNextPrayer();
        const response = `🕌 **Next Prayer: ${nextPrayer.name}**\n` +
                        `⏰ Time: ${nextPrayer.time}\n` +
                        `⏳ Time left: ${nextPrayer.timeDisplay}\n` +
                        `_${nextPrayer.statusMessage}_`;
        message.channel.send(response);
    }

    // DEBUG: Command to check current times and prayer calculations
    if (message.content === '!debug') {
        const now = new Date();
        const saudiTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Riyadh"}));
        const currentTime = saudiTime.getHours() * 60 + saudiTime.getMinutes();
        
        let debugInfo = `🔍 **Debug Information**\n`;
        debugInfo += `Current Saudi Time: ${saudiTime.toLocaleString()}\n`;
        debugInfo += `Current Minutes: ${currentTime}\n\n`;
        debugInfo += `**Prayer Times:**\n`;
        
        const prayerTimes = [
            { name: 'Fajr', time: currentPrayerTimes.Fajr },
            { name: 'Dhuhr', time: currentPrayerTimes.Dhuhr },
            { name: 'Asr', time: currentPrayerTimes.Asr },
            { name: 'Maghrib', time: currentPrayerTimes.Maghrib },
            { name: 'Isha', time: currentPrayerTimes.Isha }
        ];
        
        prayerTimes.forEach(prayer => {
            const [hours, minutes] = prayer.time.split(':').map(Number);
            const prayerMinutes = hours * 60 + minutes;
            debugInfo += `${prayer.name}: ${prayer.time} (${prayerMinutes} minutes)\n`;
        });
        
        const nextPrayer = getNextPrayer();
        debugInfo += `\n**Next Prayer:** ${nextPrayer.name} at ${nextPrayer.time}`;
        
        message.channel.send(debugInfo);
    }

    if (message.content === '!test') {
        message.channel.send('✅ Bot is working!');
    }

    if (message.content === '!autosend5') {
        message.channel.send('⏰ Test message will be sent to #prayers channel in 5 seconds...');
        
        setTimeout(() => {
            const prayersChannel = message.guild.channels.cache.find(channel => 
                channel.name === 'prayers' && channel.isTextBased()
            );
            
            if (prayersChannel) {
                prayersChannel.send('🔔 **TEST REMINDER** <@&1439370924003430441>\nThis is a test of the auto-send feature!')
                    .then(sentMessage => {
                        setTimeout(async () => {
                            try {
                                if (sentMessage.deletable) {
                                    await sentMessage.delete();
                                    console.log('🗑️ Auto-deleted test message');
                                }
                            } catch (error) {
                                console.log('❌ Could not auto-delete test message');
                            }
                        }, 60000);
                    });
                message.channel.send('✅ Test message sent to #prayers channel (will auto-delete in 1 min)!');
            } else {
                message.channel.send('❌ #prayers channel not found!');
            }
        }, 5000);
    }

    if (message.content === '!testreminder') {
        message.channel.send('🔄 Testing prayer reminder system...');
        sendPrayerReminderToAllChannels('Fajr', 'TEST: Prayer reminder working!', true);
    }

    if (message.content === '!refreshtimes') {
        await fetchPrayerTimes();
        scheduleAllTextReminders();
        message.channel.send('🔄 Prayer times refreshed and reminders rescheduled!');
    }

    // HELP COMMAND
    if (message.content === '!help' || message.content === '!commands') {
        const helpMessage = `
🤖 **أوامر بوت التذكير بالصلاة** 🕌

**أوقات الصلاة:**
\`!prayertimes\` - عرض أوقات الصلاة اليوم
\`!next\` - الوقت المتبقي للصلاة القادمة (مُحدَّث)
\`!refreshtimes\` - تحديث أوقات الصلاة من API
\`!debug\` - معلومات تصحيح للأوقات

**الأذكار والقرآن:**
\`!morning\` - أذكار الصباح
\`!evening\` - أذكار المساء
\`!morningpackage\` - باقة أذكار الصباح الكاملة
\`!eveningpackage\` - باقة أذكار المساء الكاملة
\`!quran\` - آية قرآنية عشوائية (API + احتياطي)
\`!inspire\` - آية قرآنية أو ذكر عشوائي

**الأوامر التجريبية:**
\`!test\` - فحص عمل البوت
\`!testreminder\` - اختبار نظام التذكير
\`!autosend5\` - اختبار الإرسال التلقائي

**الميزات التلقائية:**
- 🕘 تذكير قبل الصلاة بـ 5 دقائق
- ⏰ تنبيه بوقت الصلاة مع منشن
- 📋 تسجيل الحضور بعد الصلاة بـ 10 دقيقة
- 🌅 أذكار الصباح الساعة 6:00 ص
- 🌇 أذكار المساء الساعة 6:00 م
- 📖 آية قرآنية الساعة 12:00 ظ

*جميع رسائل الأذكار تحذف تلقائياً عند منتصف الليل*
        `;
        
        message.channel.send(helpMessage);
    }

    // FIXED ATHKAR & QURAN COMMANDS
    if (message.content === '!morning') {
        const athkar = getDailyAthkar(true);
        message.channel.send(athkar);
    }

    if (message.content === '!evening') {
        const athkar = getDailyAthkar(false);
        message.channel.send(athkar);
    }

    if (message.content === '!morningpackage') {
        // Send initial loading message
        const loadingMsg = await message.channel.send('🔄 جاري تحميل باقة أذكار الصباح الكاملة...');
        await sendAthkarPackage(message, true);
        // Delete loading message after done
        setTimeout(() => loadingMsg.delete().catch(console.error), 3000);
    }

    if (message.content === '!eveningpackage') {
        // Send initial loading message
        const loadingMsg = await message.channel.send('🔄 جاري تحميل باقة أذكار المساء الكاملة...');
        await sendAthkarPackage(message, false);
        // Delete loading message after done
        setTimeout(() => loadingMsg.delete().catch(console.error), 3000);
    }

    if (message.content === '!quran') {
        const verse = await getQuranVerse();
        message.channel.send(verse);
    }

    if (message.content === '!inspire') {
        const now = new Date();
        const isMorning = now.getHours() < 12;
        
        if (Math.random() > 0.5) {
            const verse = await getQuranVerse();
            message.channel.send(verse);
        } else {
            message.channel.send(getDailyAthkar(isMorning));
        }
    }
});

// UPDATED: Function to send text reminders with auto-delete
function sendPrayerReminderToAllChannels(prayerName, message, shouldPing = false) {
    console.log(`📢 Sending text reminder: ${message} (ping: ${shouldPing})`);
    
    client.guilds.cache.forEach(guild => {
        const prayersChannel = guild.channels.cache.find(channel => 
            channel.name === 'prayers' && 
            channel.isTextBased() &&
            channel.permissionsFor(guild.members.me).has('SendMessages')
        );

        if (prayersChannel) {
            const roleMention = shouldPing ? `<@&1439370924003430441>` : '';
            
            prayersChannel.send(`🕌 **${message}** ${roleMention}\n⏰ ${prayerName} prayer time reminder!`)
                .then(sentMessage => {
                    setTimeout(async () => {
                        try {
                            if (sentMessage.deletable) {
                                await sentMessage.delete();
                                console.log(`🗑️ Auto-deleted reminder: ${message}`);
                            }
                        } catch (error) {
                            console.log('❌ Could not auto-delete message:', error.message);
                        }
                    }, 24 * 60 * 60 * 1000);
                })
                .catch(error => {
                    console.error('❌ Error sending message:', error);
                });
            
            console.log(`✅ Sent reminder to #prayers channel (ping: ${shouldPing}) - will auto-delete in 24h`);
        } else {
            console.log(`❌ #prayers channel not found or no permission`);
        }
    });
}

// ADD: Function to send Athkar with auto-delete at midnight
function sendAthkarWithAutoDelete(messageContent, isMorning = true) {
    const time = isMorning ? "Morning" : "Evening";
    console.log(`🕌 Sending ${time} Athkar with auto-delete at midnight`);
    
    client.guilds.cache.forEach(guild => {
        const prayersChannel = guild.channels.cache.find(channel => 
            channel.name === 'prayers' && 
            channel.isTextBased() &&
            channel.permissionsFor(guild.members.me).has('SendMessages')
        );

        if (prayersChannel) {
            prayersChannel.send(messageContent)
                .then(sentMessage => {
                    // Calculate time until midnight (24:00)
                    const now = new Date();
                    const midnight = new Date();
                    midnight.setHours(24, 0, 0, 0);
                    const timeUntilMidnight = midnight.getTime() - now.getTime();
                    
                    setTimeout(async () => {
                        try {
                            if (sentMessage.deletable) {
                                await sentMessage.delete();
                                console.log(`🗑️ Auto-deleted ${time} Athkar at midnight`);
                            }
                        } catch (error) {
                            console.log(`❌ Could not auto-delete ${time} Athkar:`, error.message);
                        }
                    }, timeUntilMidnight);
                })
                .catch(error => {
                    console.error('❌ Error sending Athkar:', error);
                });
        }
    });
}

// ADD: Schedule daily inspiration with auto-delete
function scheduleDailyInspiration() {
    // Morning Athkar at 6:00 AM - auto-delete at midnight
    cron.schedule('0 6 * * *', () => {
        const morningAthkar = getDailyAthkar(true);
        sendAthkarWithAutoDelete(`🌅 **Good Morning!**\n${morningAthkar}`, true);
    }, {
        timezone: CONFIG.TIMEZONE
    });

    // Evening Athkar at 6:00 PM - auto-delete at midnight
    cron.schedule('0 18 * * *', () => {
        const eveningAthkar = getDailyAthkar(false);
        sendAthkarWithAutoDelete(`🌇 **Good Evening!**\n${eveningAthkar}`, false);
    }, {
        timezone: CONFIG.TIMEZONE
    });

    // Quran verse at 12:00 PM - auto-delete at midnight
    cron.schedule('0 12 * * *', async () => {
        const verse = await getQuranVerse();
        sendAthkarWithAutoDelete(verse);
    }, {
        timezone: CONFIG.TIMEZONE
    });

    console.log('📅 Scheduled daily inspiration with auto-delete at midnight');
}

function scheduleAllTextReminders() {
    scheduledTextReminders.forEach(timeout => clearTimeout(timeout));
    scheduledTextReminders.clear();
    
    console.log('📅 Scheduling text reminders...');
    
    for (const [prayerName, prayerTime] of Object.entries(currentPrayerTimes)) {
        scheduleTextReminders(prayerName, prayerTime);
    }
}

function scheduleTextReminders(prayerName, prayerTimeStr) {
    const [hours, minutes] = prayerTimeStr.split(':').map(Number);
    
    // Use Saudi Arabia timezone explicitly
    const now = new Date();
    const saudiNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Riyadh"}));
    const prayerDate = new Date(saudiNow);
    prayerDate.setHours(hours, minutes, 0, 0);
    
    console.log(`🕒 DEBUG: ${prayerName} at ${prayerTimeStr} -> ${prayerDate.toLocaleString()}`);
    
    if (prayerDate < saudiNow) {
        prayerDate.setDate(prayerDate.getDate() + 1);
    }
    
    const scheduleReminder = (offsetMinutes, message, shouldPing) => {
        const reminderTime = new Date(prayerDate.getTime() + offsetMinutes * 60 * 1000);
        const delay = reminderTime.getTime() - Date.now();
        
        console.log(`🕒 ${prayerName} reminder: ${message} at ${reminderTime.toLocaleString()} (in ${Math.round(delay/1000/60)} minutes)`);
        
        if (delay > 0) {
            const timeout = setTimeout(() => {
                sendPrayerReminderToAllChannels(prayerName, message, shouldPing);
            }, delay);
            
            scheduledTextReminders.set(`${prayerName}_${offsetMinutes}`, timeout);
        }
    };
    
    scheduleReminder(-5, `${prayerName} prayer in 5 minutes`, false);
    scheduleReminder(0, `${prayerName} prayer time now`, true);
    scheduleReminder(10, `${prayerName} prayer was 10 minutes ago`, false);
}

async function fetchPrayerTimes() {
    try {
        console.log('🔄 Fetching accurate prayer times from API...');
        
        const apiUrl = `https://api.aladhan.com/v1/timingsByCity?city=Jeddah&country=Saudi Arabia&method=4`;
        
        const response = await axios.get(apiUrl);
        const timings = response.data.data.timings;
        
        console.log('🔍 DEBUG - Raw API response times:', timings);
        
        currentPrayerTimes = {
            Fajr: timings.Fajr,
            Dhuhr: timings.Dhuhr,
            Asr: timings.Asr,
            Maghrib: timings.Maghrib,
            Isha: timings.Isha
        };
        
        console.log('📅 ACCURATE Prayer times fetched:', currentPrayerTimes);
        return currentPrayerTimes;
        
    } catch (error) {
        console.log('❌ API failed, using fallback times. Error:', error.message);
        currentPrayerTimes = {
            Fajr: '05:17',
            Dhuhr: '12:05',
            Asr: '15:15',
            Maghrib: '17:45',
            Isha: '19:15'
        };
        return currentPrayerTimes;
    }
}

// ADD: Function to send prayer check-in with reactions
async function sendPrayerCheckIn(prayerName) {
    console.log(`✅ Sending check-in for ${prayerName}`);
    
    client.guilds.cache.forEach(async (guild) => {
        const prayersChannel = guild.channels.cache.find(channel => 
            channel.name === 'prayers' && 
            channel.isTextBased() &&
            channel.permissionsFor(guild.members.me).has(['SendMessages', 'AddReactions'])
        );

        if (prayersChannel) {
            try {
                const checkInMessage = await prayersChannel.send(
                    `📋 **${prayerName} Prayer Check-in**\n` +
                    `Did you pray ${prayerName}? React below!\n` +
                    `✅ = I prayed\n⏰ = I'll pray later\n🕌 = Need reminder`
                );
                
                await checkInMessage.react('✅');
                await checkInMessage.react('⏰');
                await checkInMessage.react('🕌');
                
                setTimeout(async () => {
                    try {
                        if (checkInMessage.deletable) {
                            await checkInMessage.delete();
                            console.log(`🗑️ Auto-deleted ${prayerName} check-in`);
                        }
                    } catch (error) {
                        console.log('❌ Could not auto-delete check-in');
                    }
                }, 2 * 60 * 60 * 1000);
                
            } catch (error) {
                console.error('❌ Error sending check-in:', error);
            }
        }
    });
}

// ADD: Track reactions to check-in messages
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    
    if (reaction.message.partial) {
        try {
            await reaction.message.fetch();
        } catch (error) {
            console.error('Failed to fetch message:', error);
            return;
        }
    }
    
    const message = reaction.message;
    
    if (message.content.includes('Prayer Check-in')) {
        const prayerName = message.content.split(' ')[0];
        const emoji = reaction.emoji.name;
        
        console.log(`📊 ${user.username} reacted ${emoji} to ${prayerName} check-in`);
    }
});

client.login(process.env.DISCORD_TOKEN);
