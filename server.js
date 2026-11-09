const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_FILE = path.join(__dirname, "data.json");

// ===== Classes (نفس الكلاسات في كود C++) =====
class Person {
  constructor(name, age, phone) {
    this.name = name;
    this.age = age;
    this.phone = phone;
  }
}

class Doctor extends Person {
  constructor(id, name, age, phone, specialization) {
    super(name, age, phone);
    this.id = id;
    this.specialization = specialization;
  }
}

class Patient extends Person {
  constructor(name, age, phone, address) {
    super(name, age, phone);
    this.address = address;
  }
}

// ===== Data (map<int, Doctor> و vector<Patient>) =====
const doctors = new Map();
let patients = [];

function save() {
  const data = { doctors: [...doctors.values()], patients };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function load() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      (data.doctors || []).forEach((d) =>
        doctors.set(d.id, new Doctor(d.id, d.name, d.age, d.phone, d.specialization))
      );
      patients = (data.patients || []).map(
        (p) => new Patient(p.name, p.age, p.phone, p.address)
      );
      return;
    } catch (err) {
      console.error("Could not read data.json, starting with default data.");
    }
  }
  // بيانات مبدئية زي main() في كود C++
  doctors.set(1, new Doctor(1, "alaa", 21, "23627", "Cardiology"));
  patients.push(new Patient("salma", 21, "67890", "sohag"));
  save();
}

// ===== Helpers =====
function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const isText = (v) => typeof v === "string" && v.trim().length > 0;
const isAge = (v) => Number.isInteger(v) && v >= 0 && v <= 150;

// ===== API =====
async function handleApi(req, res, url) {
  const route = url.pathname;
  const method = req.method;

  // ---- Doctors ----
  if (route === "/api/doctors" && method === "GET") {
    return sendJson(res, 200, [...doctors.values()]);
  }

  if (route === "/api/doctors" && method === "POST") {
    const b = await readBody(req);
    if (!Number.isInteger(b.id)) return sendJson(res, 400, { error: "Invalid input, enter a number." });
    if (doctors.has(b.id)) return sendJson(res, 409, { error: "ID already exists." });
    if (!isText(b.name) || !isText(b.phone) || !isText(b.specialization) || !isAge(b.age)) {
      return sendJson(res, 400, { error: "Please fill all fields correctly." });
    }
    const d = new Doctor(b.id, b.name.trim(), b.age, b.phone.trim(), b.specialization.trim());
    doctors.set(d.id, d);
    save();
    return sendJson(res, 201, d);
  }

  const doctorMatch = route.match(/^\/api\/doctors\/(-?\d+)$/);
  if (doctorMatch && method === "GET") {
    const d = doctors.get(parseInt(doctorMatch[1], 10));
    if (!d) return sendJson(res, 404, { error: "Not found." });
    return sendJson(res, 200, d);
  }

  // ---- Patients ----
  if (route === "/api/patients" && method === "GET") {
    const name = url.searchParams.get("name");
    if (name !== null) {
      return sendJson(res, 200, patients.filter((p) => p.name === name.trim()));
    }
    return sendJson(res, 200, patients);
  }

  if (route === "/api/patients" && method === "POST") {
    const b = await readBody(req);
    if (!isText(b.name) || !isText(b.phone) || !isText(b.address) || !isAge(b.age)) {
      return sendJson(res, 400, { error: "Please fill all fields correctly." });
    }
    const p = new Patient(b.name.trim(), b.age, b.phone.trim(), b.address.trim());
    patients.push(p);
    save();
    return sendJson(res, 201, p);
  }

  if (route === "/api/patients/sort" && method === "POST") {
    patients.sort((a, b) => a.age - b.age);
    save();
    return sendJson(res, 200, patients);
  }

  return sendJson(res, 404, { error: "Route not found." });
}

// ===== Static files =====
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));

  // منع الوصول لملفات برة فولدر public
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  });
}

// ===== Server =====
load();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else if (req.method === "GET") {
      serveStatic(req, res, url);
    } else {
      res.writeHead(405);
      res.end("Method not allowed");
    }
  } catch (err) {
    const status = err.message === "Invalid JSON" || err.message === "Body too large" ? 400 : 500;
    sendJson(res, status, { error: err.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Hospital System running at http://localhost:${PORT}`);
});
