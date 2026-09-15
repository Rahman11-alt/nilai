/**
 * Logika Aplikasi Administrasi Siswa Frontend (CRUD & Interaksi)
 */

let studentData = [];
let deleteTargetId = null;
let importedRowsToSave = [];

// DOM Elements
const studentTableBody = document.getElementById("studentTableBody");
const searchInput = document.getElementById("searchInput");
const filterKelas = document.getElementById("filterKelas");
const recordInfo = document.getElementById("recordInfo");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");

// Dashboard Elements
const statTotal = document.getElementById("statTotal");
const statMale = document.getElementById("statMale");
const statFemale = document.getElementById("statFemale");
const statClasses = document.getElementById("statClasses");

// Modals
const modalForm = document.getElementById("modalForm");
const modalDetail = document.getElementById("modalDetail");
const modalDelete = document.getElementById("modalDelete");
const modalImport = document.getElementById("modalImport");
const studentForm = document.getElementById("studentForm");

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  loadData();
});

/**
 * Panggilan API Universal ke Google Apps Script Backend
 */
async function callApi(action, payload = {}) {
  if (!CONFIG.API_URL || CONFIG.API_URL.includes("YOUR_SCRIPT_ID_HERE")) {
    showToast("URL Web App belum dikonfigurasi di js/config.js!", "error");
    updateStatus(false, "Konfigurasi URL Belum Diisi");
    throw new Error("Web App URL belum disetting.");
  }

  showLoading(true);
  try {
    const bodyData = { action: action, ...payload };
    const response = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Gagal memproses request pada server.");
    }

    updateStatus(true, "Terhubung ke Google Sheets");
    return result;
  } catch (err) {
    console.error("API Call Exception:", err);
    updateStatus(false, "Koneksi Terputus / Error");
    showToast(err.message || "Terjadi kesalahan koneksi.", "error");
    throw err;
  } finally {
    showLoading(false);
  }
}

/**
 * Mengambil semua data siswa dari Backend
 */
async function loadData() {
  try {
    const res = await callApi("read");
    studentData = res.data || [];
    renderClassesFilter();
    renderTable();
    updateDashboard();
  } catch (err) {
    studentTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4" style="color:var(--danger-color)">Gagal mengambil data siswa. Silakan periksa koneksi atau URL Web App.</td></tr>`;
  }
}

/**
 * Render Tabel Siswa berdasarkan Search & Filter
 */
function renderTable() {
  const query = searchInput.value.toLowerCase().trim();
  const selectedKelas = filterKelas.value;

  const filtered = studentData.filter(s => {
    const matchQuery = 
      s.nama.toLowerCase().includes(query) ||
      s.nisn.toLowerCase().includes(query) ||
      s.nis.toLowerCase().includes(query) ||
      s.namaOrangTua.toLowerCase().includes(query);
      
    const matchKelas = selectedKelas === "" || s.kelas === selectedKelas;
    return matchQuery && matchKelas;
  });

  studentTableBody.innerHTML = "";

  if (filtered.length === 0) {
    studentTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Data siswa tidak ditemukan.</td></tr>`;
    recordInfo.textContent = "Menampilkan 0 data";
    return;
  }

  filtered.forEach((s, index) => {
    const tr = document.createElement("tr");
    const genderBadgeClass = s.jenisKelamin === "Laki-laki" ? "l" : "p";
    const genderShort = s.jenisKelamin === "Laki-laki" ? "L" : "P";

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>
        <div class="font-semibold">${escapeHtml(s.nisn || "-")}</div>
        <div class="text-sm text-muted">${escapeHtml(s.nis || "-")}</div>
      </td>
      <td><strong>${escapeHtml(s.nama)}</strong></td>
      <td><span class="badge-gender ${genderBadgeClass}">${genderShort}</span></td>
      <td><span class="badge-class">${escapeHtml(s.kelas)}</span></td>
      <td>${escapeHtml(s.namaOrangTua || "-")}</td>
      <td>${escapeHtml(s.noHp || "-")}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-secondary" onclick="viewDetail('${s.id}')" title="Detail"><i class="fa-solid fa-eye"></i></button>
          <button class="btn btn-sm btn-secondary" onclick="openEditForm('${s.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn btn-sm btn-danger" onclick="confirmDelete('${s.id}')" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    studentTableBody.appendChild(tr);
  });

  recordInfo.textContent = `Menampilkan ${filtered.length} dari ${studentData.length} total siswa`;
}

/**
 * Update Pilihan Filter Kelas
 */
function renderClassesFilter() {
  const currentSelected = filterKelas.value;
  const classes = [...new Set(studentData.map(s => s.kelas).filter(Boolean))].sort();
  
  filterKelas.innerHTML = `<option value="">Semua Kelas</option>`;
  classes.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    if (c === currentSelected) opt.selected = true;
    filterKelas.appendChild(opt);
  });
}

/**
 * Update Widget Kartu Dashboard
 */
function updateDashboard() {
  statTotal.textContent = studentData.length;
  const maleCount = studentData.filter(s => s.jenisKelamin === "Laki-laki").length;
  const femaleCount = studentData.filter(s => s.jenisKelamin === "Perempuan").length;
  const classCount = new Set(studentData.map(s => s.kelas).filter(Boolean)).size;

  statMale.textContent = maleCount;
  statFemale.textContent = femaleCount;
  statClasses.textContent = classCount;
}

/**
 * Handle Simpan (Tambah / Update) Data Siswa
 */
studentForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("siswaId").value;
  const formData = {
    id: id || undefined,
    nisn: document.getElementById("nisn").value.trim(),
    nis: document.getElementById("nis").value.trim(),
    nama: document.getElementById("nama").value.trim(),
    jenisKelamin: document.getElementById("jenisKelamin").value,
    kelas: document.getElementById("kelas").value.trim(),
    tempatLahir: document.getElementById("tempatLahir").value.trim(),
    tanggalLahir: document.getElementById("tanggalLahir").value,
    namaOrangTua: document.getElementById("namaOrangTua").value.trim(),
    noHp: document.getElementById("noHp").value.trim(),
    alamat: document.getElementById("alamat").value.trim()
  };

  const action = id ? "update" : "create";
  loadingText.textContent = id ? "Memperbarui data siswa..." : "Menyimpan data siswa...";

  try {
    const res = await callApi(action, { data: formData });
    showToast(res.message, "success");
    closeModal(modalForm);
    studentForm.reset();
    await loadData();
  } catch (err) {
    // Error handled in callApi
  }
});

/**
 * Buka Form Tambah Siswa
 */
document.getElementById("btnAddSiswa").addEventListener("click", () => {
  studentForm.reset();
  document.getElementById("siswaId").value = "";
  document.getElementById("modalFormTitle").textContent = "Tambah Data Siswa";
  openModal(modalForm);
});

/**
 * Buka Form Edit Siswa
 */
function openEditForm(id) {
  const siswa = studentData.find(s => s.id === id);
  if (!siswa) return;

  document.getElementById("siswaId").value = siswa.id;
  document.getElementById("nisn").value = siswa.nisn;
  document.getElementById("nis").value = siswa.nis;
  document.getElementById("nama").value = siswa.nama;
  document.getElementById("jenisKelamin").value = siswa.jenisKelamin;
  document.getElementById("kelas").value = siswa.kelas;
  document.getElementById("tempatLahir").value = siswa.tempatLahir;
  document.getElementById("tanggalLahir").value = siswa.tanggalLahir;
  document.getElementById("namaOrangTua").value = siswa.namaOrangTua;
  document.getElementById("noHp").value = siswa.noHp;
  document.getElementById("alamat").value = siswa.alamat;

  document.getElementById("modalFormTitle").textContent = "Edit Data Siswa";
  openModal(modalForm);
}

/**
 * Buka Modal Detail Siswa
 */
function viewDetail(id) {
  const s = studentData.find(item => item.id === id);
  if (!s) return;

  const detailBody = document.getElementById("detailContent");
  detailBody.innerHTML = `
    <div class="detail-list">
      <div class="detail-item"><label>ID System</label><span>${escapeHtml(s.id)}</span></div>
      <div class="detail-item"><label>NISN / NIS</label><span>${escapeHtml(s.nisn)} / ${escapeHtml(s.nis)}</span></div>
      <div class="detail-item"><label>Nama Lengkap</label><span>${escapeHtml(s.nama)}</span></div>
      <div class="detail-item"><label>Jenis Kelamin</label><span>${escapeHtml(s.jenisKelamin)}</span></div>
      <div class="detail-item"><label>Kelas</label><span>${escapeHtml(s.kelas)}</span></div>
      <div class="detail-item"><label>TTL</label><span>${escapeHtml(s.tempatLahir)}, ${escapeHtml(s.tanggalLahir)}</span></div>
      <div class="detail-item"><label>Nama Orang Tua</label><span>${escapeHtml(s.namaOrangTua)}</span></div>
      <div class="detail-item"><label>No HP / WA</label><span>${escapeHtml(s.noHp)}</span></div>
      <div class="detail-item full-width"><label>Alamat</label><span>${escapeHtml(s.alamat)}</span></div>
      <div class="detail-item"><label>Tanggal Input</label><span>${escapeHtml(s.tanggalInput || "-")}</span></div>
      <div class="detail-item"><label>Terakhir Diubah</label><span>${escapeHtml(s.terakhirDiubah || "-")}</span></div>
    </div>
  `;
  openModal(modalDetail);
}

/**
 * Hapus Siswa dengan Konfirmasi
 */
function confirmDelete(id) {
  const s = studentData.find(item => item.id === id);
  if (!s) return;

  deleteTargetId = id;
  document.getElementById("deleteStudentName").textContent = s.nama;
  openModal(modalDelete);
}

document.getElementById("btnConfirmDelete").addEventListener("click", async () => {
  if (!deleteTargetId) return;

  loadingText.textContent = "Menghapus data siswa...";
  try {
    const res = await callApi("delete", { id: deleteTargetId });
    showToast(res.message, "success");
    closeModal(modalDelete);
    deleteTargetId = null;
    await loadData();
  } catch (err) {
    // Error handled in callApi
  }
});

/**
 * Export Data Ke File Excel
 */
document.getElementById("btnExport").addEventListener("click", () => {
  if (studentData.length === 0) {
    showToast("Tidak ada data siswa untuk diexport.", "error");
    return;
  }

  const exportList = studentData.map((s, index) => ({
    "No": index + 1,
    "ID": s.id,
    "NISN": s.nisn,
    "NIS": s.nis,
    "Nama": s.nama,
    "Jenis Kelamin": s.jenisKelamin,
    "Tempat Lahir": s.tempatLahir,
    "Tanggal Lahir": s.tanggalLahir,
    "Kelas": s.kelas,
    "Nama Orang Tua": s.namaOrangTua,
    "No HP": s.noHp,
    "Alamat": s.alamat,
    "Tanggal Input": s.tanggalInput,
    "Terakhir Diubah": s.terakhirDiubah
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportList);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data Siswa");
  XLSX.writeFile(workbook, `Data_Siswa_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast("Export file Excel berhasil diunduh.", "success");
});

/**
 * Download Template Excel Import
 */
document.getElementById("btnDownloadTemplate").addEventListener("click", () => {
  const templateData = [
    {
      "NISN": "0051234567",
      "NIS": "212210001",
      "Nama": "Contoh Nama Siswa",
      "Jenis Kelamin": "Laki-laki",
      "Tempat Lahir": "Bandung",
      "Tanggal Lahir": "2008-05-20",
      "Kelas": "X IPA 1",
      "Nama Orang Tua": "Budi Santoso",
      "No HP": "081234567890",
      "Alamat": "Jl. Merdeka No. 45"
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
});

/**
 * Import Excel Flow
 */
const btnImport = document.getElementById("btnImport");
const excelFileInput = document.getElementById("excelFileInput");
const btnProcessImport = document.getElementById("btnProcessImport");
const importPreviewArea = document.getElementById("importPreviewArea");

btnImport.addEventListener("click", () => {
  excelFileInput.value = "";
  importPreviewArea.classList.add("hidden");
  btnProcessImport.disabled = true;
  importedRowsToSave = [];
  openModal(modalImport);
});

excelFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json(worksheet);

      if (rawJson.length === 0) {
        showToast("File Excel kosong!", "error");
        return;
      }

      importedRowsToSave = rawJson.map(row => ({
        nisn: String(row["NISN"] || ""),
        nis: String(row["NIS"] || ""),
        nama: String(row["Nama"] || ""),
        jenisKelamin: String(row["Jenis Kelamin"] || "Laki-laki"),
        tempatLahir: String(row["Tempat Lahir"] || ""),
        tanggalLahir: String(row["Tanggal Lahir"] || ""),
        kelas: String(row["Kelas"] || ""),
        namaOrangTua: String(row["Nama Orang Tua"] || ""),
        noHp: String(row["No HP"] || ""),
        alamat: String(row["Alamat"] || "")
      }));

      document.getElementById("importFileName").textContent = `File: ${file.name}`;
      document.getElementById("importCountInfo").textContent = `Siap menduplikasi / mengimport ${importedRowsToSave.length} data siswa.`;
      importPreviewArea.classList.remove("hidden");
      btnProcessImport.disabled = false;
    } catch (err) {
      showToast("Gagal membaca file Excel. Pastikan format file sesuai.", "error");
    }
  };
  reader.readAsArrayBuffer(file);
});

btnProcessImport.addEventListener("click", async () => {
  if (importedRowsToSave.length === 0) return;

  loadingText.textContent = "Mengimport batch data ke Google Sheets...";
  try {
    const res = await callApi("import", { dataList: importedRowsToSave });
    showToast(res.message, "success");
    closeModal(modalImport);
    await loadData();
  } catch (err) {
    // Error handled in callApi
  }
});

/**
 * Event Listeners Lainnya
 */
function initEventListeners() {
  searchInput.addEventListener("input", renderTable);
  filterKelas.addEventListener("change", renderTable);

  document.getElementById("btnRefresh").addEventListener("click", loadData);

  // Modal Closer Handlers
  document.getElementById("btnCloseModalForm").onclick = () => closeModal(modalForm);
  document.getElementById("btnCancelForm").onclick = () => closeModal(modalForm);
  
  document.getElementById("btnCloseModalDetail").onclick = () => closeModal(modalDetail);
  document.getElementById("btnCloseDetailBtn").onclick = () => closeModal(modalDetail);

  document.getElementById("btnCloseModalDelete").onclick = () => closeModal(modalDelete);
  document.getElementById("btnCancelDelete").onclick = () => closeModal(modalDelete);

  document.getElementById("btnCloseModalImport").onclick = () => closeModal(modalImport);
  document.getElementById("btnCancelImport").onclick = () => closeModal(modalImport);
}

// Helpers Modal & UI
function openModal(modalEl) { modalEl.classList.add("active"); }
function closeModal(modalEl) { modalEl.classList.remove("active"); }

function showLoading(show) {
  if (show) loadingOverlay.classList.remove("hidden");
  else loadingOverlay.classList.add("hidden");
}

function updateStatus(isOnline, text) {
  const dot = statusBadge.querySelector(".status-dot");
  statusText.textContent = text;
  if (isOnline) {
    dot.style.backgroundColor = "var(--success-color)";
  } else {
    dot.style.backgroundColor = "var(--danger-color)";
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icon = type === "success" ? "fa-circle-check" : "fa-circle-exclamation";
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}