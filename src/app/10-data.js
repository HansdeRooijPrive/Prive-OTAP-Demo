// Vaste gegevens van de gesimuleerde releasestraat.
const OPERATOR = 'H. de Rooij', PO = 'S. Bakker', CM = 'R. Visser';
const ORDER = ['O', 'T', 'A', 'P'];
const NEXT = { O: 'T', T: 'A', A: 'P' };
const OMG = {
  O: { name: 'Ontwikkeling', host: 'ontw.platform.intern', data: 'Synthetische data', inst: '1 instantie', db: 'pg-ontw-01', base: 190 },
  T: { name: 'Test', host: 'test.platform.intern', data: 'Vaste testset · 1.200 dossiers', inst: '1 instantie', db: 'pg-test-01', base: 220 },
  A: { name: 'Acceptatie', host: 'acc.platform.intern', data: 'Geanonimiseerde productiekopie', inst: '2 instanties', db: 'pg-acc-01', base: 165 },
  P: { name: 'Productie', host: 'platform.intern', data: 'Productiedata', inst: '3 instanties', db: 'pg-prod-01 (HA)', base: 140 }
};
const STEPS = {
  build: ['Broncode ophalen (main)', 'Compileren', 'Unittests 412/412', 'SAST-scan', 'Image publiceren', 'Uitrollen op Ontwikkeling'],
  std: ['Artefact ophalen', 'Database-migraties (Flyway)', 'Uitrollen', 'Rooktest'],
  prod: ['Groene omgeving opbouwen', 'Database-migraties (Flyway)', 'Rooktest', 'Verkeer 10% → groen', 'Verkeer 50% → groen', 'Verkeer 100% → groen', 'Blauwe omgeving afbouwen'],
  rollback: ['Blauwe omgeving activeren', 'Verkeer 100% → blauw', 'Groene omgeving afbouwen']
};
const POOL = [
  ['VEN-426', 'Dashboard voor teamleads'], ['VEN-429', 'Upgrade naar Node 22 LTS'], ['VEN-431', 'Fix: sessie verloopt te vroeg'],
  ['VEN-433', 'PDF-bijlagen tot 20 MB'], ['VEN-436', 'Toegankelijkheid: focusstijlen formulieren'], ['VEN-438', 'Fix: sortering op status'],
  ['VEN-441', 'Herinneringsmail na 14 dagen'], ['VEN-444', 'Afwijzing met toelichting']
];
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function seed() {
  return {
    releases: [
      { v: '2026.09.3', commit: '5c2e8f1', branch: 'main', built: '10 sep 11:22', reached: ['O'], changes: [['VEN-420', 'Bulkgoedkeuring voor managers'], ['VEN-423', 'Fix: e-mailnotificatie dubbel verstuurd']] },
      { v: '2026.09.2', commit: 'd19be70', branch: 'main', built: '8 sep 15:05', reached: ['O', 'T'], changes: [['VEN-412', 'Kilometers per rit invoeren'], ['VEN-415', 'Tarieftabel 2026 (€ 0,23 per km)'], ['VEN-417', 'Performance: index op declaratiedatum']] },
      { v: '2026.09.1', commit: 'a7c04e9', branch: 'main', built: '3 sep 09:48', reached: ['O', 'T', 'A'], changes: [['VEN-398', 'Inloggen via Entra ID (SSO)'], ['VEN-402', 'Auditlog voor wijzigingen in dossiers'], ['VEN-405', 'Fix: datumfilter in overzicht']] },
      { v: '2026.08.4', commit: '3fa91c2', branch: 'release/2026.08', built: '28 aug 14:10', reached: ['O', 'T', 'A', 'P'], changes: [['VEN-371', 'Export van declaraties naar CSV'], ['VEN-380', 'Fix: afronding kilometervergoeding']] },
      { v: '2026.08.3', commit: '9be2d44', branch: 'release/2026.08', built: '19 aug 10:31', reached: ['O', 'T', 'A', 'P'], changes: [['VEN-362', 'Bijlagen vanaf mobiel uploaden'], ['VEN-366', 'Fix: rechten voor gastgebruikers']] }
    ],
    envs: {
      O: { hist: ['2026.09.2', '2026.09.3'], by: 'CI-pipeline', at: '10 sep 11:22', status: 'ok' },
      T: { hist: ['2026.09.1', '2026.09.2'], by: 'CI-pipeline', at: '9 sep 16:40', status: 'ok' },
      A: { hist: ['2026.08.4', '2026.09.1'], by: OPERATOR, at: '9 sep 10:04', status: 'ok' },
      P: { hist: ['2026.08.3', '2026.08.4'], by: 'M. Jansen', at: '2 sep 19:12', status: 'ok' }
    },
    gates: { T: { reg: 'idle' }, A: { uat: false, cab: false, chg: null } },
    windowOpen: false, freeze: false, failSmoke: false, selected: '2026.09.2', pool: 0, chgSeq: 188,
    log: [
      { t: '10 sep 11:22', e: 'O', lv: 'ok', x: '2026.09.3 gebouwd en uitgerold door CI-pipeline' },
      { t: '9 sep 16:40', e: 'T', lv: 'ok', x: '2026.09.2 gepromoveerd naar Test' },
      { t: '9 sep 10:04', e: 'A', lv: 'ok', x: '2026.09.1 gepromoveerd naar Acceptatie door ' + OPERATOR },
      { t: '2 sep 19:12', e: 'P', lv: 'ok', x: '2026.08.4 live in Productie · CHG-0187 · M. Jansen' }
    ]
  };
}
