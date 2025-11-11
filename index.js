const axios = require('axios');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
  authStrategy: new LocalAuth(),
});

const userSessions = new Map();

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('Scan QR');
});

client.on('ready', () => {
  console.log('✅ Client is ready!');
});

client.on('message_create', async (message) => {
  const body = message.body.toLowerCase();

  const userPhone = message.author || message.from;

  if (body === 'q' || body === 'qué' || body === 'que') {
    await client.sendMessage(message.from, 'sadilla');
    return;
  }

  if (body.startsWith('/register ')) {
    const parts = message.body.split(' ');
    if (parts.length === 2) {
      const [_, password] = parts;
      try {
        const register = await axios.post('http://localhost:3000/api/register', {
          phoneNumber: userPhone,
          password: password
        });
        await client.sendMessage(message.from, `User registered successfully!\nNow you can login with: /login <password>`);
      } catch (error) {
        console.error('Registration error:', error.message);
        const errorMsg = error.response?.data?.error || 'Registration failed';
        await client.sendMessage(message.from, `${errorMsg}`);
      }
    } else {
      await client.sendMessage(message.from, 'Usage: /register <password>');
    }
    return;
  }

  if (body.startsWith('/login ')) {
    const parts = message.body.split(' ');
    if (parts.length === 2) {
      const [_, password] = parts;
      try {
        const login = await axios.post('http://localhost:3000/api/login', {
          phoneNumber: userPhone,
          password: password
        });

        console.log('Login response:', JSON.stringify(login.data, null, 2));
        const token = login.data.token;
        userSessions.set(userPhone, {
          token: token,
          phoneNumber: login.data.user.phoneNumber,
          userId: login.data.user.id
        });
        await client.sendMessage(message.from, `Login successful!\nWelcome back!\n\nWant some coffee? Type "coffee"`);
        const welcomeMedia = MessageMedia.fromFilePath('./img/coffee.png');
        await client.sendMessage(message.from, welcomeMedia);

        console.log(`User ${userPhone} logged in successfully`);
      } catch (error) {
        console.error('Login error details:', error.response?.data || error.message);
        await client.sendMessage(message.from, 'Login failed. Check your password.');
      }
    } else {
      await client.sendMessage(message.from, 'Usage: /login <password>');
    }
    return;
  }

  if (body === '/logout') {
    if (userSessions.has(userPhone)) {
      const session = userSessions.get(userPhone);
      userSessions.delete(userPhone);

      const byeMedia = MessageMedia.fromFilePath('./img/milocopaafuera.jpg');
      await client.sendMessage(message.from, byeMedia);
      await client.sendMessage(message.from, `Goodbye! You have been logged out.\n\nCome back soon! ☕`);
    } else {
      await client.sendMessage(message.from, '⚠️ You are not logged in.');
    }
    return;
  }

  if (body === '/coffee') {
    if (!userSessions.has(userPhone)) {
      await client.sendMessage(message.from, '🔒 You need to register first!\n\nUse: /register <password>');
      return;
    }

    const session = userSessions.get(userPhone);

    try {
      const apiResponse = await axios.get('https://coffee.alexflipnote.dev/random.json');
      const coffeeUrl = apiResponse.data.file;
      const imageResponse = await axios.get(coffeeUrl, { responseType: 'arraybuffer' });
      const imageBase64 = Buffer.from(imageResponse.data, 'binary').toString('base64');
      const imageMedia = new MessageMedia('image/jpeg', imageBase64, 'coffee.jpg');
      await client.sendMessage(message.from, imageMedia, { sendMediaAsSticker: true });

      console.log(`☕ Sent coffee sticker to: ${userPhone}`);
    } catch (error) {
      console.error('Error fetching coffee image:', error.message);
      await client.sendMessage(message.from, 'Try again later.');
    }
    return;
  }
});

client.initialize();

setInterval(() => {
  console.log(`Active sessions: ${userSessions.size}`);
}, 3600000);
