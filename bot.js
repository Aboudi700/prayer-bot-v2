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
    console.log('🤖 Bot ready - reminders auto-delete after 24 hours!');
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

    if (message.content === '!autosend5') {
        message.channel.send('⏰ Test message will be sent to #prayers channel in 5 seconds...');
        
        setTimeout(() => {
            const prayersChannel = message.guild.channels.cache.find(channel => 
                channel.name === 'prayers' && channel.isTextBased()
            );
            
            if (prayersChannel) {
                prayersChannel.send('🔔 **TEST REMINDER** <@&1439370924003430441>\nThis is a test of the auto-send feature!')
                    .then(sentMessage => {
                        // Auto-delete test message after 1 minute for testing
                        setTimeout(async () => {
                            try {
                                if (sentMessage.deletable) {
                                    await sentMessage.delete();
                                    console.log('🗑️ Auto-deleted test message');
                                }
                            } catch (error) {
                                console.log('❌ Could not auto-delete test message');
                            }
                        }, 60000); // 1 minute for testing
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
            // ONLY PING IF shouldPing is true
            const roleMention = shouldPing ? `<@&1439370924003430441>` : '';
            
            // Send message and auto-delete after 24 hours
            prayersChannel.send(`🕌 **${message}** ${roleMention}\n⏰ ${prayerName} prayer time reminder!`)
                .then(sentMessage => {
                    // Auto-delete after 24 hours (86400000 ms)
                    setTimeout(async () => {
                        try {
                            if (sentMessage.deletable) {
                                await sentMessage.delete();
                                console.log(`🗑️ Auto-deleted reminder: ${message}`);
                            }
                        } catch (error) {
                            console.log('❌ Could not auto-delete message:', error.message);
                        }
                    }, 24 * 60 * 60 * 1000); // 24 hours
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
    const now = new Date();
    const prayerDate = new Date();
    prayerDate.setHours(hours, minutes, 0, 0);
    
    if (prayerDate < now) {
        prayerDate.setDate(prayerDate.getDate() + 1);
    }
    
    const scheduleReminder = (offsetMinutes, message, shouldPing) => {
        const reminderTime = new Date(prayerDate.getTime() + offsetMinutes * 60 * 1000);
        const delay = reminderTime.getTime() - Date.now();
        
        if (delay > 0) {
            const timeout = setTimeout(() => {
                sendPrayerReminderToAllChannels(prayerName, message, shouldPing);
            }, delay);
            
            scheduledTextReminders.set(`${prayerName}_${offsetMinutes}`, timeout);
            console.log(`📅 Scheduled ${prayerName} text reminder: ${message} at ${reminderTime.toLocaleString()}`);
        }
    };
    
    // ONLY PING AT EXACT PRAYER TIME
    scheduleReminder(-5, `${prayerName} prayer in 5 minutes`, false); // No ping
    scheduleReminder(0, `${prayerName} prayer time now`, true);      // PING HERE
    scheduleReminder(10, `${prayerName} prayer was 10 minutes ago`, false); // No ping
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
