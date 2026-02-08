require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// load orders dari file
let orders = [];
if (fs.existsSync('./orders.json')) {
  try {
    orders = JSON.parse(fs.readFileSync('./orders.json'));
  } catch (e) {
    console.error("Gagal load orders.json:", e.message);
  }
}
function saveOrders() {
  fs.writeFileSync('./orders.json', JSON.stringify(orders, null, 2));
}

// saldo sementara di memory
let saldo = {};
function addSaldo(user, amount) {
  saldo[user] = (saldo[user] || 0) + amount;
}

// ===== Fayupedia GET Services =====
app.get('/api/services', async (req, res) => {
  try {
    const r = await axios.post('https://www.fayupedia.id/api/services', {
      api_id: process.env.FAYU_ID,
      api_key: process.env.FAYU_API
    });
    
    if (!r.data.status) return res.status(400).json({ status:false, msg:r.data.msg });

    // grouping berdasarkan category
    const grouped = {};
    (r.data.services || []).forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push({
        id: s.id,
        name: s.name,
        price: Number(s.price),
        min: s.min,
        max: s.max,
        refill: s.refill,
        description: s.description
      });
    });

    return res.json({ status:true, services: grouped });
  } catch (e) {
    console.error("FAYU GET services error:", e.message);
    return res.status(500).json({ status:false, msg:'Gagal ambil layanan', err:e.message });
  }
});

// ===== Order + Generate QRIS =====
app.post('/api/order', async (req, res) => {
  const { user, service, target, quantity } = req.body;
  if (!user || !service || !target || !quantity)
    return res.status(400).json({ status:false, msg:'Parameter kurang' });

  try {
    const r = await axios.post('https://www.fayupedia.id/api/order', {
      api_id: process.env.FAYU_ID,
      api_key: process.env.FAYU_API,
      service, target, quantity
    });

    if (!r.data.status) 
      return res.status(400).json({ status:false, msg:r.data.msg });

    const orderId = r.data.order;

    const totalPrice = r.data.services?.price || r.data.price || 0;

    const qrisRes = await axios.post(
      'https://app.pakasir.com/api/transactioncreate/qris',
      {
        project: process.env.PAKASIR_PROJECT,
        order_id: orderId,
        amount: totalPrice * quantity,
        api_key: process.env.PAKASIR_API_KEY
      },
      { headers:{ "Content-Type":"application/json"} }
    );

    const qris = qrisRes.data.payment;

    orders.push({
      order_id: orderId,
      user, service, target, quantity,
      status: 'PENDING',
      amount: totalPrice * quantity
    });
    saveOrders();

    return res.json({
      status:true,
      order_id: orderId,
      qris,
      detail:`Service:${service}, Target:${target}, Qty:${quantity}`
    });

  } catch (e) {
    console.error("Order error:", e.message);
    return res.status(500).json({ status:false, msg:'Gagal order', err:e.message });
  }
});

// ===== Pakasir Webhook =====
app.post('/pakasir-webhook', (req, res) => {
  const payment = req.body;
  if (!payment.order_id || !payment.status) return res.sendStatus(200);

  const order = orders.find(o => o.order_id == payment.order_id);
  if (!order) return res.sendStatus(200);

  if (["PAID","completed"].includes(payment.status) && order.status !== "PAID") {
    order.status = "PAID";
    order.paid_at = new Date().toISOString();
    addSaldo(order.user, order.amount);
    saveOrders();
    console.log(`Order PAID: ${order.order_id}, user ${order.user} +${order.amount}`);
  }

  return res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://0.0.0.0:${PORT}`));      { timeout: 15000 }
    );

    if (!r.data || !r.data.status) {
      return res.status(400).json({
        msg: r.data?.msg || 'Response FAYU tidak valid'
      });
    }

    const grouped = {};
    r.data.services.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push({
        id: s.id,
        name: s.name,
        price: Number(s.price),
        min: s.min,
        max: s.max,
        refill: s.refill,
        description: s.description
      });
    });

    res.json(grouped);
  } catch (e) {
    console.error('FAYU SERVICES ERROR:', e.message);
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
        api_id: Number(process.env.FAYU_ID),
        api_key: process.env.FAYU_API,
        service,
        target,
        quantity
      },
      { timeout: 15000 }
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
    res.json({ status: true, order_id: r.data.order });
  } catch (e) {
    console.error('ORDER ERROR:', e.message);
    res.status(500).json({ msg: 'Gagal order' });
  }
});

/* ====================== START ====================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
