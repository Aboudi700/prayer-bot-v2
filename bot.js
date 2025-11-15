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

client.once('ready', async () => {
    console.log(`✅ Bot online: ${client.user.tag}`);
    client.user.setActivity('Prayer Reminders', { type: ActivityType.Listening });
    await fetchPrayerTimes();
    scheduleAllTextReminders();
    console.log('🤖 Bot ready with text reminders to #prayers channel!');
});

// Simple command handler
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

    if (message.content === '!test') {
        message.channel.send('✅ Bot is working!');
    }

    // NEW: Test auto-send in 5 seconds
    if (message.content === '!autosend5') {
        message.channel.send('⏰ Test message will be sent to #prayers channel in 5 seconds...');
        
        setTimeout(() => {
            // Find #prayers channel and send test there
            const prayersChannel = message.guild.channels.cache.find(channel => 
                channel.name === 'prayers' && channel.isTextBased()
            );
            
            if (prayersChannel) {
                prayersChannel.send('🔔 **TEST REMINDER** <@&1439370924003430441>\nThis is a test of the auto-send feature!');
                message.channel.send('✅ Test message sent to #prayers channel!');
            } else {
                message.channel.send('❌ #prayers channel not found!');
            }
        }, 5000);
    }

    // NEW: Test prayer reminder now
    if (message.content === '!testreminder') {
        message.channel.send('🔄 Testing prayer reminder system...');
        sendPrayerReminderToAllChannels('Fajr', 'TEST: Prayer reminder working!');
    }

    if (message.content === '!refreshtimes') {
        await fetchPrayerTimes();
        scheduleAllTextReminders(); // Reschedule with new times
        message.channel.send('🔄 Prayer times refreshed and reminders rescheduled!');
    }
});

// UPDATED: Function to send text reminders only to #prayers channel
function sendPrayerReminderToAllChannels(prayerName, message) {
    console.log(`📢 Sending text reminder: ${message}`);
    
    client.guilds.cache.forEach(guild => {
        // Find ONLY the #prayers channel
        const prayersChannel = guild.channels.cache.find(channel => 
            channel.name === 'prayers' && 
            channel.isTextBased() &&
            channel.permissionsFor(guild.members.me).has('SendMessages')
        );

        if (prayersChannel) {
            // USING YOUR ROLE ID: 1439370924003430441
            const roleMention = guild.roles.cache.get("1439370924003430441");
            const mention = roleMention ? `<@&${roleMention.id}>` : '@everyone';
            
            prayersChannel.send(`🕌 **${message}** ${mention}\n⏰ ${prayerName} prayer time reminder!`);
            console.log(`✅ Sent reminder to #prayers channel`);
        } else {
            console.log(`❌ #prayers channel not found or no permission`);
        }
    });
}

// NEW: Schedule text reminders for all prayers
function scheduleAllTextReminders() {
    // Clear existing reminders
    scheduledTextReminders.forEach(timeout => clearTimeout(timeout));
    scheduledTextReminders.clear();
    
    console.log('📅 Scheduling text reminders...');
    
    for (const [prayerName, prayerTime] of Object.entries(currentPrayerTimes)) {
        scheduleTextReminders(prayerName, prayerTime);
    }
}

// NEW: Schedule the three text reminders for each prayer
function scheduleTextReminders(prayerName, prayerTimeStr) {
    const [hours, minutes] = prayerTimeStr.split(':').map(Number);
    const now = new Date();
    const prayerDate = new Date();
    prayerDate.setHours(hours, minutes, 0, 0);
    
    // If prayer time has already passed today, schedule for tomorrow
    if (prayerDate < now) {
        prayerDate.setDate(prayerDate.getDate() + 1);
    }
    
    // Helper function to schedule a single text reminder
    const scheduleReminder = (offsetMinutes, message) => {
        const reminderTime = new Date(prayerDate.getTime() + offsetMinutes * 60 * 1000);
        const delay = reminderTime.getTime() - Date.now();
        
        if (delay > 0) {
            const timeout = setTimeout(() => {
                sendPrayerReminderToAllChannels(prayerName, message);
            }, delay);
            
            scheduledTextReminders.set(`${prayerName}_${offsetMinutes}`, timeout);
            console.log(`📅 Scheduled ${prayerName} text reminder: ${message} at ${reminderTime.toLocaleString()}`);
        }
    };
    
    // Schedule all three text reminders
    scheduleReminder(-5, `${prayerName} prayer in 5 minutes`);
    scheduleReminder(0, `${prayerName} prayer time now`);
    scheduleReminder(10, `${prayerName} prayer was 10 minutes ago`);
}

async function fetchPrayerTimes() {
    try {
        console.log('🔄 Fetching accurate prayer times from API...');
        
        const apiUrl = `https://api.aladhan.com/v1/timingsByCity?city=Jeddah&country=Saudi Arabia&method=4`;
        
        const response = await axios.get(apiUrl);
        const timings = response.data.data.timings;
        
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

client.login(process.env.DISCORD_TOKEN);
