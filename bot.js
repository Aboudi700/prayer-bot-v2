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
        let response = `🕌 Accurate Prayer Times for ${CONFIG.CITY}:\n`;
        for (const [prayer, time] of Object.entries(currentPrayerTimes)) {
            response += `**${prayer}**: ${time}\n`;
        }
        message.channel.send(response);
    }

    if (message.content === '!test') {
        message.channel.send('✅ Bot is working!');
    }

    if (message.content === '!testvc') {
        console.log('🔄 Testing voice channel join...');
        const voiceChannel = message.member?.voice.channel;
        
        if (!voiceChannel) {
            return message.channel.send('❌ Please join a voice channel first!');
        }
        
        console.log(`🎯 Attempting to join: ${voiceChannel.name} (${voiceChannel.id})`);
        message.channel.send(`🎯 Attempting to join: **${voiceChannel.name}**`);
        
        try {
            // Join voice channel
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });
            
            console.log('✅ Voice connection created');
            message.channel.send('✅ Voice connection created!');
            
            // Listen for connection events
            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log('🎉 SUCCESS: Bot is now in voice channel!');
                message.channel.send('🎉 **SUCCESS: Bot is now in voice channel!**');
            });
            
            connection.on(VoiceConnectionStatus.Disconnected, () => {
                console.log('🔌 Bot disconnected from voice channel');
                message.channel.send('🔌 Bot disconnected from voice channel');
            });
            
            connection.on('error', (error) => {
                console.error('❌ Voice connection error:', error);
                message.channel.send('❌ Voice connection error: ' + error.message);
            });
            
            // Stay for 10 seconds so you can definitely see it
            setTimeout(() => {
                console.log('🔄 Leaving voice channel...');
                connection.destroy();
                message.channel.send('✅ Bot left voice channel');
            }, 10000); // 10 seconds
            
        } catch (error) {
            console.error('❌ Voice channel error:', error);
            message.channel.send('❌ Failed to join voice channel: ' + error.message);
        }
    }

    if (message.content === '!refreshtimes') {
        await fetchPrayerTimes();
        message.channel.send('🔄 Prayer times refreshed from API!');
    }
});

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
