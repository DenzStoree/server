require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

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

/* ====================== FAYU - GET SERVICES ====================== */
app.get(['/api/service', '/api/services'], async (req, res) => {
  try {
    const r = await axios.post(
      'https://www.fayupedia.id/api/services',
      {
        api_id: process.env.FAYU_ID,
        api_key: process.env.FAYU_API
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!r.data.status) return res.status(400).json({ msg: r.data.msg });

    const grouped = {};
    r.data.services.forEach(s => {
      const cat = s.category || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({
        id: s.id,
        name: s.name,
        price: Number(s.price)
      });
    });

    res.json(grouped);
  } catch (e) {
    res.status(500).json({ msg: 'Gagal ambil layanan' });
  }
});

/* ====================== ORDER ====================== */
app.post('/api/order', async (req, res) => {
  const { user, service, target, quantity } = req.body;

  if (!user || !service || !target || !quantity) {
    return res.status(400).json({ msg: 'Parameter kurang' });
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
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!r.data.status) {
      return res.status(400).json(r.data);
    }

    orders.push({
      order_id: r.data.order,
      user,
      service,
      target,
      quantity,
      status: 'PENDING'
    });
    saveOrders();

    res.json({
      status: true,
      order_id: r.data.order,
      msg: 'Order berhasil dibuat'
    });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ msg: 'Order gagal' });
  }
});

/* ====================== RUN SERVER ====================== */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});