// ===== Helpers =====
const $ = (id) => document.getElementById(id);

let messageTimer;
function showMessage(text, type = "success") {
  const box = $("message");
  box.textContent = text;
  box.className = "message show " + type;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => (box.className = "message"), 3500);
}

// بنكلم السيرفر ونرجّع الـ JSON، ولو في خطأ بنرمي رسالته
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function renderRows(tbody, rows, columns, emptyText, highlight = false) {
  tbody.innerHTML = "";
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = columns;
    td.className = "empty";
    td.textContent = emptyText;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach((values) => {
    const tr = document.createElement("tr");
    if (highlight) tr.className = "highlight";
    values.forEach((v) => {
      const td = document.createElement("td");
      td.textContent = v; // textContent عشان نمنع حقن HTML
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ===== Render =====
function renderDoctors(list, highlight = false) {
  renderRows(
    $("doctors-body"),
    list.map((d) => [d.id, d.name, d.age, d.phone, d.specialization]),
    5,
    "No doctors.",
    highlight
  );
}

function renderPatients(list, highlight = false) {
  renderRows(
    $("patients-body"),
    list.map((p) => [p.name, p.age, p.phone, p.address]),
    4,
    "No patients.",
    highlight
  );
}

async function showDoctors() {
  try {
    renderDoctors(await api("/api/doctors"));
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function showPatients() {
  try {
    renderPatients(await api("/api/patients"));
  } catch (err) {
    showMessage(err.message, "error");
  }
}

// ===== Actions =====
async function addDoctor(e) {
  e.preventDefault();
  const form = e.target;
  try {
    await api("/api/doctors", {
      method: "POST",
      body: JSON.stringify({
        id: parseInt($("doctor-id").value, 10),
        name: $("doctor-name").value,
        age: parseInt($("doctor-age").value, 10),
        phone: $("doctor-phone").value,
        specialization: $("doctor-spec").value,
      }),
    });
    form.reset();
    await showDoctors();
    showMessage("Doctor added.");
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function addPatient(e) {
  e.preventDefault();
  const form = e.target;
  try {
    await api("/api/patients", {
      method: "POST",
      body: JSON.stringify({
        name: $("patient-name").value,
        age: parseInt($("patient-age").value, 10),
        phone: $("patient-phone").value,
        address: $("patient-address").value,
      }),
    });
    form.reset();
    await showPatients();
    showMessage("Patient added.");
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function searchDoctor(e) {
  e.preventDefault();
  const id = parseInt($("doctor-search-id").value, 10);
  try {
    const doctor = await api(`/api/doctors/${id}`);
    renderDoctors([doctor], true);
    showMessage(`Found: ${doctor.name} - ${doctor.specialization}`);
  } catch (err) {
    renderDoctors([]);
    showMessage(err.message, "error");
  }
}

async function searchPatient(e) {
  e.preventDefault();
  const name = $("patient-search-name").value.trim();
  try {
    const found = await api(`/api/patients?name=${encodeURIComponent(name)}`);
    renderPatients(found, found.length > 0);
    if (found.length === 0) return showMessage("Not found.", "error");
    showMessage(`Found ${found.length} patient(s).`);
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function sortPatientsByAge() {
  try {
    renderPatients(await api("/api/patients/sort", { method: "POST" }));
    showMessage("Patients sorted by age.");
  } catch (err) {
    showMessage(err.message, "error");
  }
}

// ===== Tabs =====
function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(tab.dataset.target).classList.add("active");
    });
  });
}

// ===== Init =====
$("doctor-form").addEventListener("submit", addDoctor);
$("patient-form").addEventListener("submit", addPatient);
$("doctor-search-form").addEventListener("submit", searchDoctor);
$("patient-search-form").addEventListener("submit", searchPatient);
$("doctor-search-reset").addEventListener("click", () => {
  $("doctor-search-id").value = "";
  showDoctors();
});
$("patient-search-reset").addEventListener("click", () => {
  $("patient-search-name").value = "";
  showPatients();
});
$("sort-patients").addEventListener("click", sortPatientsByAge);

setupTabs();
showDoctors();
showPatients();
