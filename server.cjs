var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_qrcode = __toESM(require("qrcode"), 1);
var import_mercadopago = require("mercadopago");
var import_app = require("firebase-admin/app");
var import_firestore = require("firebase-admin/firestore");
function calculateCRC16(payload) {
  let crc = 65535;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 32768) !== 0) {
        crc = crc << 1 ^ 4129;
      } else {
        crc = crc << 1;
      }
    }
  }
  crc &= 65535;
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function generatePixPayload({
  pixKey = "contatejeff@gmail.com",
  merchantName = "Plataforma de Tarefas",
  merchantCity = "Sao Paulo",
  amount = 10,
  txid = "***"
}) {
  const formatField = (id, value) => {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  };
  const gui = formatField("00", "br.gov.bcb.pix");
  const key = formatField("01", pixKey);
  const merchantAccountInfo = formatField("26", gui + key);
  const payloadFormat = formatField("00", "01");
  const initiationMethod = formatField("01", "12");
  const mcc = formatField("52", "0000");
  const currency = formatField("53", "986");
  const formattedAmount = formatField("54", amount.toFixed(2));
  const country = formatField("58", "BR");
  const name = formatField("59", merchantName);
  const city = formatField("60", merchantCity);
  const additionalData = formatField("62", formatField("05", txid));
  let payloadWithoutCrc = payloadFormat + initiationMethod + merchantAccountInfo + mcc + currency + formattedAmount + country + name + city + additionalData + "6304";
  const crc = calculateCRC16(payloadWithoutCrc);
  return payloadWithoutCrc + crc;
}
var client = new import_mercadopago.MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "" });
if (!(0, import_app.getApps)().length) {
  try {
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountRaw) {
      (0, import_app.initializeApp)({
        credential: (0, import_app.cert)(JSON.parse(serviceAccountRaw))
      });
      console.log("Firebase Admin inicializado com sucesso no Backend.");
    } else {
      console.warn("Aviso: FIREBASE_SERVICE_ACCOUNT n\xE3o configurado. Webhooks de pagamento n\xE3o funcionar\xE3o automaticamente.");
    }
  } catch (e) {
    console.error("Falha ao analisar FIREBASE_SERVICE_ACCOUNT. Certifique-se de que \xE9 um JSON v\xE1lido.");
  }
}
var dbAdmin = (0, import_app.getApps)().length > 0 ? (0, import_firestore.getFirestore)() : null;
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  app.use((0, import_cors.default)({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        "https://tarefas.site",
        "https://www.tarefas.site",
        "https://jeffmr.github.io"
      ];
      const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".run.app") || origin.endsWith(".ai.studio") || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  }));
  app.use(import_express.default.json());
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/admin/developer-logs", (req, res) => {
    try {
      const logsDir = import_path.default.join(process.cwd(), "Logs");
      if (!import_fs.default.existsSync(logsDir)) {
        return res.json([]);
      }
      const files = import_fs.default.readdirSync(logsDir).filter((f) => f.endsWith(".json"));
      const logsList = files.map((filename) => {
        try {
          const filePath = import_path.default.join(logsDir, filename);
          const raw = import_fs.default.readFileSync(filePath, "utf-8");
          const data = JSON.parse(raw);
          const timestamp = data.timestamp || data.date || filename.replace(".json", "");
          const title = data.requestClassification || data.request || data.action || filename;
          const description = data.summary || data.scope || data.details || data.result || "";
          const actions = data.actionsTaken || (data.details ? [data.details] : []);
          const result = data.result || data.action || "";
          return {
            filename,
            timestamp,
            title,
            description,
            actions,
            result,
            rawJson: data
          };
        } catch (err) {
          return {
            filename,
            timestamp: filename.replace(".json", ""),
            title: filename,
            description: "Erro ao analisar arquivo JSON",
            actions: [],
            result: "",
            rawJson: { error: err?.message || "Erro desconhecido" }
          };
        }
      });
      logsList.sort((a, b) => b.filename.localeCompare(a.filename));
      res.json(logsList);
    } catch (error) {
      console.error("Erro ao carregar logs de desenvolvedor:", error);
      res.status(500).json({ error: "Erro ao carregar logs" });
    }
  });
  function getMercadoPagoPayment() {
    const token = (process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
    if (!token) return null;
    const mpConfig = new import_mercadopago.MercadoPagoConfig({ accessToken: token });
    return new import_mercadopago.Payment(mpConfig);
  }
  function getMercadoPagoPreference() {
    const token = (process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
    if (!token) return null;
    const mpConfig = new import_mercadopago.MercadoPagoConfig({ accessToken: token });
    return new import_mercadopago.Preference(mpConfig);
  }
  app.post("/api/payments/pix", async (req, res) => {
    const {
      transactionAmount,
      description,
      payerEmail,
      payerName,
      payerCpf,
      userId,
      purchaseType,
      extraData
    } = req.body;
    try {
      if (!transactionAmount || !payerEmail || !userId) {
        return res.status(400).json({ error: "Dados incompletos para gera\xE7\xE3o do PIX." });
      }
      const token = (process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
      const hasValidToken = token && (token.startsWith("APP_USR-") || token.startsWith("TEST-"));
      const formattedAmount = Number(transactionAmount).toFixed(2);
      let cleanDescription = (description || "").trim();
      if (!cleanDescription) {
        if (purchaseType === "buy_coins") {
          cleanDescription = `Compra de ${extraData || "Moedas"} (R$ ${formattedAmount}) - Tarefas.site`;
        } else if (purchaseType === "buy_plan") {
          cleanDescription = `Assinatura VIP (R$ ${formattedAmount}) - Tarefas.site`;
        } else {
          cleanDescription = `Dep\xF3sito de R$ ${formattedAmount} na Carteira - Tarefas.site`;
        }
      } else if (!cleanDescription.includes("R$") && !cleanDescription.includes(formattedAmount)) {
        cleanDescription = `${cleanDescription} (R$ ${formattedAmount})`;
      }
      const cleanName = (payerName || "Cliente").trim();
      const cleanCpf = (payerCpf || "").toString().replace(/\D/g, "");
      let qrCode = "";
      let qrCodeBase64 = "";
      let paymentId = "";
      let ticketUrl = null;
      if (hasValidToken) {
        try {
          const payment = getMercadoPagoPayment();
          if (payment) {
            const requestOptions = {
              idempotencyKey: `${userId}-${Date.now()}`
            };
            const nameParts = cleanName.split(/\s+/);
            const firstName = nameParts[0] || "Cliente";
            const lastName = nameParts.slice(1).join(" ") || "Usuario";
            const payerData = {
              email: payerEmail.trim(),
              first_name: firstName,
              last_name: lastName
            };
            if (cleanCpf && cleanCpf.length === 11) {
              payerData.identification = {
                type: "CPF",
                number: cleanCpf
              };
            }
            const paymentData = {
              transaction_amount: Number(Number(transactionAmount).toFixed(2)),
              description: cleanDescription,
              payment_method_id: "pix",
              payer: payerData,
              metadata: {
                user_id: userId,
                purchase_type: purchaseType || "deposit",
                extra_data: extraData || ""
              }
            };
            const result = await payment.create({ body: paymentData, requestOptions });
            qrCode = result.point_of_interaction?.transaction_data?.qr_code;
            qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64;
            ticketUrl = result.point_of_interaction?.transaction_data?.ticket_url || null;
            paymentId = String(result.id);
          }
        } catch (mpErr) {
          console.warn("Aviso: Falha ao gerar PIX oficial no Mercado Pago, usando fallback Sandbox:", mpErr?.message || mpErr);
        }
      }
      if (!qrCode || !paymentId) {
        paymentId = `test_pay_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
        qrCode = generatePixPayload({
          pixKey: "contatejeff@gmail.com",
          merchantName: "Tarefas Site Pagamentos",
          merchantCity: "Sao Paulo",
          amount: Number(transactionAmount),
          txid: paymentId
        });
        const qrDataUrl = await import_qrcode.default.toDataURL(qrCode);
        qrCodeBase64 = qrDataUrl.split(",")[1];
        if (!global.__testPayments) {
          global.__testPayments = {};
        }
        global.__testPayments[paymentId] = {
          id: paymentId,
          status: "approved",
          transaction_amount: Number(transactionAmount),
          metadata: {
            user_id: userId,
            purchase_type: purchaseType || "deposit",
            extra_data: extraData || ""
          }
        };
      }
      if (!qrCodeBase64 && qrCode) {
        const qrDataUrl = await import_qrcode.default.toDataURL(qrCode);
        qrCodeBase64 = qrDataUrl.split(",")[1];
      }
      if (dbAdmin) {
        try {
          const txRef = dbAdmin.collection("transactions").doc(`mp_${paymentId}`);
          await txRef.set({
            id: String(paymentId),
            userId,
            type: purchaseType || "deposit",
            amount: Number(transactionAmount),
            extraData: extraData || "",
            description: cleanDescription,
            status: paymentId.startsWith("test_pay_") ? "approved" : "pending",
            paymentMethod: "pix",
            qrCode,
            qrCodeBase64: qrCodeBase64 || null,
            ticketUrl: ticketUrl || null,
            payerName: cleanName,
            payerCpf: cleanCpf || null,
            payerEmail,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          }, { merge: true });
          if (paymentId.startsWith("test_pay_")) {
            await processApprovedPayment({
              id: paymentId,
              status: "approved",
              transaction_amount: Number(transactionAmount),
              metadata: {
                user_id: userId,
                purchase_type: purchaseType || "deposit",
                extra_data: extraData || ""
              }
            });
          }
        } catch (dbErr) {
          console.warn("Aviso ao registrar transa\xE7\xE3o pendente:", dbErr);
        }
      }
      return res.json({
        success: true,
        paymentId: String(paymentId),
        qrCode,
        qrCodeBase64,
        ticketUrl: ticketUrl || null
      });
    } catch (error) {
      console.error("Erro detalhado ao criar pagamento PIX:", error);
      return res.status(400).json({
        error: `Erro ao gerar PIX: ${error?.message || "Erro desconhecido"}`,
        details: error?.cause || null
      });
    }
  });
  async function processApprovedPayment(paymentInfo) {
    if (!dbAdmin) return false;
    const paymentId = paymentInfo.id;
    if (paymentInfo.status !== "approved") return false;
    const metadata = paymentInfo.metadata || {};
    const userId = metadata.user_id;
    const purchaseType = metadata.purchase_type || "deposit";
    const extraData = metadata.extra_data || "";
    const amount = paymentInfo.transaction_amount;
    const detectedMethod = paymentInfo.payment_method_id === "pix" ? "pix" : paymentInfo.payment_type_id === "credit_card" || paymentInfo.payment_method_id?.includes("card") ? "credit_card" : paymentInfo.payment_method || "pix";
    if (!userId) return false;
    const userRef = dbAdmin.collection("users").doc(userId);
    const txRef = dbAdmin.collection("transactions").doc(`mp_${paymentId}`);
    const txDoc = await txRef.get();
    if (txDoc.exists && txDoc.data()?.status === "approved") {
      return true;
    }
    await dbAdmin.runTransaction(async (t) => {
      const uDoc = await t.get(userRef);
      if (!uDoc.exists) return;
      const userData = uDoc.data() || {};
      let newBalance = userData.balance || 0;
      let newCoins = userData.coins || 0;
      let newPlan = userData.plan || "free";
      let planExpiresAt = userData.planExpiresAt || null;
      if (purchaseType === "deposit") {
        newBalance += Number(amount);
      } else if (purchaseType === "buy_coins") {
        newCoins += parseInt(extraData) || 0;
      } else if (purchaseType === "buy_plan") {
        let planType = "premium";
        let days = 30;
        const extraClean = String(extraData || "premium_30").toLowerCase();
        if (extraClean.includes("365") || extraClean.includes("anual")) {
          planType = "premium";
          days = 365;
        } else if (extraClean.includes("180") || extraClean.includes("semestral")) {
          planType = "premium";
          days = 180;
        } else if (extraClean.includes("90") || extraClean.includes("trimestral")) {
          planType = "premium";
          days = 90;
        } else if (extraClean.includes("intermediate") || extraClean.includes("intermediario")) {
          planType = "intermediate";
          days = 30;
        } else {
          const parts = extraClean.split("_");
          if (parts[0] && (parts[0] === "premium" || parts[0] === "intermediate" || parts[0] === "free")) {
            planType = parts[0];
          }
          if (parts[1] && !isNaN(parseInt(parts[1]))) {
            days = parseInt(parts[1]);
          }
        }
        newPlan = planType;
        const now = /* @__PURE__ */ new Date();
        let currentExpiration = planExpiresAt ? new Date(planExpiresAt) : now;
        if (currentExpiration < now) currentExpiration = now;
        currentExpiration.setDate(currentExpiration.getDate() + days);
        planExpiresAt = currentExpiration.toISOString();
      }
      t.update(userRef, {
        balance: Number(newBalance.toFixed(2)),
        coins: newCoins,
        plan: newPlan,
        planExpiresAt
      });
      t.set(txRef, {
        id: String(paymentId),
        userId,
        type: purchaseType,
        amount: Number(amount),
        extraData: extraData || "",
        status: "approved",
        paymentMethod: detectedMethod,
        approvedAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true });
    });
    return true;
  }
  app.post("/api/payments/card", async (req, res) => {
    const {
      token,
      transactionAmount,
      description,
      installments,
      paymentMethodId,
      issuerId,
      payerEmail,
      payerName,
      payerCpf,
      userId,
      purchaseType,
      extraData
    } = req.body;
    try {
      if (!transactionAmount || !payerEmail || !userId) {
        return res.status(400).json({ error: "Dados incompletos para processamento do cart\xE3o." });
      }
      const accessToken = (process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
      const hasValidToken = accessToken && (accessToken.startsWith("APP_USR-") || accessToken.startsWith("TEST-"));
      const formattedAmount = Number(transactionAmount).toFixed(2);
      let cleanDescription = (description || "").trim();
      if (!cleanDescription) {
        if (purchaseType === "buy_coins") {
          cleanDescription = `Compra de ${extraData || "Moedas"} (R$ ${formattedAmount}) - Tarefas.site`;
        } else if (purchaseType === "buy_plan") {
          cleanDescription = `Assinatura VIP (R$ ${formattedAmount}) - Tarefas.site`;
        } else {
          cleanDescription = `Dep\xF3sito de R$ ${formattedAmount} na Carteira - Tarefas.site`;
        }
      }
      const cleanName = (payerName || "Cliente").trim();
      const cleanCpf = (payerCpf || "").toString().replace(/\D/g, "");
      const nameParts = cleanName.split(/\s+/);
      const firstName = nameParts[0] || "Cliente";
      const lastName = nameParts.slice(1).join(" ") || "Usuario";
      let resultStatus = "approved";
      let resultStatusDetail = "accredited";
      let paymentId = "";
      if (hasValidToken && token) {
        try {
          const payment = getMercadoPagoPayment();
          if (payment) {
            const requestOptions = {
              idempotencyKey: `card-${userId}-${Date.now()}`
            };
            const payerData = {
              email: payerEmail.trim(),
              first_name: firstName,
              last_name: lastName
            };
            if (cleanCpf && cleanCpf.length === 11) {
              payerData.identification = {
                type: "CPF",
                number: cleanCpf
              };
            }
            const paymentData = {
              transaction_amount: Number(Number(transactionAmount).toFixed(2)),
              token,
              description: cleanDescription,
              installments: Number(installments || 1),
              payment_method_id: paymentMethodId || void 0,
              issuer_id: issuerId ? Number(issuerId) : void 0,
              payer: payerData,
              metadata: {
                user_id: userId,
                purchase_type: purchaseType || "deposit",
                extra_data: extraData || ""
              }
            };
            const result = await payment.create({ body: paymentData, requestOptions });
            paymentId = String(result.id);
            resultStatus = result.status || "approved";
            resultStatusDetail = result.status_detail || "accredited";
            if (result.status === "approved") {
              await processApprovedPayment(result);
            } else if (dbAdmin) {
              const txRef = dbAdmin.collection("transactions").doc(`mp_${paymentId}`);
              await txRef.set({
                id: String(paymentId),
                userId,
                type: purchaseType || "deposit",
                amount: Number(transactionAmount),
                extraData: extraData || "",
                status: result.status === "in_process" ? "pending" : "cancelled",
                paymentMethod: "credit_card",
                payerName: cleanName,
                payerCpf: cleanCpf || null,
                payerEmail,
                statusDetail: resultStatusDetail,
                createdAt: (/* @__PURE__ */ new Date()).toISOString()
              }, { merge: true });
            }
          }
        } catch (mpErr) {
          console.warn("Erro ao processar cart\xE3o no Mercado Pago:", mpErr?.message || mpErr);
          return res.status(400).json({
            error: mpErr?.message || "N\xE3o foi poss\xEDvel autorizar o cart\xE3o. Verifique os dados digitados e tente novamente.",
            status: "rejected",
            statusDetail: "cc_rejected_bad_filled_other"
          });
        }
      } else {
        paymentId = `test_card_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
        resultStatus = "approved";
        resultStatusDetail = "accredited";
        await processApprovedPayment({
          id: paymentId,
          status: "approved",
          transaction_amount: Number(transactionAmount),
          payment_method: "credit_card",
          metadata: {
            user_id: userId,
            purchase_type: purchaseType || "deposit",
            extra_data: extraData || ""
          }
        });
      }
      return res.json({
        success: resultStatus === "approved",
        status: resultStatus,
        statusDetail: resultStatusDetail,
        paymentId: String(paymentId)
      });
    } catch (error) {
      console.error("Erro geral na rota de cart\xE3o:", error);
      return res.status(500).json({
        error: error.message || "Erro interno ao processar pagamento com cart\xE3o."
      });
    }
  });
  app.post("/api/payments/preference", async (req, res) => {
    const {
      transactionAmount,
      description,
      payerEmail,
      payerName,
      payerCpf,
      userId,
      purchaseType,
      extraData,
      originUrl
    } = req.body;
    try {
      if (!transactionAmount || !payerEmail || !userId) {
        return res.status(400).json({ error: "Dados incompletos para criar checkout oficial." });
      }
      const token = (process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
      const hasValidToken = token && (token.startsWith("APP_USR-") || token.startsWith("TEST-"));
      const formattedAmount = Number(transactionAmount).toFixed(2);
      let cleanDescription = (description || "").trim();
      if (!cleanDescription) {
        if (purchaseType === "buy_coins") {
          cleanDescription = `Compra de ${extraData || "Moedas"} (R$ ${formattedAmount}) - Tarefas.site`;
        } else if (purchaseType === "buy_plan") {
          cleanDescription = `Assinatura VIP (R$ ${formattedAmount}) - Tarefas.site`;
        } else {
          cleanDescription = `Dep\xF3sito de R$ ${formattedAmount} na Carteira - Tarefas.site`;
        }
      }
      const cleanName = (payerName || "Cliente").trim();
      const cleanCpf = (payerCpf || "").toString().replace(/\D/g, "");
      const hostOrigin = originUrl || (req.headers.origin ? String(req.headers.origin) : "https://tarefas.site");
      const returnUrl = `${hostOrigin}/wallet`;
      const webhookUrl = `${hostOrigin}/api/payments/webhook`;
      const prefExtRef = `pref_${userId}_${Date.now()}`;
      let preferenceId = "";
      let initPoint = "";
      let sandboxInitPoint = "";
      if (hasValidToken) {
        try {
          const preference = getMercadoPagoPreference();
          if (preference) {
            const prefData = {
              items: [
                {
                  id: `${purchaseType || "deposit"}_${Date.now()}`,
                  title: cleanDescription,
                  description: cleanDescription,
                  quantity: 1,
                  unit_price: Number(Number(transactionAmount).toFixed(2)),
                  currency_id: "BRL"
                }
              ],
              payer: {
                email: payerEmail.trim(),
                name: cleanName,
                identification: cleanCpf && cleanCpf.length === 11 ? {
                  type: "CPF",
                  number: cleanCpf
                } : void 0
              },
              back_urls: {
                success: `${returnUrl}?status=approved&pref_ref=${prefExtRef}`,
                pending: `${returnUrl}?status=pending&pref_ref=${prefExtRef}`,
                failure: `${returnUrl}?status=failure&pref_ref=${prefExtRef}`
              },
              auto_return: "approved",
              metadata: {
                user_id: userId,
                purchase_type: purchaseType || "deposit",
                extra_data: extraData || ""
              },
              notification_url: webhookUrl.startsWith("https://") ? webhookUrl : void 0,
              statement_descriptor: "TAREFAS.SITE",
              external_reference: prefExtRef
            };
            const prefResult = await preference.create({ body: prefData });
            preferenceId = String(prefResult.id);
            initPoint = prefResult.init_point || "";
            sandboxInitPoint = prefResult.sandbox_init_point || "";
          }
        } catch (mpErr) {
          console.warn("Aviso ao criar prefer\xEAncia no Mercado Pago:", mpErr?.message || mpErr);
        }
      }
      if (!initPoint) {
        preferenceId = `pref_test_${Date.now()}`;
        initPoint = `${hostOrigin}/wallet?status=approved&simulated_pref=${preferenceId}&amount=${formattedAmount}&type=${purchaseType || "deposit"}&extra=${extraData || ""}`;
        sandboxInitPoint = initPoint;
      }
      if (dbAdmin) {
        try {
          const txRef = dbAdmin.collection("transactions").doc(`mp_pref_${preferenceId}`);
          await txRef.set({
            id: String(preferenceId),
            userId,
            type: purchaseType || "deposit",
            amount: Number(transactionAmount),
            extraData: extraData || "",
            status: "pending",
            paymentMethod: "checkout_pro",
            externalReference: prefExtRef || void 0,
            payerName: cleanName,
            payerCpf: cleanCpf || null,
            payerEmail,
            initPoint,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.warn("Aviso ao registrar transa\xE7\xE3o da prefer\xEAncia:", dbErr);
        }
      }
      return res.json({
        success: true,
        preferenceId,
        initPoint,
        sandboxInitPoint
      });
    } catch (error) {
      console.error("Erro ao criar prefer\xEAncia de checkout oficial:", error);
      return res.status(500).json({ error: error.message || "Erro ao criar checkout oficial Mercado Pago." });
    }
  });
  app.post("/api/payments/cancel/:paymentId", async (req, res) => {
    try {
      const { paymentId } = req.params;
      const { userId, reason } = req.body;
      if (!dbAdmin) {
        return res.status(500).json({ error: "Banco de dados n\xE3o dispon\xEDvel no servidor." });
      }
      let txRef = dbAdmin.collection("transactions").doc(`mp_${paymentId}`);
      let txDoc = await txRef.get();
      if (!txDoc.exists) {
        txRef = dbAdmin.collection("transactions").doc(`mp_pref_${paymentId}`);
        txDoc = await txRef.get();
      }
      if (!txDoc.exists) {
        const querySnap = await dbAdmin.collection("transactions").where("id", "==", paymentId).limit(1).get();
        if (!querySnap.empty) {
          txDoc = querySnap.docs[0];
          txRef = txDoc.ref;
        }
      }
      if (!txDoc.exists) {
        return res.status(404).json({ error: "Solicita\xE7\xE3o de pagamento n\xE3o encontrada." });
      }
      const data = txDoc.data();
      if (userId && data?.userId !== userId) {
        return res.status(403).json({ error: "Sem permiss\xE3o para cancelar esta solicita\xE7\xE3o." });
      }
      if (data?.status === "approved") {
        return res.status(400).json({ error: "N\xE3o \xE9 poss\xEDvel cancelar uma solicita\xE7\xE3o j\xE1 aprovada e creditada." });
      }
      await txRef.update({
        status: "cancelled",
        cancellationReason: reason || "Cancelado pelo usu\xE1rio",
        cancelledAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      return res.json({ success: true, message: "Solicita\xE7\xE3o de pagamento cancelada com sucesso." });
    } catch (error) {
      console.error("Erro ao cancelar solicita\xE7\xE3o:", error);
      return res.status(500).json({ error: error.message || "Erro ao cancelar solicita\xE7\xE3o." });
    }
  });
  app.post("/api/payments/checkout-failure", async (req, res) => {
    try {
      const { userId, prefRef, preferenceId, collectionId, paymentId, paymentMethodId, paymentTypeId } = req.body;
      if (!dbAdmin || !userId) {
        return res.status(400).json({ error: "Dados insuficientes ou banco indispon\xEDvel." });
      }
      let detectedMethod = "checkout_pro";
      if (paymentMethodId) {
        detectedMethod = paymentMethodId.toLowerCase();
      } else if (paymentTypeId === "credit_card") {
        detectedMethod = "credit_card";
      } else if (paymentTypeId === "ticket" || paymentTypeId === "pix") {
        detectedMethod = "pix";
      }
      let updated = false;
      if (prefRef) {
        const snap = await dbAdmin.collection("transactions").where("userId", "==", userId).where("externalReference", "==", prefRef).get();
        for (const doc of snap.docs) {
          const docData = doc.data();
          if (docData.status !== "approved") {
            await doc.ref.set({
              status: "cancelled",
              cancellationReason: "Desist\xEAncia no Checkout Oficial Mercado Pago",
              paymentMethod: detectedMethod !== "checkout_pro" ? detectedMethod : docData.paymentMethod || "checkout_pro",
              cancelledAt: (/* @__PURE__ */ new Date()).toISOString(),
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            }, { merge: true });
            updated = true;
          }
        }
      }
      if (!updated && preferenceId) {
        let prefDocRef = dbAdmin.collection("transactions").doc(`mp_pref_${preferenceId}`);
        let prefDoc = await prefDocRef.get();
        if (prefDoc.exists && prefDoc.data()?.status !== "approved") {
          await prefDocRef.set({
            status: "cancelled",
            cancellationReason: "Desist\xEAncia no Checkout Oficial Mercado Pago",
            paymentMethod: detectedMethod !== "checkout_pro" ? detectedMethod : prefDoc.data()?.paymentMethod || "checkout_pro",
            cancelledAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }, { merge: true });
          updated = true;
        }
      }
      if (!updated) {
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1e3).toISOString();
        const recentSnap = await dbAdmin.collection("transactions").where("userId", "==", userId).where("status", "==", "pending").get();
        const pendingList = recentSnap.docs.map((d) => ({ ref: d.ref, data: d.data() })).filter((item) => item.data.createdAt >= thirtyMinAgo).sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime());
        if (pendingList.length > 0) {
          const target = pendingList[0];
          await target.ref.set({
            status: "cancelled",
            cancellationReason: "Desist\xEAncia no Checkout Oficial Mercado Pago",
            paymentMethod: detectedMethod !== "checkout_pro" ? detectedMethod : target.data.paymentMethod || "checkout_pro",
            cancelledAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }, { merge: true });
          updated = true;
        }
      }
      return res.json({ success: true, updated });
    } catch (error) {
      console.error("Erro ao registrar cancelamento do checkout:", error);
      return res.status(500).json({ error: error.message || "Erro ao registrar cancelamento." });
    }
  });
  app.get("/api/payments/status/:paymentId", async (req, res) => {
    try {
      const { paymentId } = req.params;
      if (paymentId.startsWith("test_pay_") || paymentId.startsWith("test_card_") || paymentId.startsWith("pref_test_")) {
        const testPayments = global.__testPayments || {};
        const testPay = testPayments[paymentId];
        let processed2 = false;
        if (testPay) {
          processed2 = await processApprovedPayment(testPay);
        }
        return res.json({
          success: true,
          status: "approved",
          statusDetail: "accredited",
          processed: processed2,
          isSandboxTest: true
        });
      }
      if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
        return res.status(500).json({ error: "Token do Mercado Pago n\xE3o configurado no servidor." });
      }
      const payment = getMercadoPagoPayment();
      if (!payment) {
        return res.status(500).json({ error: "Cliente Mercado Pago n\xE3o dispon\xEDvel." });
      }
      let paymentInfo = null;
      try {
        paymentInfo = await payment.get({ id: Number(paymentId) });
      } catch (mpErr) {
        console.warn(`Aviso: Pagamento ${paymentId} n\xE3o encontrado ou expirado no Mercado Pago:`, mpErr?.message || mpErr);
        if (dbAdmin) {
          try {
            const txRef = dbAdmin.collection("transactions").doc(`mp_${paymentId}`);
            const txDoc = await txRef.get();
            if (txDoc.exists) {
              const txData = txDoc.data();
              if (txData?.status === "approved") {
                return res.json({
                  success: true,
                  status: "approved",
                  statusDetail: "accredited",
                  processed: true
                });
              }
              const createdAt = txData?.createdAt ? new Date(txData.createdAt).getTime() : Date.now();
              const isOld = Date.now() - createdAt > 24 * 60 * 60 * 1e3;
              if (isOld || txData?.status === "expired" || txData?.status === "cancelled") {
                await txRef.set({ status: "cancelled", cancelledAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
                return res.json({
                  success: true,
                  status: "expired",
                  statusDetail: "expired_by_time",
                  processed: false
                });
              }
            }
          } catch (dbEx) {
            console.warn("Erro ao consultar Firestore local para fallback de status:", dbEx);
          }
        }
        return res.json({
          success: true,
          status: "expired",
          statusDetail: "not_found_or_expired",
          processed: false
        });
      }
      let processed = false;
      if (paymentInfo.status === "approved") {
        processed = await processApprovedPayment(paymentInfo);
      } else if (paymentInfo.status === "cancelled" || paymentInfo.status === "rejected" || paymentInfo.status === "expired") {
        if (dbAdmin) {
          try {
            const txRef = dbAdmin.collection("transactions").doc(`mp_${paymentId}`);
            await txRef.set({
              status: "cancelled",
              cancelledAt: (/* @__PURE__ */ new Date()).toISOString(),
              cancellationReason: paymentInfo.status === "expired" ? "PIX expirado por tempo limite" : "Cancelado pelo gateway",
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            }, { merge: true });
          } catch (e) {
            console.warn("Aviso ao atualizar transa\xE7\xE3o cancelada/expirada no Firestore:", e);
          }
        }
      }
      res.json({
        success: true,
        status: paymentInfo.status,
        statusDetail: paymentInfo.status_detail,
        processed
      });
    } catch (error) {
      console.error("Erro ao verificar status do pagamento:", error);
      res.json({ success: true, status: "pending", error: error.message || "Erro ao verificar status" });
    }
  });
  app.all("/api/payments/webhook", async (req, res) => {
    try {
      const paymentId = req.body?.data?.id || req.body?.id || req.query?.["data.id"] || req.query?.id;
      const topic = req.body?.type || req.query?.topic || req.body?.action;
      console.log("Recebido Webhook Mercado Pago:", { body: req.body, query: req.query });
      if (paymentId === "123456" || paymentId === 123456 || !paymentId) {
        return res.status(200).send("OK");
      }
      if (process.env.MERCADOPAGO_ACCESS_TOKEN && (topic === "payment" || topic === "payment.created" || topic === "payment.updated")) {
        try {
          const payment = getMercadoPagoPayment();
          if (payment) {
            const paymentInfo = await payment.get({ id: String(paymentId) });
            await processApprovedPayment(paymentInfo);
          }
        } catch (fetchError) {
          console.warn("Aviso ao buscar detalhes do pagamento no Webhook:", fetchError);
        }
      }
      return res.status(200).send("OK");
    } catch (error) {
      console.error("Erro no Webhook:", error);
      return res.status(200).send("OK");
    }
  });
  app.post("/api/purchases/internal", async (req, res) => {
    try {
      if (!dbAdmin) return res.status(500).json({ error: "Banco de dados Admin n\xE3o inicializado" });
      const { userId, purchaseType, extraData, cost } = req.body;
      const userRef = dbAdmin.collection("users").doc(userId);
      const txRef = dbAdmin.collection("transactions").doc(`internal_${Date.now()}`);
      await dbAdmin.runTransaction(async (t) => {
        const uDoc = await t.get(userRef);
        if (!uDoc.exists) throw new Error("Usu\xE1rio n\xE3o encontrado");
        const userData = uDoc.data() || {};
        let currentBalance = userData.balance || 0;
        if (currentBalance < cost) {
          throw new Error("Saldo insuficiente");
        }
        let newCoins = userData.coins || 0;
        let newPlan = userData.plan || "free";
        let planExpiresAt = userData.planExpiresAt || null;
        if (purchaseType === "buy_coins") {
          newCoins += parseInt(extraData) || 0;
        } else if (purchaseType === "buy_plan") {
          let planType = "premium";
          let days = 30;
          const extraClean = String(extraData || "premium_30").toLowerCase();
          if (extraClean.includes("365") || extraClean.includes("anual")) {
            planType = "premium";
            days = 365;
          } else if (extraClean.includes("180") || extraClean.includes("semestral")) {
            planType = "premium";
            days = 180;
          } else if (extraClean.includes("90") || extraClean.includes("trimestral")) {
            planType = "premium";
            days = 90;
          } else if (extraClean.includes("intermediate") || extraClean.includes("intermediario")) {
            planType = "intermediate";
            days = 30;
          } else {
            const parts = extraClean.split("_");
            if (parts[0] && (parts[0] === "premium" || parts[0] === "intermediate" || parts[0] === "free")) {
              planType = parts[0];
            }
            if (parts[1] && !isNaN(parseInt(parts[1]))) {
              days = parseInt(parts[1]);
            }
          }
          newPlan = planType;
          const now = /* @__PURE__ */ new Date();
          let currentExpiration = planExpiresAt ? new Date(planExpiresAt) : now;
          if (currentExpiration < now) currentExpiration = now;
          currentExpiration.setDate(currentExpiration.getDate() + days);
          planExpiresAt = currentExpiration.toISOString();
        }
        t.update(userRef, {
          balance: currentBalance - cost,
          coins: newCoins,
          plan: newPlan,
          planExpiresAt
        });
        t.set(txRef, {
          id: `internal_${Date.now()}`,
          userId,
          type: purchaseType,
          amount: cost,
          extraData: extraData || "",
          status: "approved",
          paymentMethod: "wallet_balance",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      });
      res.json({ success: true, message: "Compra realizada com sucesso!" });
    } catch (error) {
      console.error("Erro na compra interna:", error);
      res.status(400).json({ error: error.message || "Erro ao processar compra" });
    }
  });
  const isProduction = process.env.NODE_ENV === "production" || import_fs.default.existsSync(import_path.default.join(process.cwd(), "server.cjs")) || import_fs.default.existsSync(import_path.default.join(process.cwd(), "index.html"));
  if (!isProduction) {
    const viteModule = await import("vite");
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    const distIndex = import_path.default.join(distPath, "index.html");
    const rootIndex = import_path.default.join(process.cwd(), "index.html");
    const staticPath = import_fs.default.existsSync(distIndex) ? distPath : import_fs.default.existsSync(rootIndex) ? process.cwd() : distPath;
    app.use(import_express.default.static(staticPath));
    app.get("*", (req, res) => {
      const targetFile = import_fs.default.existsSync(import_path.default.join(staticPath, "index.html")) ? import_path.default.join(staticPath, "index.html") : rootIndex;
      if (import_fs.default.existsSync(targetFile)) {
        res.sendFile(targetFile);
      } else {
        res.status(404).send("Application build not found.");
      }
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
