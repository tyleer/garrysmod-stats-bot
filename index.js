const { Client, Intents, MessageEmbed } = require('discord.js');
const Gamedig = require('gamedig');
const config = require('./config.json');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');

const client = new Client({
    intents: [Intents.FLAGS.GUILDS]
});

// Komutları tanımlıyoruz
const commands = [
    new SlashCommandBuilder()
        .setName('sunucu')
        .setDescription('Sunucu istatistiğini gönderir'),
    new SlashCommandBuilder()
        .setName('oyuncular')
        .setDescription('Sunucuda oynayan oyuncuları gösterir'),
]
    .map(command => command.toJSON());


if (config.enableFeedbackCommands) {
    commands.push(
        new SlashCommandBuilder()
            .setName('öneri')
            .setDescription('Bir öneri bildirir')
            .addStringOption(option => option.setName('mesaj').setDescription('Öneri mesajınız').setRequired(true)),
        new SlashCommandBuilder()
            .setName('hata')
            .setDescription('Bir hata bildirir')
            .addStringOption(option => option.setName('mesaj').setDescription('Hata mesajınız').setRequired(true))
    );
}

const rest = new REST({ version: '9' }).setToken(config.token);

// Bot hazır olduğunda çalışacak kod
client.once('ready', async () => {
    console.log(`Girdi: ${client.user.tag}`);

    // Sunucu sorgulama ve kanal güncelleme işlemi
    setInterval(() => {
        Gamedig.query({
            type: 'garrysmod',
            host: config.server_ip,
            port: config.server_port
        }).then((state) => {
            const channel = client.channels.cache.get(config.playerChannel);
            if (channel) {
                channel.setName(`Oyuncular: ${state.raw.numplayers}/${state.maxplayers}`);
            }
            client.user.setActivity(`Oyuncular: ${state.raw.numplayers}/${state.maxplayers}`);
            console.log("Oynuyor ve oyuncular kanalı güncellendi.");
        }).catch(err => {
            console.log(err);
        });
    }, 25000);

    // Komutları Discord API'sine yüklüyoruz
    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, config.guildId),
            { body: commands },
        );
        console.log('Uygulama komutları başarıyla kuruldu.');
    } catch (error) {
        console.error(error);
    }
});

// Komutlar
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'sunucu') {
        Gamedig.query({
            type: 'garrysmod',
            host: config.server_ip,
            port: config.server_port
        }).then(async (state) => {
            console.log(state);
            const embed = new MessageEmbed()
                .setTitle(state.name)
                .setColor('BLUE')
                .addFields(
                    { name: 'Harita:', value: state.map ? state.map : 'Bulunamadı', inline: true },
                    { name: 'Oyun tipi:', value: state.raw.gametype ? state.raw.gametype : 'Bulunamadı', inline: true },
                    { name: 'Geliştirici:', value: state.raw.Developer || 'Bulunamadı', inline: true },
                    { name: 'Oyuncular:', value: `${state.raw.numplayers || '0'}/${state.maxplayers}`, inline: true },
                    { name: 'Ping:', value: `${state.ping}ms`, inline: true },
                    { name: 'IP:', value: state.connect, inline: true }
                )
                .setTimestamp()
                .setFooter(`${interaction.user.username} tarafından istendi`, interaction.user.avatarURL());

            await interaction.reply({ embeds: [embed] });
        }).catch(err => {
            console.log(err);
        });
    } else if (commandName === 'oyuncular') {
        Gamedig.query({
            type: 'garrysmod',
            host: config.server_ip,
            port: config.server_port
        }).then(async (state) => {
            console.log(state);

            const playerNames = state.players.map(player => player.name).join('\n') || '0';
            const totalPlayers = state.players.length;

            const embed = new MessageEmbed()
                .setTitle('Sunucudaki Oyuncular')
                .setColor('GREEN')
                .setDescription(playerNames)
                .addField('Toplam Oyuncu Sayısı:', totalPlayers.toString(), false)
                .setTimestamp()
                .setFooter(`${interaction.user.username} tarafından istendi`, interaction.user.avatarURL());

            await interaction.reply({ embeds: [embed] });
        }).catch(err => {
            console.log(err);
        });
    }
});

//öneri hata sistemi. Çalışmasını istemiyorsanız/istiyorsanız config.json dosyasında ilgili kısma göz atınız.
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (config.enableFeedbackCommands) {
        const feedbackChannel = client.channels.cache.get(config.feedbackChannel);

        if (!feedbackChannel) {
            return interaction.reply({ content: 'Öneri/hata bildirim kanalı bulunamadı.', ephemeral: true });
        }

        const message = options.getString('mesaj');

        let embed;
        if (commandName === 'öneri') {
            embed = new MessageEmbed()
                .setColor('BLUE')
                .setTitle('Yeni Öneri')
                .setDescription(message)
                .setFooter(`Öneren: ${interaction.user.username}`, interaction.user.avatarURL())
                .setTimestamp();
        } else if (commandName === 'hata') {
            embed = new MessageEmbed()
                .setColor('RED')
                .setTitle('Yeni Hata Bildirimi')
                .setDescription(message)
                .setFooter(`Bildiren: ${interaction.user.username}`, interaction.user.avatarURL())
                .setTimestamp();
        }

        try {
            await feedbackChannel.send({ embeds: [embed] });
            await interaction.reply({ content: 'Mesajınız başarıyla gönderildi.', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Mesaj gönderilirken bir hata oluştu.', ephemeral: true });
        }
    }
});

// Botu giriş yapıyoruz
client.login(config.token);