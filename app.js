require("dotenv").config(); // โหลด environment variables จาก .env file
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const mongoose = require('mongoose');

// เชื่อมต่อกับ MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Failed to connect to MongoDB:', err));

// สร้าง Schema และ Model สำหรับบันทึกห้อง
const roomSchema = new mongoose.Schema({
    channelId: String,
    guildId: String,
    createdAt: { type: Date, default: Date.now },
});

const Room = mongoose.model('Room', roomSchema);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
    ],
});

const categoryId = '1326556877533876234'; // หมวดหมู่ของห้อง VC
const trackChannelId = '1351063389958438944'; // Channel ที่ต้องการติดตาม

const roleIdCanJoin = ['1326557080227676161']; // Role ที่สามารถเข้าห้องได้
const roleIdCanSpeak = ['1333874999928295445', '1326557938873012306','1351066131179503626']; // Role ที่สามารถพูดในห้องได้
const roleIdCanSendMessage = ['1326557511326896241','1333873705998356604']; // Role ที่สามารถส่งข้อความในห้องได้
const userLimit = 20; // จำกัดจำนวนผู้ใช้ในห้อง
const roomType = 2; // ประเภทของห้องคือ Voice channel
const roomName = '🟢・Live '; // ชื่อของห้อง

client.once('ready', () => {
    console.log('🟢 Bot is online!');
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    // ตรวจสอบว่า user เข้าห้อง VC ที่ต้องการติดตาม
    if (newState.channelId === trackChannelId && !oldState.channelId) {
        try {
            // สร้างห้อง VC ใหม่
            const guild = await client.guilds.fetch(newState.guild.id);
            const category = await guild.channels.fetch(categoryId);

            const newChannel = await guild.channels.create({
                name: `${roomName}${newState.member.displayName}`, // ชื่อของห้อง
                type: roomType, // ประเภทของห้อง
                parent: category, // ตั้งห้องในหมวดหมู่ที่กำหนด
                userLimit: userLimit, // จำกัดจำนวนผู้ใช้ในห้อง
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak, PermissionsBitField.Flags.SendMessages], // ไม่ให้เชื่อมต่อ, พูด, และส่งข้อความ
                    },
                    ...roleIdCanSendMessage.map(roleId => ({
                        id: roleId,
                        allow: [PermissionsBitField.Flags.SendMessages], // ให้ส่งข้อความในห้อง
                    })),
                    ...roleIdCanJoin.map(roleId => ({
                        id: roleId,
                        allow: [PermissionsBitField.Flags.ViewChannel], // ใช้ PermissionFlags สำหรับ ViewChannel
                        deny: [PermissionsBitField.Flags.Speak], // ไม่ให้พูดในห้อง
                    })),
                    ...roleIdCanSpeak.map(roleId => ({
                        id: roleId,
                        allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak], // ใช้ PermissionFlags สำหรับ Connect และ Speak
                    })),
                ],
            });

            // บันทึก ID ของห้องที่สร้างลงใน MongoDB
            const newRoom = new Room({
                channelId: newChannel.id,
                guildId: newState.guild.id,
            });

            await newRoom.save();

            // ย้าย user ไปที่ห้องใหม่
            await newState.member.voice.setChannel(newChannel);

            console.log(`Created new VC room: ${newChannel.name}`);

            // ส่งข้อความเข้าไปในห้องใหม่ โดยเท็คเจ้าของห้อง @ชื่อ
            await newChannel.send(`**${newChannel.name}** ได้ถูกสร้างขึ้นโดย @${newState.member.displayName} เรียบร้อยแล้ว!`);
            //บอกว่าใครสามารถเข้าห้องได้ โดยเปลี่ยนจาก RoleID ให้เป็น RoleName
            await newChannel.send(`🟢 **สามารถเข้าห้องได้: ** ${roleIdCanJoin.map(roleId => guild.roles.cache.get(roleId).name).join(', ')}`);
            //บอกว่าใครสามารถพูดในห้องได้ โดยเปลี่ยนจาก RoleID ให้เป็น RoleName
            await newChannel.send(`🟢 **สามารถพูดในห้องได้: ** ${roleIdCanSpeak.map(roleId => guild.roles.cache.get(roleId).name).join(', ')}`);
            //บอกว่าใครสามารถส่งข้อความในห้องได้ โดยเปลี่ยนจาก RoleID ให้เป็น RoleName
            await newChannel.send(`🟢 **สามารถส่งข้อความในห้องได้: ** ${roleIdCanSendMessage.map(roleId => guild.roles.cache.get(roleId).name).join(', ')}`);
            //บอกว่าห้องนี้มีจำนวนคนที่สามารถอยู่ได้
            await newChannel.send(`🟢 **จำกัดจำนวนคนที่สามารถอยู่ได้: ** ${userLimit} คน`);

            // alert ข้อความ Tag everyone ไปที่ห้อง ID : 1326586294351954001 ว่ามีห้องใหม่ถูกสร้างขึ้น
            const alertChannel = await guild.channels.fetch('1326586294351954001');
            //Room ที่ถูกสร้างขึ้น โดยการสร้างลิ้งค์ไปห้องนั้นๆ
            await alertChannel.send(`${newState.member.displayName} ได้ทำการไลฟ์สตรีมแล้วที่ Tiktok ห้องพูดคุย ${newChannel.toString()} @everyone`);
        } catch (error) {
            console.error('Error creating VC room:', error);
        }
    }

    // ตรวจสอบห้องที่ถูกสร้างโดย bot เมื่อไม่มีคนในห้องแล้ว
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const room = await Room.findOne({ channelId: oldState.channelId });

        if (room && newState.channelId !== oldState.channelId) {
            try {
                const channel = await client.channels.fetch(oldState.channelId);

                if (channel.members.size === 0) {
                    console.log(`Deleting VC room: ${channel.name}`);
                    // ลบห้องถ้าไม่มีคนอยู่ในห้อง
                    await channel.delete();

                    // ลบห้องที่ถูกบันทึกใน MongoDB
                    await Room.deleteOne({ channelId: channel.id });
                    console.log(`Deleted room ${channel.name} from database`);
                }
            } catch (error) {
                console.error('Error deleting VC room:', error);
            }
        }
    }
});


// เข้าสู่ระบบ Discord โดยใช้ bot token จาก .env file
client.login(process.env.DISCORD_BOT_TOKEN);
