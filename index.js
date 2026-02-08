const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// ===== DATA =====
let orders = [];
let config = {
    dns: "https://denzpanelnya.turbohost.my.id",
    fayu_id: "",
    fayu_api: "",
    project: "",
    pakasir_api: ""
};

// ===== LOAD CONFIG DARI GITHUB =====
async function loadConfig() {
    try {
        const res = await axios.get(
            'https://raw.githubusercontent.com/DenzStoree/denzofc/main/config.json'
        );

        console.log("RAW config data:", res.data);

        let data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;

        if (data && data.apikey) {
            config = {
                dns: data.apikey.dns || config.dns,
                fayu_id: data.apikey.fayu_id || "",
                fayu_api: data.apikey.fayu_api || "",
                project: data.apikey.project || "",
                pakasir_api: data.apikey.pakasir_api || ""
            };
            console.log("Config loaded from GitHub:", config);
        } else {
            console.warn("Config from GitHub is empty, using defaults.");
        }
    } catch (e) {
        console.error("Failed to load config from GitHub:", e.message);
        console.warn("Using default config:", config);
    }
}

// Load config awal
loadConfig();

// ===== TEST ORDER VIA GET (untuk browser) =====
app.get('/order/test', (req, res) => {
    // contoh data
    const sampleOrder = {
        order_id: "ORD" + Date.now(),
        service_id: "service123",
        target: "user_test",
        qty: 1,
        total: 10000,
        status: "pending",
        created_at: new Date().toISOString()
    };

    res.json(sampleOrder);
});

// ===== CREATE ORDER =====
app.post('/order/create', async (req, res) => {
    try {
        const { service_id, target, qty, total } = req.body;
        if (!service_id || !target || !qty || !total) {
            return res.status(400).json({ error: "Invalid order data" });
        }

        const order_id = "ORD" + Date.now();

        // ===== REQUEST QRIS PAKASIR =====
        let qrisNumber = "dummy_qris"; // fallback aman
        try {
            const pakasirResp = await axios.post('https://app.pakasir.com/api/transactioncreate/qris', {
                project: config.project,
                order_id,
                amount: total,
                api_key: config.pakasir_api
            });
            qrisNumber = pakasirResp.data.payment?.payment_number || qrisNumber;
        } catch (e) {
            console.error("Pakasir request failed:", e.message);
        }

        orders.push({
            order_id,
            service_id,
            target,
            qty,
            total,
            status: "pending",
            created_at: new Date().toISOString()
        });

        res.json({ order_id, qris: qrisNumber });

    } catch (e) {
        console.error("Order create error:", e.message);
        res.status(500).json({ error: "Failed to create order" });
    }
});

// ===== PUBLIC TESTIMONI =====
app.get('/order/public', (req, res) => {
    const testi = orders
        .filter(o => o.status === "paid")
        .map(o => ({
            service: o.service_id,
            qty: o.qty,
            order_id: o.order_id
        }));
    res.json(testi);
});

// ===== PAKASIR WEBHOOK =====
app.post('/webhook/pakasir', async (req, res) => {
    try {
        const { order_id, status } = req.body;
        let order = orders.find(o => o.order_id === order_id);
        if (!order) return res.sendStatus(200);

        if (["PAID", "completed"].includes(status) && order.status !== "paid") {
            order.status = "paid";
            order.paid_at = new Date().toISOString();

            // ===== REQUEST KE FAYUPEDIA OTOMATIS =====
            try {
                const fayuResp = await axios.post('https://www.fayupedia.id/api/order', {
                    api_id: config.fayu_id,
                    api_key: config.fayu_api,
                    service: order.service_id,
                    target: order.target,
                    quantity: order.qty
                });
                console.log(`Fayupedia order success:`, fayuResp.data);
            } catch (e) {
                console.error("Fayupedia request failed:", e.message);
            }
        }

        res.sendStatus(200);

    } catch (e) {
        console.error("Webhook error:", e.message);
        res.sendStatus(500);
    }
});

// ===== REFRESH CONFIG SETIAP 5 MENIT =====
setInterval(loadConfig, 5 * 60 * 1000);

app.listen(3000, () => console.log("Panel running on port 3000..."));