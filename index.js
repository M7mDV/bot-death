try {
    require("dotenv").config();
} catch (e) {
    // dotenv غير مثبت أو مش موجود — مش مشكلة لو الـ env vars متضبطة من لوحة الاستضافة
}

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;

const ALBION_GUILD_ID =
    process.env.ALBION_GUILD_ID || "8jM29kbdTtajlA_Tbm47ww";

const DISCORD_CHANNEL_ID =
    process.env.DISCORD_CHANNEL_ID || "981978625370902538";

// Albion Europe
const ALBION_API =
    "https://gameinfo.albiononline.com/api/gameinfo";

const CHECK_INTERVAL = 15000; // 15 seconds


// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});


// ======================================================
// STATE
// No database.
// Everything resets when the bot restarts.
// ======================================================

let guildMembers = new Set();

let initialized = false;

let latestEventId = null;

let checking = false;


// ======================================================
// HTTP REQUEST
// ======================================================

async function getJSON(url) {

    const response = await fetch(url, {
        headers: {
            "User-Agent": "Albion-Guild-Death-Tracker/1.0"
        }
    });

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status}: ${url}`
        );
    }

    return await response.json();
}


// ======================================================
// GET GUILD MEMBERS
// ======================================================

async function loadGuildMembers() {

    const url =
        `${ALBION_API}/guilds/${ALBION_GUILD_ID}/members`;

    const members = await getJSON(url);

    const ids = new Set();

    for (const member of members) {

        if (member.Id) {
            ids.add(member.Id);
        }
    }

    guildMembers = ids;

    console.log(
        `Loaded ${guildMembers.size} guild members`
    );
}


// ======================================================
// GET RECENT KILL EVENTS
// ======================================================

async function getRecentEvents() {

    const url =
        `${ALBION_API}/events?limit=50&offset=0`;

    return await getJSON(url);
}


// ======================================================
// GET FULL EVENT
// ======================================================

async function getFullEvent(eventId) {

    const url =
        `${ALBION_API}/events/${eventId}`;

    return await getJSON(url);
}


// ======================================================
// ITEM NAME
// ======================================================

function itemName(item) {

    if (!item || !item.Type) {
        return "None";
    }

    return item.Type;
}


// ======================================================
// BUILD TEXT
// ======================================================

function buildText(equipment) {

    if (!equipment) {
        return "No equipment data.";
    }

    return [
        `⚔️ **Weapon:** ${itemName(equipment.MainHand)}`,
        `🛡️ **Off-hand:** ${itemName(equipment.OffHand)}`,
        `🪖 **Helmet:** ${itemName(equipment.Head)}`,
        `🥋 **Armor:** ${itemName(equipment.Armor)}`,
        `👢 **Shoes:** ${itemName(equipment.Shoes)}`,
        `🧥 **Cape:** ${itemName(equipment.Cape)}`,
        `🎒 **Bag:** ${itemName(equipment.Bag)}`,
        `🐎 **Mount:** ${itemName(equipment.Mount)}`,
        `🍖 **Food:** ${itemName(equipment.Food)}`,
        `🧪 **Potion:** ${itemName(equipment.Potion)}`
    ].join("\n");
}


// ======================================================
// CREATE DISCORD EMBED
// ======================================================

function createDeathEmbed(event) {

    const victim = event.Victim || {};
    const killer = event.Killer || {};

    const victimName =
        victim.Name || "Unknown";

    const killerName =
        killer.Name || "Unknown";

    const victimGuild =
        victim.GuildName || "Unknown";

    const killerGuild =
        killer.GuildName || "Unknown";

    const victimIP =
        victim.AverageItemPower
            ? Math.round(victim.AverageItemPower)
            : "Unknown";

    const killerIP =
        killer.AverageItemPower
            ? Math.round(killer.AverageItemPower)
            : "Unknown";

    const fame =
        event.TotalVictimKillFame || 0;

    const participants =
        event.NumberOfParticipants || "Unknown";

    const eventTime =
        event.TimeStamp
            ? new Date(event.TimeStamp)
                .toISOString()
                .replace("T", " ")
                .replace(".000Z", " UTC")
            : "Unknown";

    const embed =
        new EmbedBuilder()
            .setTitle("💀 GUILD MEMBER DEATH")
            .setDescription(
                `**${victimName}** was killed by **${killerName}**`
            )

            .addFields(

                {
                    name: "💀 Victim",
                    value:
                        `**Name:** ${victimName}\n` +
                        `**Guild:** ${victimGuild}\n` +
                        `**IP:** ${victimIP}`,
                    inline: true
                },

                {
                    name: "⚔️ Killer",
                    value:
                        `**Name:** ${killerName}\n` +
                        `**Guild:** ${killerGuild}\n` +
                        `**IP:** ${killerIP}`,
                    inline: true
                },

                {
                    name: "🛡️ Victim Build",
                    value: buildText(victim.Equipment),
                    inline: false
                },

                {
                    name: "📊 Information",
                    value:
                        `**Kill Fame:** ${Number(fame).toLocaleString()}\n` +
                        `**Participants:** ${participants}\n` +
                        `**Time:** ${eventTime}`,
                    inline: false
                }
            )

            .setFooter({
                text:
                    `Albion Europe • Event ${event.EventId || "Unknown"}`
            })

            .setTimestamp();

    return embed;
}


// ======================================================
// SEND DISCORD MESSAGE
// ======================================================

async function sendDeathMessage(event) {

    const channel =
        await client.channels.fetch(
            DISCORD_CHANNEL_ID
        );

    if (!channel) {
        throw new Error(
            "Discord death channel was not found."
        );
    }

    const embed =
        createDeathEmbed(event);

    await channel.send({
        embeds: [embed]
    });

    console.log(
        `💀 Death reported: ${event.Victim?.Name || "Unknown"}`
    );
}


// ======================================================
// PROCESS EVENTS
// ======================================================

async function checkDeaths() {

    if (checking) {
        return;
    }

    checking = true;

    try {

        // Update guild members
        await loadGuildMembers();

        // Get newest events
        const events =
            await getRecentEvents();

        if (
            !Array.isArray(events) ||
            events.length === 0
        ) {
            console.log("No events returned.");
            return;
        }


        // ==========================================
        // FIRST RUN
        // Don't send old deaths.
        // ==========================================

        if (!initialized) {

            latestEventId =
                events[0].EventId;

            initialized = true;

            console.log(
                `Tracker started from event ${latestEventId}`
            );

            return;
        }


        // ==========================================
        // FIND NEW EVENTS
        // ==========================================

        const newEvents = [];

        for (const event of events) {

            if (
                event.EventId === latestEventId
            ) {
                break;
            }

            newEvents.push(event);
        }


        // Oldest → newest
        newEvents.reverse();


        // ==========================================
        // PROCESS NEW EVENTS
        // ==========================================

        for (const event of newEvents) {

            const victimId =
                event.Victim?.Id;

            if (!victimId) {
                continue;
            }


            // Is victim a member of our Albion guild?
            if (
                !guildMembers.has(victimId)
            ) {
                continue;
            }


            console.log(
                `Guild death detected: ${event.Victim?.Name}`
            );


            try {

                const fullEvent =
                    await getFullEvent(
                        event.EventId
                    );

                await sendDeathMessage(
                    fullEvent
                );

            } catch (error) {

                console.error(
                    `Could not process event ${event.EventId}:`,
                    error.message
                );
            }
        }


        // Update latest event
        latestEventId =
            events[0].EventId;

    } catch (error) {

        console.error(
            "Tracker error:",
            error.message
        );

    } finally {

        checking = false;
    }
}


// ======================================================
// BOT READY
// ======================================================

client.once("ready", async () => {

    console.log("==============================");
    console.log("Albion Death Tracker ONLINE");
    console.log("==============================");

    console.log(
        `Discord Bot: ${client.user.tag}`
    );

    console.log(
        `Albion Guild: ${ALBION_GUILD_ID}`
    );

    console.log(
        `Discord Channel: ${DISCORD_CHANNEL_ID}`
    );

    console.log(
        `Checking every ${CHECK_INTERVAL / 1000} seconds`
    );

    console.log("==============================");


    // Start immediately
    await checkDeaths();


    // Continue forever
    setInterval(
        checkDeaths,
        CHECK_INTERVAL
    );
});


// ======================================================
// ERROR HANDLING
// ======================================================

process.on(
    "unhandledRejection",
    error => {
        console.error(
            "Unhandled Promise Rejection:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {
        console.error(
            "Uncaught Exception:",
            error
        );
    }
);


// ======================================================
// LOGIN
// ======================================================

if (!TOKEN) {

    console.error(
        "❌ DISCORD_TOKEN is missing!"
    );

    process.exit(1);
}

client.login(TOKEN);