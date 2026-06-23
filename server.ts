import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import pg from "pg";

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_FILE = path.join(process.cwd(), "server_db.json");

app.use(express.json());

// TYPES (Server-side mirror)
interface ServerUser {
  id: string;
  username: string;
  email: string;
  phone: string;
  passwordHash: string;
  referralCode: string;
  referredBy?: string;
  isAdmin?: boolean;
}

interface ServerPlan {
  id: string;
  name: string;
  amount: number;
  return_amount: number;
  duration_days: number;
  active: boolean;
  description: string;
}

interface ServerInvestment {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  return_amount: number;
  profit: number;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  matures_at: string;
  planName: string;
}

interface ServerTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: "deposit" | "withdrawal" | "investment" | "commission" | "payout";
  status: "pending" | "approved" | "declined";
  phone?: string;
  note?: string;
  created_at: string;
  crypto_address?: string;
  crypto_amount?: number;
  crypto_currency?: string;
  payment_id?: string;
}

interface ServerReferral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  referred_username: string;
  bonus: number;
  created_at: string;
}

interface ServerPaymentSettings {
  mpesa_enabled: boolean;
  crypto_enabled: boolean;
  nowpayments_sandbox: boolean;
  nowpayments_api_key?: string;
  min_deposit?: number;
  max_deposit?: number;
  min_withdrawal?: number;
  max_withdrawal?: number;
}

interface DatabaseSchema {
  users: ServerUser[];
  plans: ServerPlan[];
  investments: ServerInvestment[];
  transactions: ServerTransaction[];
  referrals: ServerReferral[];
  systemOffsetDays: number; // For fast forwarding simulations
  paymentSettings?: ServerPaymentSettings;
}

// -------------------------------------------------------------
// SEEDING DEFAULT DATABASE STATE
// -------------------------------------------------------------
const DEFAULT_PLANS: ServerPlan[] = [
  { id: "p1", name: "Copper (Starter)", amount: 800, return_amount: 1200, duration_days: 3, active: true, description: "Unlocks rapid 50% returns. Perfect entry plan." },
  { id: "p2", name: "Bronze (Growth)", amount: 2500, return_amount: 4000, duration_days: 5, active: true, description: "Highly popular for active local small-capital growth." },
  { id: "p3", name: "Silver (Alpha)", amount: 8000, return_amount: 14000, duration_days: 7, active: true, description: "Secure medium-scale vault yielding KSh 850 daily profit." },
  { id: "p4", name: "Gold (Prime)", amount: 20000, return_amount: 38000, duration_days: 10, active: true, description: "High-tier interest matching premium capital managers." },
  { id: "p5", name: "Platinum (Apex)", amount: 60000, return_amount: 120000, duration_days: 14, active: true, description: "Compounding apex tier designed for top HelaVest builders." }
];

const DEFAULT_USERS: ServerUser[] = [
  {
    id: "admin-id",
    username: "GADMIN",
    email: "admin@helavest.com",
    phone: "0700000100",
    passwordHash: "GADMIN", // standard text validation
    referralCode: "ADMINVIP",
    isAdmin: true
  },
  {
    id: "seed-referrer-id",
    username: "VinnieWizard",
    email: "vinnie@helavest.com",
    phone: "0722000111",
    passwordHash: "vinnie123",
    referralCode: "HELA777",
    isAdmin: false
  }
];

const DEFAULT_TRANSACTIONS: ServerTransaction[] = [];

const DEFAULT_INVESTMENTS: ServerInvestment[] = [];

// NEON DATABASE BACKEND MODULE
let neonPool: any = null;
let useNeon = false;
let neonError: string | null = null;
let neonInMemoryCache: DatabaseSchema | null = null;

async function initNeonDatabase() {
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    console.log("[DATABASE] No DATABASE_URL or NEON_DATABASE_URL environment variable detected. Defaulting to local JSON storage of server_db.json.");
    return;
  }

  try {
    console.log("[DATABASE] Neon connection string detected. Attempting pool connection...");
    neonPool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 5000 // fail fast if wrong URL to prevent hanging
    });

    // Test query & create table
    const client = await neonPool.connect();
    try {
      console.log("[DATABASE] Neon database connected. Running table checks...");
      await client.query(`
        CREATE TABLE IF NOT EXISTS hela_database_state (
          id VARCHAR(50) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Load initial state
      const res = await client.query("SELECT data FROM hela_database_state WHERE id = 'production_root'");
      if (res.rows.length > 0) {
        console.log("[DATABASE] Existing production_root state fetched from Neon Postgres successfully.");
        neonInMemoryCache = res.rows[0].data;
      } else {
        console.log("[DATABASE] No production_root found. Seeding local dataset to Neon Postgres...");
        
        let initialData: DatabaseSchema;
        if (fs.existsSync(DB_FILE)) {
          const raw = fs.readFileSync(DB_FILE, "utf-8");
          initialData = JSON.parse(raw);
        } else {
          initialData = {
            users: DEFAULT_USERS,
            plans: DEFAULT_PLANS,
            investments: DEFAULT_INVESTMENTS,
            transactions: DEFAULT_TRANSACTIONS,
            referrals: [],
            systemOffsetDays: 0,
            paymentSettings: {
              mpesa_enabled: true,
              crypto_enabled: true,
              nowpayments_sandbox: false,
              nowpayments_api_key: ""
            }
          };
        }
        
        await client.query(
          "INSERT INTO hela_database_state (id, data) VALUES ('production_root', $1) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
          [JSON.stringify(initialData)]
        );
        neonInMemoryCache = initialData;
        console.log("[DATABASE] Seeding finished. Neon Postgres is fully updated.");
      }
      useNeon = true;
      neonError = null;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[DATABASE] Failed to initialize Neon PostgreSQL database pool, falling back to local storage.", err);
    neonError = err.message || "Failed to establish secure postgres pool connection.";
    useNeon = false;
  }
}

function ensureGadminAdmin(db: DatabaseSchema): boolean {
  if (!db.users) {
    db.users = [];
  }
  let adminUser = db.users.find((u: any) => u.username.toLowerCase() === "gadmin");
  if (!adminUser) {
    adminUser = {
      id: "admin-id",
      username: "GADMIN",
      email: "admin@helavest.com",
      phone: "0700000100",
      passwordHash: "GADMIN",
      referralCode: "ADMINVIP",
      isAdmin: true
    };
    db.users.push(adminUser);
    return true;
  }
  
  let modified = false;
  if (adminUser.username !== "GADMIN") {
    adminUser.username = "GADMIN";
    modified = true;
  }
  if (adminUser.passwordHash !== "GADMIN") {
    adminUser.passwordHash = "GADMIN";
    modified = true;
  }
  if (!adminUser.isAdmin) {
    adminUser.isAdmin = true;
    modified = true;
  }
  return modified;
}

function getDatabase(): DatabaseSchema {
  if (useNeon && neonInMemoryCache) {
    const changed = ensureGadminAdmin(neonInMemoryCache);
    if (changed) {
      saveDatabase(neonInMemoryCache);
    }
    return neonInMemoryCache;
  }

  if (!fs.existsSync(DB_FILE)) {
    const freshDb: DatabaseSchema = {
      users: DEFAULT_USERS,
      plans: DEFAULT_PLANS,
      investments: DEFAULT_INVESTMENTS,
      transactions: DEFAULT_TRANSACTIONS,
      referrals: [],
      systemOffsetDays: 0,
      paymentSettings: {
        mpesa_enabled: true,
        crypto_enabled: true,
        nowpayments_sandbox: false,
        nowpayments_api_key: ""
      }
    };
    ensureGadminAdmin(freshDb);
    fs.writeFileSync(DB_FILE, JSON.stringify(freshDb, null, 2), "utf-8");
    return freshDb;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const db = JSON.parse(raw);
    
    const changed = ensureGadminAdmin(db);
    
    if (!db.paymentSettings) {
      db.paymentSettings = {
        mpesa_enabled: true,
        crypto_enabled: true,
        nowpayments_sandbox: false,
        nowpayments_api_key: ""
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    } else if (changed) {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    }
    return db;
  } catch (err) {
    console.error("Failed to parse database, returning default", err);
    return {
      users: DEFAULT_USERS,
      plans: DEFAULT_PLANS,
      investments: DEFAULT_INVESTMENTS,
      transactions: DEFAULT_TRANSACTIONS,
      referrals: [],
      systemOffsetDays: 0,
      paymentSettings: {
        mpesa_enabled: true,
        crypto_enabled: true,
        nowpayments_sandbox: false,
        nowpayments_api_key: ""
      }
    };
  }
}

function saveDatabase(db: DatabaseSchema) {
  if (useNeon && neonPool) {
    // Instantly sync local fast cache
    neonInMemoryCache = db;

    // Async push to Neon PostgreSQL in bg
    neonPool.query(
      "UPDATE hela_database_state SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 'production_root'",
      [JSON.stringify(db)]
    ).then(() => {
      console.log("[DATABASE] Auto-sync to Neon cloud Postgres committed successfully.");
    }).catch((err: any) => {
      console.error("[DATABASE] Error committing state sync to Neon Postgres:", err);
    });
  }
  
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

function genCode() {
  return "HELA" + Math.floor(100000 + Math.random() * 900000);
}

// Calculate Wallet Balances dynamically based on Approved state
function calculateBalance(userId: string, txs: ServerTransaction[]): {
  total_deposits: number;
  referral_bonus: number;
  total_payouts: number;
  total_withdrawals: number;
  total_invested: number;
  available_balance: number;
} {
  const approved = txs.filter((t) => t.user_id === userId && t.status === "approved");
  const deposits = approved.filter((t) => t.transaction_type === "deposit").reduce((sum, t) => sum + t.amount, 0);
  const commissions = approved.filter((t) => t.transaction_type === "commission").reduce((sum, t) => sum + t.amount, 0);
  const payouts = approved.filter((t) => t.transaction_type === "payout").reduce((sum, t) => sum + t.amount, 0);
  const withdrawals = approved.filter((t) => t.transaction_type === "withdrawal").reduce((sum, t) => sum + t.amount, 0);
  const investments = approved.filter((t) => t.transaction_type === "investment").reduce((sum, t) => sum + t.amount, 0);

  return {
    total_deposits: deposits,
    referral_bonus: commissions,
    total_payouts: payouts,
    total_withdrawals: withdrawals,
    total_invested: investments,
    available_balance: deposits + commissions + payouts - withdrawals - investments
  };
}

// -------------------------------------------------------------
// TIMER MATURITY & PAYOUT SCHEDULER (FAST FORWARD ENABLED)
// -------------------------------------------------------------
function completeMaturedTradeJobs(db: DatabaseSchema, userId?: string): { completedCount: number; dbChanged: boolean } {
  const now = new Date();
  const offsetMs = db.systemOffsetDays * 24 * 60 * 60 * 1000;
  const virtualNowTime = now.getTime() + offsetMs;

  let completedCount = 0;
  let dbChanged = false;

  const activeInvestments = db.investments.filter(
    (inv) => inv.status === "active" && (userId ? inv.user_id === userId : true)
  );

  for (const inv of activeInvestments) {
    const maturesTime = new Date(inv.matures_at).getTime();
    if (maturesTime <= virtualNowTime) {
      inv.status = "completed";
      dbChanged = true;
      completedCount++;

      // Create a Payout transaction automatically
      const hasPayout = db.transactions.some(
        (t) => t.user_id === inv.user_id && t.transaction_type === "payout" && t.note?.includes(inv.id)
      );

      if (!hasPayout) {
        db.transactions.push({
          id: "tx-pay-" + Math.random().toString(36).substr(2, 9),
          user_id: inv.user_id,
          amount: inv.return_amount,
          transaction_type: "payout",
          status: "approved",
          note: `Payout for ${inv.planName} #${inv.id}`,
          created_at: new Date(maturesTime).toISOString()
        });
      }
    }
  }

  return { completedCount, dbChanged };
}

// -------------------------------------------------------------
// MIDDLEWARE: USER AUTH LOOKUP
// -------------------------------------------------------------
const getAuthenticatedUser = (req: express.Request, db: DatabaseSchema): ServerUser | null => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) return null;
  return db.users.find((u) => u.id === userId) || null;
};

// -------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------

// Profile Updates
app.post("/api/user/profile", (req, res) => {
  const { username, email, phone } = req.body;
  if (!username || !email || !phone) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const uIndex = db.users.findIndex(u => u.id === user.id);
  if (uIndex === -1) return res.status(404).json({ error: "User not found" });

  db.users[uIndex].username = username;
  db.users[uIndex].email = email;
  db.users[uIndex].phone = phone;
  saveDatabase(db);
  
  res.json({ success: true, message: "Profile updated successfully" });
});

// Authenticaton: Register
app.post("/api/auth/register", (req, res) => {
  const { username, email, phone, invite_code, password } = req.body;
  if (!username || !email || !phone || !password) {
    return res.status(400).json({ error: "Missing registration details." });
  }

  const db = getDatabase();
  const existingUser = db.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() || u.phone === phone || u.email === email
  );
  if (existingUser) {
    return res.status(400).json({ error: "Username, email or phone already registered." });
  }

  // Look up referrer code
  let referredByUserId: string | undefined = undefined;
  if (invite_code) {
    const referrer = db.users.find((u) => u.referralCode.toUpperCase() === invite_code.toUpperCase());
    if (referrer) {
      referredByUserId = referrer.id;
    } else {
      return res.status(400).json({ error: "Invalid referral/invite code." });
    }
  }

  const newUser: ServerUser = {
    id: "user-" + Math.random().toString(36).substr(2, 9),
    username,
    email,
    phone,
    passwordHash: password, // Simulation representation
    referralCode: genCode(),
    referredBy: referredByUserId,
    isAdmin: false
  };

  db.users.push(newUser);
  saveDatabase(db);

  return res.json({ success: true, user: { id: newUser.id, username: newUser.username, phone: newUser.phone, email: newUser.email, referralCode: newUser.referralCode, referredBy: newUser.referredBy, isAdmin: newUser.isAdmin } });
});

// Authentication: Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Please enter username and password." });
  }

  const db = getDatabase();
  const user = db.users.find(
    (u) => (u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase() || u.phone === username) && u.passwordHash === password
  );

  if (!user) {
    return res.status(401).json({ error: "Incorrect log in credentials." });
  }

  // Trigger trade completion check instantly on login
  const { dbChanged } = completeMaturedTradeJobs(db, user.id);
  if (dbChanged) saveDatabase(db);

  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      isAdmin: user.isAdmin
    }
  });
});

// Load Current Profile
app.get("/api/auth/me", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  // Check active trades instantly
  const { dbChanged } = completeMaturedTradeJobs(db, user.id);
  if (dbChanged) saveDatabase(db);

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      isAdmin: user.isAdmin
    }
  });
});

// Support Plans Endpoint
app.get("/api/plans", (req, res) => {
  const db = getDatabase();
  res.json({ plans: db.plans.filter((p) => p.active) });
});

// Balance breakdown
app.get("/api/user/balance", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  completeMaturedTradeJobs(db, user.id);
  const bal = calculateBalance(user.id, db.transactions);
  res.json({ balance: bal });
});

// Comprehensive Dashboard Stats
app.get("/api/user/stats", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // Refresh matured trades
  const { dbChanged } = completeMaturedTradeJobs(db, user.id);
  if (dbChanged) saveDatabase(db);

  const bal = calculateBalance(user.id, db.transactions);

  const myInvestments = db.investments.filter((inv) => inv.user_id === user.id);
  const activeTrades = myInvestments.filter((inv) => inv.status === "active");
  const completedTrades = myInvestments.filter((inv) => inv.status === "completed");

  const totalCapitalInActive = activeTrades.reduce((sum, inv) => sum + inv.amount, 0);
  const expectedPayouts = activeTrades.reduce((sum, inv) => sum + inv.return_amount, 0);
  const totalProfitEarned = completedTrades.reduce((sum, inv) => sum + inv.profit, 0);

  res.json({
    stats: {
      balance: bal,
      active_trades_count: activeTrades.length,
      active_trades_capital: totalCapitalInActive,
      expected_payouts: expectedPayouts,
      completed_trades_count: completedTrades.length,
      total_profit_earned: totalProfitEarned
    }
  });
});

// Investments History
app.get("/api/investments", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { dbChanged } = completeMaturedTradeJobs(db, user.id);
  if (dbChanged) saveDatabase(db);

  const myInvestments = db.investments.filter((inv) => inv.user_id === user.id);
  res.json({ investments: myInvestments });
});

// Start an Investment Plan
app.post("/api/investments/create", (req, res) => {
  const { planId } = req.body;
  if (!planId) return res.status(400).json({ error: "Plan ID is required." });

  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const plan = db.plans.find((p) => p.id === planId && p.active);
  if (!plan) return res.status(404).json({ error: "Plan not found or inactive." });

  const balanceData = calculateBalance(user.id, db.transactions);
  if (balanceData.available_balance < plan.amount) {
    return res.status(400).json({ error: "Your available balance is not enough. Please deposit KSh first!" });
  }

  // Create Investment Record
  const now = new Date();
  const matures = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

  const newInvestment: ServerInvestment = {
    id: "inv-" + Math.random().toString(36).substr(2, 9),
    user_id: user.id,
    plan_id: plan.id,
    amount: plan.amount,
    return_amount: plan.return_amount,
    profit: plan.return_amount - plan.amount,
    status: "active",
    created_at: now.toISOString(),
    matures_at: matures.toISOString(),
    planName: plan.name
  };

  db.investments.push(newInvestment);

  // Deduct deposit by pushing an Approved investment Transaction (it acts as a negative subtraction in available_balance)
  db.transactions.push({
    id: "tx-" + Math.random().toString(36).substr(2, 9),
    user_id: user.id,
    amount: plan.amount,
    transaction_type: "investment",
    status: "approved",
    note: `Started Plan: ${plan.name}`,
    created_at: now.toISOString()
  });

  // Commission Reward Logic if the current user has referred_by set
  if (user.referredBy) {
    const referrer = db.users.find((u) => u.id === user.referredBy);
    if (referrer) {
      // Bonus: 8% of plan investment or Ksh 50, whichever is higher
      const bonus = Math.max(50, Math.round(plan.amount * 0.08));

      // Log Referral connection & award COMMISSION transaction
      const refId = "ref-" + Math.random().toString(36).substr(2, 9);
      db.referrals.push({
        id: refId,
        referrer_id: referrer.id,
        referred_user_id: user.id,
        referred_username: user.username,
        bonus: bonus,
        created_at: now.toISOString()
      });

      db.transactions.push({
        id: "tx-" + Math.random().toString(36).substr(2, 9),
        user_id: referrer.id,
        amount: bonus,
        transaction_type: "commission",
        status: "approved",
        note: `Referrer Commission from ${user.username} - Plan ${plan.name}`,
        created_at: now.toISOString()
      });
    }
  }

  saveDatabase(db);
  res.json({ success: true, investment: newInvestment });
});

// Transactions Log
app.get("/api/transactions", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const myTxs = db.transactions.filter((t) => t.user_id === user.id);
  res.json({ transactions: myTxs });
});

// -------------------------------------------------------------
// I&M BANK OTG INTEGRATION HELPER
// -------------------------------------------------------------
interface ImBankTransferResult {
  success: boolean;
  referenceId?: string;
  gatewayMessage?: string;
  error?: string;
}

async function triggerImBankDeposit(
  amount: number,
  phone: string,
  txId: string,
  username: string
): Promise<ImBankTransferResult> {
  const apiKey = process.env.IMBANK_API_KEY;
  const clientId = process.env.IMBANK_CLIENT_ID;
  const clientSecret = process.env.IMBANK_CLIENT_SECRET;
  const baseUrl = process.env.IMBANK_API_BASE_URL || "https://api.sandbox.imbankgroup.com";
  const customSubscriptionKey = process.env.IMBANK_SUBSCRIPTION_KEY;
  const merchantAccount = process.env.IMBANK_MERCHANT_ACCOUNT || "1002003004";

  console.log(`[I&M Bank] Attempting pay integration for ${phone} - KSh ${amount}. ID: ${txId}`);

  // Base headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  // Add subscription keys/api keys to request headers if present
  const apimKey = apiKey || customSubscriptionKey;
  if (apimKey) {
    headers["Ocp-Apim-Subscription-Key"] = apimKey;
    headers["X-API-Key"] = apimKey;
  }

  try {
    let authToken = "";

    // 1. Handle OAuth token flow if client credentials are provided
    if (clientId && clientSecret) {
      console.log("[I&M Bank] Exchanging client credentials for Access Token...");
      const tokenUrl = `${baseUrl.replace(/\/$/, "")}/identity/v1/oauth2/token`;
      
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
          ...(apimKey ? { "Ocp-Apim-Subscription-Key": apimKey } : {})
        },
        body: "grant_type=client_credentials"
      });

      if (tokenResponse.ok) {
        const tokenData: any = await tokenResponse.json();
        authToken = tokenData.access_token || "";
        console.log("[I&M Bank] Received JWT token.");
      } else {
        const errText = await tokenResponse.text();
        console.warn(`[I&M Bank Token Exchange Failed] HTTP ${tokenResponse.status}: ${errText}`);
      }
    }

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    } else if (apiKey) {
      // If we don't have OAuth but have a direct API key, use it in Bearer form
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // 2. Prepare payload for the mobile money C2B request / STK Push via I&M OTG APIs
    const payload = {
      merchant_account: merchantAccount,
      transaction_reference: txId,
      amount: amount,
      currency: "KES",
      customer_payment_channel: "MPESA",
      customer_phone: phone,
      callback_url: `https://ela-invest.vercel.app/api/callbacks/imbank`,
      narrative: `HelaVest deposit for ${username}`,
      metadata: {
        user_id: username,
        reference: txId
      }
    };

    const imResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/payments/v1/mobile-checkout`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    const bodyText = await imResponse.text();
    console.log(`[I&M Bank API Response] Code ${imResponse.status}:`, bodyText);

    if (imResponse.ok) {
      const data = JSON.parse(bodyText);
      return {
        success: true,
        referenceId: data.transaction_reference || data.reference || txId,
        gatewayMessage: data.message || "I&M STK checkout simulation push generated successfully. Please unlock and enter M-Pesa PIN."
      };
    } else {
      return {
        success: false,
        error: `I&M API responded with status ${imResponse.status}: ${bodyText}`
      };
    }
  } catch (error: any) {
    console.error("[I&M Bank Transfer Exception]:", error);
    return {
      success: false,
      error: error.message || "Network error when contacting I&M Bank OTG servers."
    };
  }
}

// Submit a Deposit
app.post("/api/transactions/deposit", async (req, res) => {
  const { amount, phone, note } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "Please provide a valid deposit amount." });
  if (!phone) return res.status(400).json({ error: "Please enter your M-Pesa phone number." });

  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // Admin dynamic deposit limits check (in KES base unit)
  const minDeposit = db.paymentSettings?.min_deposit;
  const maxDeposit = db.paymentSettings?.max_deposit;
  if (minDeposit !== undefined && minDeposit !== null && minDeposit > 0) {
    if (Number(amount) < minDeposit) {
      return res.status(400).json({ error: `Selected deposit amount is below the dynamic administrative minimum of KSh ${minDeposit.toLocaleString()}.` });
    }
  } else {
    // Default fallback hard limit
    if (Number(amount) < 100) {
      return res.status(400).json({ error: "Minimum allowed deposit is KSh 100." });
    }
  }
  if (maxDeposit !== undefined && maxDeposit !== null && maxDeposit > 0) {
    if (Number(amount) > maxDeposit) {
      return res.status(400).json({ error: `Selected deposit amount exceeds the dynamic administrative maximum of KSh ${maxDeposit.toLocaleString()}.` });
    }
  }

  // Admin Toggle Check
  const mpesaEnabled = db.paymentSettings?.mpesa_enabled ?? true;
  if (!mpesaEnabled) {
    return res.status(400).json({ error: "M-Pesa deposits are currently disabled by the administrator. Please pay using Crypto / NOWPayments!" });
  }

  const pendingExists = db.transactions.some(
    (t) => t.user_id === user.id && t.transaction_type === "deposit" && t.status === "pending"
  );
  if (pendingExists) {
    return res.status(400).json({ error: "You already have a pending deposit request. Please wait for the admin to approve it." });
  }

  const txId = "tx-" + Math.random().toString(36).substr(2, 9);
  
  // Choose payment integration
  const apiUnifiedKey = process.env.IMBANK_API_KEY;
  const imClientId = process.env.IMBANK_CLIENT_ID;
  const imClientSecret = process.env.IMBANK_CLIENT_SECRET;
  const lipiaKey = process.env.LIPIA_API_KEY;

  let gatewayUsed = "None (Simulated Sandbox)";
  let userNotificationMsg = "Deposit requested successfully! Please trigger administrative approval in the Admin Hub.";

  if (apiUnifiedKey || (imClientId && imClientSecret)) {
    // Attempt I&M Bank Live OTG payment initiation
    const result = await triggerImBankDeposit(Number(amount), phone, txId, user.username);
    if (result.success) {
      gatewayUsed = "I&M Bank API Gateway";
      userNotificationMsg = result.gatewayMessage || `I&M Bank payment prompt initiated successfully on ${phone}. Standard settlement holds.`;
    } else {
      console.warn(`[I&M GATEWAY WARNING] Direct API call returned error: ${result.error}. Defaulting with Sandbox simulation fallback trace.`);
      gatewayUsed = "I&M Sandbox Simulation (API Mismatch Fallback)";
      userNotificationMsg = `[I&M Bank Integration Connected] Credentials registered. Direct checkout returned an error (${result.error || "Access Denied"}). A mock pending deposit request has been registered under sandbox mode so you are safe to test this in the Admin Hub!`;
    }
  } else if (lipiaKey) {
    // Lipia Online M-Pesa push fallback trace
    try {
      const lipiaResponse = await fetch('https://lipia-api.kreativelabske.com/api/v2/payments/stk-push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lipiaKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone_number: phone,
          amount: Number(amount),
          external_reference: txId,
          metadata: {
            user_id: user.id,
            username: user.username
          }
        })
      });
      const lipiaResult = await lipiaResponse.json();
      if (lipiaResult.success) {
        gatewayUsed = "Lipia Online STK Push";
        userNotificationMsg = lipiaResult.customerMessage || "M-Pesa payment prompt sent to your phone. Enter PIN to complete deposit.";
      } else {
        console.error("Lipia API Failure:", lipiaResult);
        gatewayUsed = "Lipia (Error State)";
        return res.status(400).json({ error: lipiaResult.customerMessage || "Failed to initiate M-Pesa payment prompt." });
      }
    } catch (err: any) {
      console.error("Error connecting to Lipia:", err);
      return res.status(500).json({ error: "Failed to connect to M-Pesa payment gateway." });
    }
  } else {
    // Sandbox simulation fallback mode
    gatewayUsed = "Hela Sandbox System Mode";
    userNotificationMsg = `[Sandbox Mode] Since neither LIPIA_API_KEY nor I&M credentials are live in environment, a simulated deposit request has been logged! Please switch to the "Admin Hub" to instantly approve this mock funding trace.`;
  }

  const newTx: ServerTransaction = {
    id: txId,
    user_id: user.id,
    amount: Number(amount),
    transaction_type: "deposit",
    status: "pending",
    phone: phone,
    note: note || `Wallet Topup (via ${gatewayUsed})`,
    created_at: new Date().toISOString()
  };

  db.transactions.push(newTx);
  saveDatabase(db);

  res.json({ success: true, transaction: newTx, message: userNotificationMsg });
});

// Lipia Online Callback Handler
app.post("/api/callbacks/lipia", (req, res) => {
  console.log("[Lipia Callback Received]:", JSON.stringify(req.body));
  const { success, status, data, external_reference, transaction_reference } = req.body;
  
  let reference = external_reference || transaction_reference;
  let isSuccess = success === true || status === "success" || status === "COMPLETED";
  
  if (data) {
    if (data.external_reference) reference = data.external_reference;
    else if (data.TransactionReference) reference = data.TransactionReference;
    else if (data.reference) reference = data.reference;
    
    if (data.status) {
      isSuccess = data.status === "success" || data.status === "COMPLETED" || data.status === 0;
    }
  }

  if (!reference) {
    console.warn("[Lipia Webhook] Missing reference in body.", req.body);
    return res.status(400).json({ error: "Missing reference" });
  }

  const db = getDatabase();
  const tx = db.transactions.find((t) => t.id === reference);
  if (!tx) {
    console.warn(`[Lipia Webhook] Transaction with reference ${reference} not found in database.`);
    return res.status(404).json({ error: "Transaction not found" });
  }

  if (tx.status !== "pending") {
    console.log(`[Lipia Webhook] Transaction ${reference} is already in state: ${tx.status}. Ignoring callback duplicate.`);
    return res.json({ success: true, message: "Already processed" });
  }

  if (isSuccess) {
    tx.status = "approved";
  } else {
    tx.status = "declined";
  }
  
  saveDatabase(db);
  console.log(`[Lipia Webhook] Transaction ${reference} updated successfully to: ${tx.status}`);
  res.json({ success: true, message: "Webhook processed successfully" });
});

// -------------------------------------------------------------
// NOWPAYMENTS CRYPTO INTEGRATION HELPER
// -------------------------------------------------------------
function getMockCryptoAddress(currency: string): string {
  const cur = currency.toLowerCase();
  if (cur.includes("trx") || cur.includes("trc20")) {
    return "TY8bV78v4zYmDe76Cdf9eR2B1A8X7vN3K2";
  }
  if (cur.includes("btc")) {
    return "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
  }
  if (cur.includes("eth") || cur.includes("erc20")) {
    return "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  }
  return "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE";
}

function generateLocalSandboxInvoice(amountUSD: number, cryptoCurrency: string, txId: string) {
  const normalizedCrypto = cryptoCurrency.toLowerCase();
  let cryptoRate = 1.0;
  if (normalizedCrypto.includes("usdt") || normalizedCrypto.includes("usdc")) {
    cryptoRate = 1.0;
  } else if (normalizedCrypto === "btc" || normalizedCrypto.includes("btc")) {
    cryptoRate = 0.000015;
  } else if (normalizedCrypto === "eth" || normalizedCrypto.includes("eth")) {
    cryptoRate = 0.00028;
  } else if (normalizedCrypto === "trx" || normalizedCrypto.includes("trx")) {
    cryptoRate = 8.5;
  }

  const mockPayAmount = Number((amountUSD * cryptoRate).toFixed(6));
  const mockPayAddress = getMockCryptoAddress(normalizedCrypto);

  return {
    success: true,
    payAddress: mockPayAddress,
    payAmount: mockPayAmount,
    paymentId: `nw-${Math.random().toString(36).substr(2, 9)}`,
    gatewayMessage: "🎉 Simulated sandbox invoice generated locally. Since Sandbox Mode is active in your system, you can test this payment flow utilizing the status checker or clear simulator seamlessly."
  };
}

async function triggerNowPaymentsDeposit(
  amountKES: number,
  cryptoCurrency: string,
  txId: string,
  username: string,
  db: DatabaseSchema
): Promise<{
  success: boolean;
  payAddress?: string;
  payAmount?: number;
  paymentId?: string;
  gatewayMessage?: string;
  error?: string;
}> {
  const apiKey = db.paymentSettings?.nowpayments_api_key || process.env.NOWPAYMENTS_API_KEY;
  const isSandbox = db.paymentSettings?.nowpayments_sandbox ?? false;

  // Calculate amount in USD (primary base currency for NOWPayments)
  const amountUSD = Number((amountKES / 130).toFixed(2));
  const normalizedCrypto = cryptoCurrency.toLowerCase();

  console.log(`[NOWPayments] Initiating payment. Amount KES: ${amountKES} (~$${amountUSD} USD). Crypto: ${cryptoCurrency}. TX: ${txId}. Sandbox Mode: ${isSandbox}.`);

  if (!apiKey) {
    if (isSandbox) {
      console.log("[NOWPayments] Sandbox enabled but API Key is missing. Falling back to local high-fidelity sandbox invoice simulation.");
      return generateLocalSandboxInvoice(amountUSD, normalizedCrypto, txId);
    }
    return {
      success: false,
      error: "NOWPayments API Key is not configured. Please define NOWPAYMENTS_API_KEY or set it in Admin Hub."
    };
  }

  // Live NOWPayments API Call
  try {
    const baseUrl = process.env.NOWPAYMENTS_BASE_URL || (isSandbox ? "https://api-sandbox.nowpayments.io/v1" : "https://api.nowpayments.io/v1");
    const ipnCallbackUrl = process.env.IPN_CALLBACK_URL || (process.env.APP_URL ? `${process.env.APP_URL}/api/callbacks/nowpayments` : "https://ais-dev-yb5liyh6fvh47qawmql43k-597530057912.europe-west2.run.app/api/callbacks/nowpayments");
    
    console.log(`[NOWPayments Production/Sandbox Request] Sending call to ${baseUrl}/payment with IPN URL: ${ipnCallbackUrl}`);

    const response = await fetch(`${baseUrl}/payment`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        price_amount: amountUSD,
        price_currency: "usd",
        pay_currency: normalizedCrypto,
        ipn_callback_url: ipnCallbackUrl,
        order_id: txId,
        order_description: `HelaVest Crypto Deposit for ${username}`
      })
    });

    const data: any = await response.json();
    console.log("[NOWPayments API Response]:", data);

    if (response.ok && data.payment_id) {
      return {
        success: true,
        payAddress: data.pay_address,
        payAmount: data.pay_amount,
        paymentId: data.payment_id,
        gatewayMessage: isSandbox
          ? "Simulated sandbox crypto deposit generated successfully via NOWPayments sandbox interface."
          : "Live crypto deposit generated successfully via NOWPayments production interface."
      };
    } else {
      if (isSandbox) {
        console.warn(`[NOWPayments Sandbox API Error]: ${data.message || 'HTTP ' + response.status}. Falling back to high-fidelity local simulation.`);
        return generateLocalSandboxInvoice(amountUSD, normalizedCrypto, txId);
      }
      return {
        success: false,
        error: data.message || `NOWPayments API Error: HTTP ${response.status}`
      };
    }
  } catch (err: any) {
    console.error("[NOWPayments Connection Exception]:", err);
    if (isSandbox) {
      console.log("[NOWPayments Connection Exception Sandbox Fallback]: Falling back to high-fidelity local simulation.");
      return generateLocalSandboxInvoice(amountUSD, normalizedCrypto, txId);
    }
    return {
      success: false,
      error: err.message || "Failed to establish secure connection with NOWPayments network."
    };
  }
}

// -------------------------------------------------------------
// NOWPAYMENTS CRYPTO PAYOUT/WITHDRAWAL HELPER
// -------------------------------------------------------------
async function triggerNowPaymentsPayout(
  amountKES: number,
  cryptoCurrency: string,
  payoutAddress: string,
  txId: string,
  db: DatabaseSchema
): Promise<{
  success: boolean;
  payoutId?: string;
  error?: string;
}> {
  const apiKey = db.paymentSettings?.nowpayments_api_key || process.env.NOWPAYMENTS_API_KEY;
  const isSandbox = db.paymentSettings?.nowpayments_sandbox ?? false;

  const amountUSD = Number((amountKES / 130).toFixed(2));
  const normalizedCrypto = cryptoCurrency.toLowerCase();

  console.log(`[NOWPayments Payout] Preparing payout. Amount KES: ${amountKES} (~$${amountUSD} USD). Crypto: ${cryptoCurrency}. Destination: ${payoutAddress}. Sandbox Mode: ${isSandbox}.`);

  if (!apiKey) {
    if (isSandbox) {
      console.log("[NOWPayments Payout] Sandbox active and API Key is missing. Simulating instant approved payouts.");
      return {
        success: true,
        payoutId: `payout-sim-${Math.random().toString(36).substr(2, 9)}`
      };
    }
    return {
      success: false,
      error: "NOWPayments API Key is not configured. Please define NOWPAYMENTS_API_KEY or configure it in Admin Hub."
    };
  }

  try {
    const baseUrl = process.env.NOWPAYMENTS_BASE_URL || (isSandbox ? "https://api-sandbox.nowpayments.io/v1" : "https://api.nowpayments.io/v1");
    
    // Perform standard NOWPayments payout request
    const response = await fetch(`${baseUrl}/payout`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        withdrawals: [
          {
            address: payoutAddress,
            amount: amountUSD,
            currency: normalizedCrypto
          }
        ]
      })
    });

    const data: any = await response.json();
    console.log("[NOWPayments Payout API Response]:", data);

    if (response.ok && (data.id || data.payout_id || data.success)) {
      return {
        success: true,
        payoutId: data.id || data.payout_id || "payout-live-ok"
      };
    } else {
      if (isSandbox) {
        console.warn(`[NOWPayments Sandbox Payout API Error]: ${data.message || 'HTTP ' + response.status}. Simulating approved payout.`);
        return {
          success: true,
          payoutId: `payout-sim-${Math.random().toString(36).substr(2, 9)}`
        };
      }
      return {
        success: false,
        error: data.message || `NOWPayments Payout API error: HTTP ${response.status}`
      };
    }
  } catch (err: any) {
    console.error("[NOWPayments Payout Connection Exception]:", err);
    if (isSandbox) {
      console.log("[NOWPayments Payout Connection Exception Sandbox Fallback]: Simulating approved payout.");
      return {
        success: true,
        payoutId: `payout-sim-${Math.random().toString(36).substr(2, 9)}`
      };
    }
    return {
      success: false,
      error: err.message || "Failed to dispatch payload to NOWPayments Payout network."
    };
  }
}

// -------------------------------------------------------------
// USER PAYMENT SETTINGS & CRYPTO DEPOSIT ROUTINGS
// -------------------------------------------------------------

// Fetch Active Public Payment Settings
app.get("/api/payment-settings", (req, res) => {
  const db = getDatabase();
  res.json({
    paymentSettings: {
      mpesa_enabled: db.paymentSettings?.mpesa_enabled ?? true,
      crypto_enabled: db.paymentSettings?.crypto_enabled ?? true,
      nowpayments_sandbox: db.paymentSettings?.nowpayments_sandbox ?? false,
      min_deposit: db.paymentSettings?.min_deposit,
      max_deposit: db.paymentSettings?.max_deposit,
      min_withdrawal: db.paymentSettings?.min_withdrawal,
      max_withdrawal: db.paymentSettings?.max_withdrawal
    }
  });
});

// Create Crypto Deposit
app.post("/api/transactions/deposit-crypto", async (req, res) => {
  const { amount, cryptoCurrency, note } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Please enter a valid deposit amount." });
  }
  if (!cryptoCurrency) {
    return res.status(400).json({ error: "Please choose a cryptocurrency." });
  }

  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // Admin dynamic deposit limits check (in KES base unit)
  const minDeposit = db.paymentSettings?.min_deposit;
  const maxDeposit = db.paymentSettings?.max_deposit;
  if (minDeposit !== undefined && minDeposit !== null && minDeposit > 0) {
    if (Number(amount) < minDeposit) {
      return res.status(400).json({ error: `Selected deposit amount is below the dynamic administrative minimum of KSh ${minDeposit.toLocaleString()}.` });
    }
  } else {
    // Default fallback hard limit
    if (Number(amount) < 100) {
      return res.status(400).json({ error: "Minimum allowed deposit is KSh 100." });
    }
  }
  if (maxDeposit !== undefined && maxDeposit !== null && maxDeposit > 0) {
    if (Number(amount) > maxDeposit) {
      return res.status(400).json({ error: `Selected deposit amount exceeds the dynamic administrative maximum of KSh ${maxDeposit.toLocaleString()}.` });
    }
  }

  // Check admin settings
  const cryptoEnabled = db.paymentSettings?.crypto_enabled ?? true;
  if (!cryptoEnabled) {
    return res.status(400).json({ error: "Cryptocurrency deposits are currently deactivated by the administrator." });
  }

  const pendingExists = db.transactions.some(
    (t) => t.user_id === user.id && t.transaction_type === "deposit" && t.status === "pending"
  );
  if (pendingExists) {
    return res.status(400).json({ error: "You already have a pending deposit request. Please wait for previous request clearance." });
  }

  const txId = "tx-crypto-" + Math.random().toString(36).substr(2, 9);

  // Trigger NOWPayments initiation
  const result = await triggerNowPaymentsDeposit(Number(amount), cryptoCurrency, txId, user.username, db);

  if (!result.success) {
    return res.status(400).json({ error: result.error || "Failed to generate crypto payment invoice." });
  }

  const newTx: any = {
    id: txId,
    user_id: user.id,
    amount: Number(amount),
    transaction_type: "deposit",
    status: "pending",
    phone: `Crypto (${cryptoCurrency.toUpperCase()})`,
    note: note || `Crypto Wallet Topup via NOWPayments`,
    created_at: new Date().toISOString(),
    // Store metadata
    crypto_address: result.payAddress,
    crypto_amount: result.payAmount,
    crypto_currency: cryptoCurrency.toUpperCase(),
    payment_id: result.paymentId
  };

  db.transactions.push(newTx);
  saveDatabase(db);

  res.json({
    success: true,
    transaction: newTx,
    message: result.gatewayMessage || "Crypto payment prompt initialized.",
    paymentDetails: {
      payAddress: result.payAddress,
      payAmount: result.payAmount,
      paymentId: result.paymentId,
      cryptoCurrency: cryptoCurrency.toUpperCase(),
      priceAmountUSD: Number((amount / 130).toFixed(2))
    }
  });
});

// Fetch active pending crypto invoice session for user
app.get("/api/transactions/active-crypto", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const activeTx = db.transactions.find(
    (t) => t.user_id === user.id && t.transaction_type === "deposit" && t.status === "pending" && t.payment_id
  );

  if (!activeTx) {
    return res.json({ hasActive: false });
  }

  res.json({
    hasActive: true,
    paymentDetails: {
      payAddress: activeTx.crypto_address,
      payAmount: activeTx.crypto_amount,
      paymentId: activeTx.payment_id,
      cryptoCurrency: activeTx.crypto_currency || "USDTTRC20",
      priceAmountUSD: Number((activeTx.amount / 130).toFixed(2)),
      txId: activeTx.id
    }
  });
});

// Self-cancel pending deposit transaction
app.post("/api/transactions/cancel-pending-deposit", (req, res) => {
  const { txId } = req.body;
  if (!txId) {
    return res.status(400).json({ error: "Missing transaction ID." });
  }

  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const txIndex = db.transactions.findIndex(
    (t) => t.id === txId && t.user_id === user.id && t.status === "pending"
  );

  if (txIndex === -1) {
    return res.status(404).json({ error: "No active pending deposit found with that ID." });
  }

  db.transactions[txIndex].status = "declined";
  db.transactions[txIndex].note = (db.transactions[txIndex].note || "") + " (Self-Cancelled)";
  saveDatabase(db);

  res.json({ success: true, message: "Pending deposit session cancelled. You can now initialize a new one." });
});

// NOWPayments IPN Webhook Receiver
app.post("/api/callbacks/nowpayments", (req, res) => {
  console.log("[NOWPayments IPN Webhook Received]:", JSON.stringify(req.body));
  
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  const receivedSign = req.headers["x-nowpayments-sig"] || req.headers["X-Nowpayments-Sig"];
  
  if (ipnSecret && receivedSign) {
    try {
      // NOWPayments expects HMAC-SHA512 of sorted keys in alphabetical order
      const sortedKeys = Object.keys(req.body).sort();
      const sortedBody = sortedKeys.reduce((obj: any, key: string) => {
        obj[key] = req.body[key];
        return obj;
      }, {});
      
      const hmac = crypto.createHmac("sha512", ipnSecret);
      const calculatedSign = hmac.update(JSON.stringify(sortedBody)).digest("hex");
      
      if (calculatedSign !== receivedSign) {
        console.error(`[NOWPayments IPN Callback Warning] Invalid Signature verification! Calculated: ${calculatedSign}, Received: ${receivedSign}`);
        return res.status(401).json({ error: "Invalid signature verification" });
      }
      console.log("[NOWPayments IPN Callback] Cryptographic signature verified successfully.");
    } catch (err: any) {
      console.error("[NOWPayments IPN Callback Exception parsing signature]:", err);
      return res.status(400).json({ error: "Failed to verify signature" });
    }
  } else {
    console.log("[NOWPayments IPN Callback] Generic mode or local dev. Skipping signature verification due to missing NOWPAYMENTS_IPN_SECRET or x-nowpayments-sig header.");
  }

  const { payment_status, order_id } = req.body;
  
  if (!order_id) {
    return res.status(400).json({ error: "Missing order_id reference." });
  }

  const db = getDatabase();
  const tx = db.transactions.find((t) => t.id === order_id);
  if (!tx) {
    console.warn(`[NOWPayments IPN] Transaction with order_id ${order_id} not found.`);
    return res.status(404).json({ error: "Transaction not found." });
  }

  if (tx.status !== "pending") {
    console.log(`[NOWPayments IPN] Transaction ${order_id} already in state: ${tx.status}. Ignoring callback.`);
    return res.json({ success: true, message: "Already processed" });
  }

  if (payment_status === "confirmed" || payment_status === "finished") {
    tx.status = "approved";
  } else if (payment_status === "failed" || payment_status === "expired") {
    tx.status = "declined";
  }

  saveDatabase(db);
  console.log(`[NOWPayments IPN] Transaction ${order_id} updated successfully to: ${tx.status}`);
  res.json({ success: true, message: "IPN processed successfully." });
});

// Simulate Crypto Clearance Instant in Sandbox
app.post("/api/transactions/:id/simulate-sandbox-clear", (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  const tx = db.transactions.find((t) => t.id === id);
  if (!tx) return res.status(404).json({ error: "Transaction not found." });
  
  if (tx.status !== "pending") {
    return res.status(400).json({ error: "Transaction is already processed." });
  }

  tx.status = "approved";
  saveDatabase(db);
  
  res.json({ success: true, message: "Sandbox blockchain simulation completed! Your deposit was approved and cleared." });
});

// Live Check Crypto Invoice Status via NOWPayments API
app.post("/api/transactions/:id/check-crypto-status", async (req, res) => {
  const { id } = req.params;
  const db = getDatabase();

  const tx = db.transactions.find((t) => t.id === id);
  if (!tx) return res.status(404).json({ error: "Transaction not found." });

  if (tx.status !== "pending") {
    return res.json({
      success: true,
      status: tx.status,
      message: `Transaction is already ${tx.status}. Balance has been adjusted accordingly.`
    });
  }

  const paymentId = tx.payment_id;
  if (!paymentId) {
    return res.status(400).json({ error: "No NOWPayments invoice reference associated with this transaction." });
  }

  const isSandbox = db.paymentSettings?.nowpayments_sandbox ?? false;

  // If Sandbox simulated payment was created (starts with nw-)
  if (paymentId.startsWith("nw-")) {
    tx.status = "approved";
    saveDatabase(db);
    return res.json({
      success: true,
      status: "approved",
      message: "🎉 Blockchain network confirmation processed! Your cryptocurrency transfer has been successfully verified and cleared on the ledger."
    });
  }

  // Live NOWPayments Check
  try {
    const apiKey = db.paymentSettings?.nowpayments_api_key || process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "Live payment settings are incomplete. Admin API Key is missing." });
    }

    const baseUrl = isSandbox ? "https://api-sandbox.nowpayments.io/v1" : "https://api.nowpayments.io/v1";
    console.log(`[NOWPayments Status Check] Fetching ${baseUrl}/payment/${paymentId}`);

    const response = await fetch(`${baseUrl}/payment/${paymentId}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[NOWPayments Status Check Error]: HTTP ${response.status} - ${errText}`);
      return res.status(response.status).json({
        error: `Could not retrieve status from NOWPayments. API response: ${errText}`
      });
    }

    const data: any = await response.json();
    console.log("[NOWPayments Status Response]:", data);

    const status = data.payment_status;

    if (status === "confirmed" || status === "finished") {
      tx.status = "approved";
      saveDatabase(db);
      return res.json({
        success: true,
        status: "approved",
        message: "🎉 Success! NOWPayments confirmed your transfer. Your account balance has been successfully updated by the system."
      });
    } else if (status === "failed" || status === "expired") {
      tx.status = "declined";
      saveDatabase(db);
      return res.json({
        success: true,
        status: "declined",
        message: `Your payment request was marked as '${status}' by the gateway.`
      });
    } else {
      return res.json({
        success: false,
        status: status,
        message: `Your digital asset transfer is currently in "${status}" state. Please wait a short while for blockchain network confirmation of receipt.`
      });
    }
  } catch (err: any) {
    console.error("[NOWPayments Check Exception]:", err);
    return res.status(500).json({ error: "Failed to connect to the external NOWPayments network: " + err.message });
  }
});

// -------------------------------------------------------------
// SECURE ADMIN PAYMENT CONFIGS ENDPOINTS
// -------------------------------------------------------------

app.get("/api/admin/payment-settings", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }
  res.json({
    paymentSettings: db.paymentSettings,
    envDetected: {
      nowpayments_api_key_set: !!process.env.NOWPAYMENTS_API_KEY,
      nowpayments_base_url: process.env.NOWPAYMENTS_BASE_URL || "https://api.nowpayments.io/v1",
      nowpayments_base_url_set: !!process.env.NOWPAYMENTS_BASE_URL,
      ipn_callback_url: process.env.IPN_CALLBACK_URL || ""
    }
  });
});

app.get("/api/admin/neon/status", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const rawUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
  let maskedString = "No Neon DATABASE_URL variable set in server environment";
  
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      parsed.password = "••••••••";
      maskedString = parsed.toString();
    } catch (e) {
      maskedString = "postgresql://*****@ep-xxxx.us-east-1.aws.neon.tech/neondb";
    }
  }

  res.json({
    useNeon,
    maskedUrl: maskedString,
    error: neonError,
    activeProvider: useNeon ? "Neon Serverless Postgres (Cloud)" : "Local JSON Storage (server_db.json)",
    hasEnv: !!rawUrl
  });
});

app.post("/api/admin/payment-settings", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }
  const { mpesa_enabled, crypto_enabled, nowpayments_sandbox, nowpayments_api_key, min_deposit, max_deposit, min_withdrawal, max_withdrawal } = req.body;
  
  db.paymentSettings = {
    mpesa_enabled: mpesa_enabled !== undefined ? !!mpesa_enabled : (db.paymentSettings?.mpesa_enabled ?? true),
    crypto_enabled: crypto_enabled !== undefined ? !!crypto_enabled : (db.paymentSettings?.crypto_enabled ?? true),
    nowpayments_sandbox: nowpayments_sandbox !== undefined ? !!nowpayments_sandbox : (db.paymentSettings?.nowpayments_sandbox ?? false),
    nowpayments_api_key: nowpayments_api_key !== undefined ? nowpayments_api_key : (db.paymentSettings?.nowpayments_api_key || ""),
    min_deposit: min_deposit !== undefined ? (min_deposit === "" || min_deposit === null || isNaN(Number(min_deposit)) ? undefined : Number(min_deposit)) : db.paymentSettings?.min_deposit,
    max_deposit: max_deposit !== undefined ? (max_deposit === "" || max_deposit === null || isNaN(Number(max_deposit)) ? undefined : Number(max_deposit)) : db.paymentSettings?.max_deposit,
    min_withdrawal: min_withdrawal !== undefined ? (min_withdrawal === "" || min_withdrawal === null || isNaN(Number(min_withdrawal)) ? undefined : Number(min_withdrawal)) : db.paymentSettings?.min_withdrawal,
    max_withdrawal: max_withdrawal !== undefined ? (max_withdrawal === "" || max_withdrawal === null || isNaN(Number(max_withdrawal)) ? undefined : Number(max_withdrawal)) : db.paymentSettings?.max_withdrawal
  };
  
  saveDatabase(db);
  res.json({
    success: true,
    paymentSettings: db.paymentSettings,
    envDetected: {
      nowpayments_api_key_set: !!process.env.NOWPAYMENTS_API_KEY,
      nowpayments_base_url: process.env.NOWPAYMENTS_BASE_URL || "https://api.nowpayments.io/v1",
      nowpayments_base_url_set: !!process.env.NOWPAYMENTS_BASE_URL,
      ipn_callback_url: process.env.IPN_CALLBACK_URL || ""
    },
    message: "Gateway settings updated successfully."
  });
});

// Submit a Withdrawal
app.post("/api/transactions/withdraw", (req, res) => {
  const { amount, phone, note, crypto_address, crypto_currency } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "Please enter a valid withdrawal amount." });
  if (!phone) return res.status(400).json({ error: "Please enter your destination details." });

  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const amtNum = Number(amount);

  // Administrative dynamic limit controls
  const minWithdrawal = db.paymentSettings?.min_withdrawal;
  const maxWithdrawal = db.paymentSettings?.max_withdrawal;

  if (minWithdrawal !== undefined && minWithdrawal !== null && minWithdrawal > 0) {
    if (amtNum < minWithdrawal) {
      return res.status(400).json({ error: `Withdrawal amount is below the administrative minimum of KSh ${minWithdrawal.toLocaleString()}.` });
    }
  }

  if (maxWithdrawal !== undefined && maxWithdrawal !== null && maxWithdrawal > 0) {
    if (amtNum > maxWithdrawal) {
      return res.status(400).json({ error: `Withdrawal amount is above the administrative maximum of KSh ${maxWithdrawal.toLocaleString()}.` });
    }
  }

  const balanceData = calculateBalance(user.id, db.transactions);
  if (amtNum > balanceData.available_balance) {
    return res.status(400).json({ error: "Withdrawal amount exceeds your available balance." });
  }

  const newTx: ServerTransaction = {
    id: "tx-" + Math.random().toString(36).substr(2, 9),
    user_id: user.id,
    amount: amtNum,
    transaction_type: "withdrawal",
    status: "pending",
    phone: phone,
    note: note || "Withdrawal request",
    created_at: new Date().toISOString(),
    crypto_address: crypto_address,
    crypto_currency: crypto_currency
  };

  db.transactions.push(newTx);
  saveDatabase(db);

  res.json({ success: true, transaction: newTx });
});

// Get Referral List
app.get("/api/referrals", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const myRefs = db.referrals.filter((r) => r.referrer_id === user.id);
  res.json({ referrals: myRefs });
});

// Simulation Fast Forward (Awesome feature for interactive reviews!)
app.post("/api/simulate/fast-forward", (req, res) => {
  const { days } = req.body;
  if (!days || days <= 0) return res.status(400).json({ error: "Provide positive days limit." });

  const db = getDatabase();
  db.systemOffsetDays += days;

  // Let's modify all ACTIVE investments' matures_at and created_at to be earlier
  // by days, OR we can let completeMaturedTradeJobs work with the virtual system offset.
  // Actually, let's offset all ACTIVE investments' timestamps by days to fast forward!
  // This physically alters dates, making it crystal clear in UI!
  const offsetMs = days * 24 * 60 * 60 * 1000;
  for (const inv of db.investments) {
    if (inv.status === "active") {
      const originalMatures = new Date(inv.matures_at).getTime();
      const originalCreated = new Date(inv.created_at).getTime();
      inv.matures_at = new Date(originalMatures - offsetMs).toISOString();
      inv.created_at = new Date(originalCreated - offsetMs).toISOString();
    }
  }

  // Also offset transaction items dates
  for (const t of db.transactions) {
    const originalTime = new Date(t.created_at).getTime();
    t.created_at = new Date(originalTime - offsetMs).toISOString();
  }

  const { completedCount } = completeMaturedTradeJobs(db);
  saveDatabase(db);

  res.json({ success: true, message: `Simulated ${days} days into the future! ${completedCount} investments matured and payouts dispersed!`, offset: db.systemOffsetDays });
});

// Reset Sandbox Database to defaults
app.post("/api/admin/reset", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }
  const resetDb: DatabaseSchema = {
    users: DEFAULT_USERS,
    plans: DEFAULT_PLANS,
    investments: DEFAULT_INVESTMENTS,
    transactions: DEFAULT_TRANSACTIONS,
    referrals: [],
    systemOffsetDays: 0,
    paymentSettings: db.paymentSettings
  };
  saveDatabase(resetDb);
  res.json({ success: true, message: "Sandbox database restored to clean defaults." });
});


// -------------------------------------------------------------
// ADMINISTRATIVE OPERATIONS (Saves manual DB editing in AI Studio!)
// -------------------------------------------------------------

// List All Transactions
app.get("/api/admin/transactions", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }
  // We can enrich each transaction with Username
  const enriched = db.transactions.map((t) => {
    const matchedUser = db.users.find((u) => u.id === t.user_id);
    return {
      ...t,
      username: matchedUser ? matchedUser.username : "Unknown User"
    };
  });
  res.json({ transactions: enriched });
});

// Approve Pending Transaction
app.post("/api/admin/transactions/:id/approve", async (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const tx = db.transactions.find((t) => t.id === id);
  if (!tx) return res.status(404).json({ error: "Transaction not found." });

  if (tx.status !== "pending") {
    return res.status(400).json({ error: "Transaction is already processed." });
  }

  // If it's a cryptocurrency withdrawal, execute live payout on NOWPayments
  if (tx.transaction_type === "withdrawal" && tx.crypto_address && tx.crypto_currency) {
    const payoutResult = await triggerNowPaymentsPayout(tx.amount, tx.crypto_currency, tx.crypto_address, tx.id, db);
    if (!payoutResult.success) {
      return res.status(400).json({ error: `NOWPayments Payout Failed: ${payoutResult.error}` });
    }
    tx.payment_id = payoutResult.payoutId;
    tx.note = (tx.note || "") + ` (NOWPayments Payout: ${payoutResult.payoutId})`;
  }

  tx.status = "approved";
  saveDatabase(db);
  res.json({ success: true, message: "Transaction approved successfully!" });
});

// Decline Pending Transaction
app.post("/api/admin/transactions/:id/decline", (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const tx = db.transactions.find((t) => t.id === id);
  if (!tx) return res.status(404).json({ error: "Transaction not found." });

  if (tx.status !== "pending") {
    return res.status(400).json({ error: "Transaction is already processed." });
  }

  tx.status = "declined";
  saveDatabase(db);
  res.json({ success: true, message: "Transaction declined." });
});

// List All Investments (Admin View)
app.get("/api/admin/investments", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }
  const enriched = db.investments.map((inv) => {
    const matchedUser = db.users.find((u) => u.id === inv.user_id);
    return {
      ...inv,
      username: matchedUser ? matchedUser.username : "Unknown"
    };
  });
  res.json({ investments: enriched });
});

// Force Complete Investment Early
app.post("/api/admin/investments/:id/complete", (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const inv = db.investments.find((i) => i.id === id);
  if (!inv) return res.status(404).json({ error: "Investment not found." });

  if (inv.status !== "active") {
    return res.status(400).json({ error: "Investment is not active." });
  }

  inv.status = "completed";

  // Check if payout transaction does not exist
  const hasPayout = db.transactions.some((t) => t.user_id === inv.user_id && t.transaction_type === "payout" && t.note?.includes(inv.id));
  if (!hasPayout) {
    db.transactions.push({
      id: "tx-pay-" + Math.random().toString(36).substr(2, 9),
      user_id: inv.user_id,
      amount: inv.return_amount,
      transaction_type: "payout",
      status: "approved",
      note: `Payout for ${inv.planName} #${inv.id} (Forced Complete)`,
      created_at: new Date().toISOString()
    });
  }

  saveDatabase(db);
  res.json({ success: true, message: "Investment forced to complete and payout dispersed." });
});

// Cancel Investment
app.post("/api/admin/investments/:id/cancel", (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const inv = db.investments.find((i) => i.id === id);
  if (!inv) return res.status(404).json({ error: "Investment not found." });

  if (inv.status !== "active") {
    return res.status(400).json({ error: "Investment is not active." });
  }

  inv.status = "cancelled";

  // Refund the deposit capital!
  db.transactions.push({
    id: "tx-" + Math.random().toString(36).substr(2, 9),
    user_id: inv.user_id,
    amount: inv.amount,
    transaction_type: "deposit",
    status: "approved",
    note: `Refund: Cancelled Investment ${inv.planName}`,
    created_at: new Date().toISOString()
  });

  saveDatabase(db);
  res.json({ success: true, message: "Investment cancelled and principal amount refunded to user." });
});

// Toggle Plan Active State
app.post("/api/admin/plans/:id/toggle", (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const plan = db.plans.find((p) => p.id === id);
  if (!plan) return res.status(404).json({ error: "Plan not found." });

  plan.active = !plan.active;
  saveDatabase(db);
  res.json({ success: true, message: `Plan ${plan.name} is now ${plan.active ? 'active' : 'inactive'}.` });
});

// Create Plan (Admin Mode)
app.post("/api/admin/plans/create", (req, res) => {
  const { name, amount, return_amount, duration_days, description } = req.body;
  if (!name || !amount || !return_amount || !duration_days) {
    return res.status(400).json({ error: "Please enter all details for the investment package." });
  }

  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const newPlan: ServerPlan = {
    id: `p-${Date.now()}`,
    name,
    amount: Number(amount),
    return_amount: Number(return_amount),
    duration_days: Number(duration_days),
    active: true,
    description: description || ""
  };

  db.plans.push(newPlan);
  saveDatabase(db);
  res.json({ success: true, plan: newPlan });
});

app.post("/api/admin/plans/:id/delete", (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }
  
  const index = db.plans.findIndex((p) => p.id === id);
  if (index === -1) return res.status(404).json({ error: "Plan not found." });

  db.plans.splice(index, 1);
  saveDatabase(db);
  res.json({ success: true });
});

app.post("/api/admin/plans/:id/edit", (req, res) => {
  const { id } = req.params;
  const { name, amount, return_amount, duration_days, description } = req.body;
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const plan = db.plans.find((p) => p.id === id);
  if (!plan) return res.status(404).json({ error: "Plan not found." });

  if (name) plan.name = name;
  if (amount) plan.amount = Number(amount);
  if (return_amount) plan.return_amount = Number(return_amount);
  if (duration_days) plan.duration_days = Number(duration_days);
  if (description !== undefined) plan.description = description;

  saveDatabase(db);
  res.json({ success: true, plan });
});

// Admin Users list
app.get("/api/admin/users", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }
  const summary = db.users.map((u) => {
    const bal_sum = calculateBalance(u.id, db.transactions);
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      phone: u.phone,
      referralCode: u.referralCode,
      referredBy: u.referredBy,
      isAdmin: u.isAdmin,
      password: u.passwordHash,
      balance: bal_sum.available_balance
    };
  });
  res.json({ users: summary });
});

// Admin: Edit a user's details directly
app.post("/api/admin/users/:id/edit", (req, res) => {
  const { id } = req.params;
  const { username, email, phone, password, isAdmin } = req.body;
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const targetId = id;
  const targetUserObj = db.users.find((u) => u.id === targetId);
  if (!targetUserObj) {
    return res.status(404).json({ error: "Target member not found." });
  }

  if (username && username !== targetUserObj.username) {
    const exists = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.id !== targetId);
    if (exists) return res.status(400).json({ error: "A member with this username already exists." });
    targetUserObj.username = username;
  }

  if (email && email !== targetUserObj.email) {
    const exists = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== targetId);
    if (exists) return res.status(400).json({ error: "A member with this email already exists." });
    targetUserObj.email = email;
  }

  if (phone && phone !== targetUserObj.phone) {
    const exists = db.users.find((u) => u.phone === phone && u.id !== targetId);
    if (exists) return res.status(400).json({ error: "A member with this phone number already exists." });
    targetUserObj.phone = phone;
  }

  if (password !== undefined && password !== "") {
    targetUserObj.passwordHash = password;
  }

  if (isAdmin !== undefined) {
    targetUserObj.isAdmin = !!isAdmin;
  }

  saveDatabase(db);
  res.json({ success: true, message: "Member details updated successfully.", user: targetUserObj });
});

// Admin: Manipulate/Change or adjust user account balance directly
app.post("/api/admin/users/:id/adjust-balance", (req, res) => {
  const { id } = req.params;
  const { targetBalance, adjustmentAmount, adjustmentType, adjustmentNote } = req.body;
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const targetUserObj = db.users.find((u) => u.id === id);
  if (!targetUserObj) {
    return res.status(404).json({ error: "Target member not found in database." });
  }

  const currentBalRes = calculateBalance(id, db.transactions);
  const currentBal = currentBalRes.available_balance;

  if (targetBalance !== undefined && targetBalance !== null && targetBalance !== "") {
    const targetVal = Number(targetBalance);
    if (isNaN(targetVal)) {
      return res.status(400).json({ error: "Please enter a valid numeric value for target balance." });
    }
    const diff = targetVal - currentBal;
    if (diff === 0) {
      return res.json({ success: true, message: "Target balance matches current balance, no correction record needed." });
    }

    const newTx: ServerTransaction = {
      id: `tx-adj-${Date.now()}`,
      user_id: id,
      amount: Math.abs(diff),
      transaction_type: diff > 0 ? "deposit" : "withdrawal",
      status: "approved",
      phone: targetUserObj.phone || "Admin Ledger Auto-Balance Adjustment",
      note: adjustmentNote || `Administrative direct Balance override to match exactly ${targetVal} USD`,
      created_at: new Date().toISOString()
    };
    db.transactions.push(newTx);
  } else if (adjustmentAmount !== undefined && adjustmentAmount !== null && adjustmentAmount !== "") {
    const adjAmt = Number(adjustmentAmount);
    if (isNaN(adjAmt) || adjAmt <= 0) {
      return res.status(400).json({ error: "Please enter a valid positive adjustment amount value." });
    }
    const mode = adjustmentType || "credit";
    if (mode !== "credit" && mode !== "debit") {
      return res.status(400).json({ error: "Adjustment type must be either 'credit' or 'debit'." });
    }

    const newTx: ServerTransaction = {
      id: `tx-adj-${Date.now()}`,
      user_id: id,
      amount: adjAmt,
      transaction_type: mode === "credit" ? "deposit" : "withdrawal",
      status: "approved",
      phone: targetUserObj.phone || "Admin Ledger Auto-Balance Adjustment",
      note: adjustmentNote || `Administrative adjustment: ${mode === 'credit' ? 'Credited' : 'Debited'} ${adjAmt} USD`,
      created_at: new Date().toISOString()
    };
    db.transactions.push(newTx);
  } else {
    return res.status(400).json({ error: "Please specify either a Target Balance override or an Adjustment Amount." });
  }

  saveDatabase(db);
  res.json({ success: true, message: "Member wallet balance adjusted successfully." });
});


// Admin: Add new Member user directly to Database
app.post("/api/admin/users/create", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const { username, email, phone, password, initial_balance } = req.body;

  if (!username || !email || !phone || !password) {
    return res.status(400).json({ error: "Please enter all required fields: username, email, phone, and password." });
  }

  // Check if user already exists
  const exists = db.users.find(
    (u) =>
      u.username.toLowerCase() === username.toLowerCase() ||
      u.email.toLowerCase() === email.toLowerCase() ||
      u.phone === phone
  );
  if (exists) {
    return res.status(400).json({ error: "A member with this username, email, or phone number already exists." });
  }

  const targetId = `u-${Date.now()}`;
  const newUser: ServerUser = {
    id: targetId,
    username,
    email,
    phone,
    passwordHash: password, // plain text representation
    referralCode: "HELA" + Math.floor(100000 + Math.random() * 900000),
    isAdmin: false
  };

  db.users.push(newUser);

  // If initial_balance is specified and > 0, inject a manual approved deposit
  const balanceVal = Number(initial_balance);
  if (!isNaN(balanceVal) && balanceVal > 0) {
    const newTx: ServerTransaction = {
      id: `tx-${Date.now()}`,
      user_id: targetId,
      amount: balanceVal,
      transaction_type: "deposit",
      status: "approved",
      phone: phone || "Admin Load",
      note: "Administrative Initial Balance Credit Setup",
      created_at: new Date().toISOString()
    };
    db.transactions.push(newTx);
  }

  saveDatabase(db);
  res.json({ success: true, message: "Member successfully added to database.", user: newUser });
});


// Admin: Add new Ledger Transaction item directly to Database
app.post("/api/admin/transactions/create", (req, res) => {
  const db = getDatabase();
  const user = getAuthenticatedUser(req, db);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access only." });
  }

  const { target_user_id, amount, transaction_type, status, note, phone } = req.body;

  if (!target_user_id || !amount || !transaction_type || !status) {
    return res.status(400).json({ error: "Missing required fields: target user, amount, type, and status." });
  }

  const targetUserObj = db.users.find((u) => u.id === target_user_id);
  if (!targetUserObj) {
    return res.status(404).json({ error: "Target member not found." });
  }

  const amtNum = Number(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    return res.status(400).json({ error: "Please enter a valid amount greater than 0." });
  }

  const validTypes = ["deposit", "withdrawal", "investment", "commission", "payout"];
  if (!validTypes.includes(transaction_type)) {
    return res.status(400).json({ error: "Invalid transaction type." });
  }

  const validStatuses = ["pending", "approved", "declined"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid transaction status." });
  }

  const newTx: ServerTransaction = {
    id: `tx-m-${Date.now()}`,
    user_id: target_user_id,
    amount: amtNum,
    transaction_type: transaction_type as any,
    status: status as any,
    phone: phone || targetUserObj.phone || "Admin Entry",
    note: note || "Manual Administrative Ledger Record Injection",
    created_at: new Date().toISOString()
  };

  db.transactions.push(newTx);
  saveDatabase(db);

  res.json({ success: true, message: "Manual transaction recorded successfully in ledger.", transaction: newTx });
});


// -------------------------------------------------------------
// VITE DEV SERVER & PRODUCTION ROUTING PIPELINE
// -------------------------------------------------------------
async function startServer() {
  // Initialize Neon database support if connection string is configured
  await initNeonDatabase();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[HelaVest] Running full-stack on http://localhost:${PORT}`);
  });
}

startServer();
