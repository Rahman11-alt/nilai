/**
 * Aplikasi Administrasi Siswa - Backend Google Apps Script
 * Database: Google Sheets
 */

// Kosongkan jika Script menyatu dengan Spreadsheet (Container-bound).
// Isi dengan ID Spreadsheet jika Script dibuat secara Standalone di Google Drive.
const SPREADSHEET_ID = ""; 
const SHEET_NAME = "SISWA";

/**
 * Mendapatkan referensi Spreadsheet
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Mendapatkan referensi Sheet SISWA, membuat otomatis jika belum ada
 */
function getSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Buat Header jika sheet baru
    const headers = [
      "ID",
      "NISN",
      "NIS",
      "Nama",
      "Jenis Kelamin",
      "Tempat Lahir",
      "Tanggal Lahir",
      "Kelas",
      "Nama Orang Tua",
      "No HP",
      "Alamat",
      "Tanggal Input",
      "Terakhir Diubah"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#4F46E5")
      .setFontColor("#FFFFFF");
  }
  return sheet;
}

/**
 * Mendapatkan atau memproses Request POST dari Web App
 */
function doPost(e) {
  const response = { success: false, message: "", data: null };

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Payload tidak ditemukan.");
    }

    const contents = JSON.parse(e.postData.contents);
    const action = contents.action;

    switch (action) {
      case "read":
        response.data = getAllSiswa();
        response.success = true;
        response.message = "Data siswa berhasil diambil.";
        break;

      case "create":
        response.data = addSiswa(contents.data);
        response.success = true;
        response.message = "Data siswa berhasil ditambahkan.";
        break;

      case "update":
        response.data = updateSiswa(contents.data);
        response.success = true;
        response.message = "Data siswa berhasil diperbarui.";
        break;

      case "delete":
        deleteSiswa(contents.id);
        response.success = true;
        response.message = "Data siswa berhasil dihapus.";
        break;

      case "import":
        const count = importBatchSiswa(contents.dataList);
        response.success = true;
        response.message = `${count} data siswa berhasil diimport.`;
        break;

      default:
        throw new Error("Aksi tidak valid atau tidak dikenali.");
    }
  } catch (err) {
    response.success = false;
    response.message = err.toString();
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle Request GET untuk mengecek status API
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "API System Administrasi Siswa siap digunakan."
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Mengambil semua data siswa dari Google Sheet
 */
function getAllSiswa() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const listSiswa = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // Skip baris kosong

    listSiswa.push({
      id: String(row[0]),
      nisn: String(row[1] || ""),
      nis: String(row[2] || ""),
      nama: String(row[3] || ""),
      jenisKelamin: String(row[4] || ""),
      tempatLahir: String(row[5] || ""),
      tanggalLahir: formatDateValue(row[6]),
      kelas: String(row[7] || ""),
      namaOrangTua: String(row[8] || ""),
      noHp: String(row[9] || ""),
      alamat: String(row[10] || ""),
      tanggalInput: formatDateValue(row[11]),
      terakhirDiubah: formatDateValue(row[12])
    });
  }

  return listSiswa;
}

/**
 * Menambah 1 data siswa baru
 */
function addSiswa(data) {
  const sheet = getSheet();
  const id = "SW-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  const now = formatDateStandard(new Date());

  const newRow = [
    id,
    data.nisn || "",
    data.nis || "",
    data.nama || "",
    data.jenisKelamin || "",
    data.tempatLahir || "",
    data.tanggalLahir || "",
    data.kelas || "",
    data.namaOrangTua || "",
    data.noHp || "",
    data.alamat || "",
    now,
    now
  ];

  sheet.appendRow(newRow);

  return {
    id: id,
    ...data,
    tanggalInput: now,
    terakhirDiubah: now
  };
}

/**
 * Mengubah data siswa berdasarkan ID
 */
function updateSiswa(data) {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const idToFind = String(data.id);
  let rowIndex = -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === idToFind) {
      rowIndex = i + 1; // 1-based index
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error("Data siswa tidak ditemukan di sistem.");
  }

  const now = formatDateStandard(new Date());
  const existingInputDate = formatDateValue(values[rowIndex - 1][11]) || now;

  const rowData = [
    idToFind,
    data.nisn || "",
    data.nis || "",
    data.nama || "",
    data.jenisKelamin || "",
    data.tempatLahir || "",
    data.tanggalLahir || "",
    data.kelas || "",
    data.namaOrangTua || "",
    data.noHp || "",
    data.alamat || "",
    existingInputDate,
    now
  ];

  sheet.getRange(rowIndex, 1, 1, 13).setValues([rowData]);

  return {
    ...data,
    tanggalInput: existingInputDate,
    terakhirDiubah: now
  };
}

/**
 * Menghapus data siswa berdasarkan ID
 */
function deleteSiswa(id) {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const idToFind = String(id);
  let rowIndex = -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === idToFind) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error("Data siswa tidak ditemukan untuk dihapus.");
  }

  sheet.deleteRow(rowIndex);
  return true;
}

/**
 * Import banyak data siswa sekaligus dari Excel
 */
function importBatchSiswa(dataList) {
  if (!Array.isArray(dataList) || dataList.length === 0) return 0;

  const sheet = getSheet();
  const now = formatDateStandard(new Date());
  const rowsToAdd = [];

  dataList.forEach(function (item) {
    const id = "SW-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
    rowsToAdd.push([
      id,
      item.nisn || "",
      item.nis || "",
      item.nama || "",
      item.jenisKelamin || "",
      item.tempatLahir || "",
      item.tanggalLahir || "",
      item.kelas || "",
      item.namaOrangTua || "",
      item.noHp || "",
      item.alamat || "",
      now,
      now
    ]);
  });

  if (rowsToAdd.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rowsToAdd.length, 13).setValues(rowsToAdd);
  }

  return rowsToAdd.length;
}

/**
 * Utility Format Tanggal Standard YYYY-MM-DD HH:mm
 */
function formatDateStandard(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return "";
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Utility Format Nilai Tanggal Dari Sheet
 */
function formatDateValue(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return formatDateStandard(val);
  }
  return String(val);
}