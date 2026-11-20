const SPREADSHEET_ID = 'PEGAR_ID_DE_LA_PLANILLA';

function doGet(e) {
  const vista = (e.parameter && e.parameter.vista) ? e.parameter.vista : 'docente';
  let template;
 
  if (vista === 'admin') {
    template = HtmlService.createTemplateFromFile('admin');
  } else {
    template = HtmlService.createTemplateFromFile('index');
  }
 
  return template.evaluate()
    .setTitle('Reserva de ADM')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function formatearFecha(valorFila) {
  if (!valorFila) return "";
  if (valorFila instanceof Date) {
    return Utilities.formatDate(valorFila, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(valorFila).trim();
}

function obtenerInventario() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Inventario');
  const data = sheet.getDataRange().getValues();
  data.shift();
 
  // Convertimos a mayúsculas para evitar errores si en Sheets dice "Operativo", "OPERATIVO" u "operativo"
  return data.filter(row => String(row[2]).trim().toUpperCase() === 'OPERATIVO').map(row => ({
    id: row[0],
    tipo: row[1]
  }));
}

function obtenerDisponibilidad(fecha, tramo) {
  const sheetReservas = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Reservas');
  const dataReservas = sheetReservas.getDataRange().getValues();
  dataReservas.shift();

  const ocupados = dataReservas
    .filter(row => formatearFecha(row[1]) === fecha && String(row[2]) === String(tramo))
    .map(row => row[3]);

  const inventario = obtenerInventario();
 
  // Objeto dinámico: creará automáticamente las categorías según lo que haya en la planilla
  const disponibles = {};

  inventario.forEach(item => {
    if (!ocupados.includes(item.id)) {
      if(!disponibles[item.tipo]) {
        disponibles[item.tipo] = [];
      }
      disponibles[item.tipo].push(item.id);
    }
  });

  return disponibles;
}

function guardarReserva(datos) {
  const { fecha, tramo, id_adm, profesor, curso } = datos;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Reservas');

  const disp = obtenerDisponibilidad(fecha, tramo);
  const estaDisponible = Object.values(disp).flat().includes(id_adm);

  if (!estaDisponible) {
    throw new Error('El elemento seleccionado ya fue reservado. Por favor, elige otro.');
  }

  const idReserva = 'RES-' + new Date().getTime().toString().slice(-6);
  const marcaTemporal = new Date();
  const codigoCancelacion = Math.random().toString(36).substring(2, 6).toUpperCase();

  sheet.appendRow([
    idReserva,
    "'" + fecha,
    tramo,
    id_adm,
    profesor,
    curso,
    marcaTemporal,
    codigoCancelacion
  ]);

  return { exito: true, idReserva, codigoCancelacion, id_adm };
}

function obtenerReservasDelDia(fechaBuscada) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Reservas');
  const data = sheet.getDataRange().getValues();
  data.shift();
 
  // Obtenemos el inventario para saber el Tipo de cada ID
  const inventario = obtenerInventario();
  const mapaTipos = {};
  inventario.forEach(item => {
    mapaTipos[item.id] = item.tipo;
  });

  const reservasDia = data.filter(row => formatearFecha(row[1]) === fechaBuscada).map(row => ({
    tramo: row[2],
    id_adm: row[3],
    tipo: mapaTipos[row[3]] || '-', // Buscamos el tipo, si no existe ponemos "-"
    profesor: row[4],
    curso: row[5]
  }));
 
  reservasDia.sort((a, b) => a.tramo.localeCompare(b.tramo));
 
  return reservasDia;
}
