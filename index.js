require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');

const app = express();

/* ====================== MIDDLEWARE ====================== */
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/* ====================== DATA ORDER ====================== */
let orders = [];
if (fs.existsSync('./orders.json')) {
  try {
    orders = JSON.parse(fs.readFileSync('./orders.json'));
  } catch (e) {
    orders = [];
  }
}

function saveOrders() {
  fs.writeFileSync('./orders.json', JSON.stringify(orders, null, 2));
}

/* ====================== SALDO INTERNAL ====================== */
let saldo = {};

function addSaldo(user, amount) {
  saldo[user] = (saldo[user] || 0) + amount;
}

function getSaldo(user) {
  return saldo[user] || 0;
}

/* ====================== FAYU - GET SERVICES ====================== */
app.get('/api/services', async (req, res) => {
  try {
    const r = await axios.post(
      'https://www.fayupedia.id/api/services',
      {
        api_id: process.env.FAYU_ID,
        api_key: process.env.FAYU_API
      }
    );

    if (!r.data.status) {
      return res.status(400).json(r.data);
    }

    res.json(r.data);
  } catch (e) {
    console.error('FAYU SERVICES ERROR:', e.message);
    res.status(500).json({
      status: false,
      msg: 'Gagal ambil layanan'
    });
  }
});

/* ====================== FAYU - ORDER ====================== */
app.post('/api/order', async (req, res) => {
  const { user, service, target, quantity } = req.body;

  if (!user || !service || !target || !quantity) {
    return res.status(400).json({
      status: false,
      msg: 'Parameter kurang'
    });
  }

  try {
    const r = await axios.post(
      'https://www.fayupedia.id/api/order',
      {
        api_id: process.env.FAYU_ID,
        api_key: process.env.FAYU_API,
        service,
        target,
        quantity
      }
    );

    if (!r.data.status) {
      return res.status(400).json(r.data);
    }

    const orderId = r.data.order;

    orders.push({
      order_id: orderId,
      user,
      service,
      target,
      quantity,
      status: 'PENDING',
      created_at: new Date().toISOString()
    });

    saveOrders();

    res.json({
      status: true,
      msg: 'Order berhasil dibuat',
      order_id: orderId
    });
  } catch (e) {
    console.error('ORDER ERROR:', e.message);
    res.status(500).json({
      status: false,
      msg: 'Gagal order ke Fayu'
    });
  }
});

/* ====================== CEK ORDER ====================== */
app.get('/api/orders', (req, res) => {
  res.json({
    status: true,
    data: orders
  });
});

/* ====================== SERVER ====================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});