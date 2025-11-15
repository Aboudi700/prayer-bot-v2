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

client.once('ready', async () => {
    console.log(`✅ Bot online: ${client.user.tag}`);
    client.user.setActivity('Prayer Reminders', { type: ActivityType.Listening });
    await fetchPrayerTimes();
    console.log('🤖 Bot ready!');
});

// Simple command handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    console.log(`💬 Message: ${message.content}`);

    if (message.content === '!prayertimes') {
        let response = `🕌 Prayer Times for ${CONFIG.CITY}:\n`;
        for (const [prayer, time] of Object.entries(currentPrayerTimes)) {
            response += `**${prayer}**: ${time}\n`;
        }
        message.channel.send(response);
    }

    if (message.content === '!test') {
        message.channel.send('✅ Bot is working!');
    }

    // SIMPLIFIED: Test voice channel command
    if (message.content === '!testvc') {
        console.log('Testing voice channel join...');
        const voiceChannel = message.member?.voice.channel;
        
        if (!voiceChannel) {
            return message.channel.send('❌ Please join a voice channel first!');
        }
        
        try {
            // Simple voice connection test
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });
            
            console.log('✅ Successfully joined voice channel');
            message.channel.send('✅ Bot joined voice channel!');
            
            // Leave after 2 seconds
            setTimeout(() => {
                connection.destroy();
                console.log('✅ Left voice channel');
                message.channel.send('✅ Bot left voice channel - Voice features working!');
            }, 2000);
            
        } catch (error) {
            console.error('❌ Voice channel error:', error);
            message.channel.send('❌ Failed to join voice channel: ' + error.message);
        }
    }
});

async function fetchPrayerTimes() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const [year, month, day] = today.split('-');
        
        const apiUrl = `http://api.aladhan.com/v1/timings/${day}-${month}-${year}?city=Jeddah&country=Saudi Arabia&method=4`;
        
        const response = await axios.get(apiUrl);
        const timings = response.data.data.timings;
        
        currentPrayerTimes = {
            fajr: timings.Fajr,
            dhuhr: timings.Dhuhr,
            asr: timings.Asr,
            maghrib: timings.Maghrib,
            isha: timings.Isha
        };
        
        console.log('📅 Prayer times:', currentPrayerTimes);
    } catch (error) {
        console.log('❌ API failed, using fallback times');
        currentPrayerTimes = {
            fajr: '05:00',
            dhuhr: '12:00',
            asr: '15:00',
            maghrib: '18:00',
            isha: '19:30'
        };
    }
}

client.login(process.env.DISCORD_TOKEN);
