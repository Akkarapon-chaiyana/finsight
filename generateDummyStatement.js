const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ── Dummy transactions for January 2026 ──────────────────────────────────────
const transactions = [
  { date: '02/01/2026', type: 'Advice Funds Transfer',                    desc: ['TOP-UP TO PAYLAH! :', '93526427'],                                              withdrawal: 20.00,  balance: 980.00 },
  { date: '03/01/2026', type: 'Advice Point-Of-Sale Transaction or Proceeds', desc: ['NETS QR PAYMENT 604406122441541', 'TO: MUSLIM FOOD'],                       withdrawal: 4.50,   balance: 975.50 },
  { date: '03/01/2026', type: 'Advice Point-Of-Sale Transaction or Proceeds', desc: ['NETS QR PAYMENT 604409463527124', 'TO: KOUFU PTE LTD'],                     withdrawal: 3.80,   balance: 971.70 },
  { date: '04/01/2026', type: 'Debit Card Transaction',                    desc: ['BUS/MRT 798795467      SI SGP 02JAN', '4284-2500-0190-7476'],                   withdrawal: 1.68,   balance: 970.02 },
  { date: '04/01/2026', type: 'Debit Card Transaction',                    desc: ['STARBUCKS@NTU NTH(NNS) SI SGP 03JAN', '4284-2500-0190-7476'],                  withdrawal: 7.90,   balance: 962.12 },
  { date: '05/01/2026', type: 'Advice FAST Payment / Receipt',             desc: ['PAYNOW TRANSFER 9113479', 'TO: BEE CHUN HENG RETAIL PTE. LTD.', 'PAYNOW TRANSFER', 'OTHER'], withdrawal: 28.20, balance: 933.92 },
  { date: '06/01/2026', type: 'Advice Funds Transfer',                     desc: ['TOP-UP TO PAYLAH! :', '93526427'],                                              withdrawal: 30.00,  balance: 903.92 },
  { date: '06/01/2026', type: 'Advice Point-Of-Sale Transaction or Proceeds', desc: ['NETS QR PAYMENT 605006575357179', 'TO: PRIME SUPERMARKET'],                 withdrawal: 12.45,  balance: 891.47 },
  { date: '07/01/2026', type: 'Debit Card Transaction',                    desc: ['BUS/MRT 800627066      SI SGP 05JAN', '4284-2500-0190-7476'],                   withdrawal: 2.66,   balance: 888.81 },
  { date: '07/01/2026', type: 'Debit Card Transaction',                    desc: ['MESSINA SG SGP         07JAN', '4284-2500-0190-7476'],                          withdrawal: 24.00,  balance: 864.81 },
  { date: '08/01/2026', type: 'Advice FAST Payment / Receipt',             desc: ['PAYNOW TRANSFER 6654932', 'TO: HENG XU (OLD CHENGDU) RESTAURAN', 'QR20260108193900045531', 'OTHER'], withdrawal: 45.50, balance: 819.31 },
  { date: '09/01/2026', type: 'Debit Card Transaction',                    desc: ['7-ELEVEN-HOTEL 81 CHIN SI SGP 07JAN', '4284-2500-0190-7476'],                  withdrawal: 5.40,   balance: 813.91 },
  { date: '10/01/2026', type: 'Advice Point-Of-Sale Transaction or Proceeds', desc: ['NETS QR PAYMENT 605006583157284', 'TO: DRINK STALL'],                       withdrawal: 1.80,   balance: 812.11 },
  { date: '10/01/2026', type: 'Advice Funds Transfer',                     desc: ['TOP-UP TO PAYLAH! :', '93526427'],                                              withdrawal: 25.00,  balance: 787.11 },
  { date: '11/01/2026', type: 'Debit Card Transaction',                    desc: ['PRIME SUPERMARKET      SI SGP 09JAN', '4284-2500-0190-7476'],                   withdrawal: 18.30,  balance: 768.81 },
  { date: '12/01/2026', type: 'Debit Card Transaction',                    desc: ['BUS/MRT 801123298      SI SGP 10JAN', '4284-2500-0190-7476'],                   withdrawal: 4.15,   balance: 764.66 },
  { date: '13/01/2026', type: 'Advice FAST Payment / Receipt',             desc: ['PAYNOW TRANSFER 8431811', 'TO: ADYEN SG-CHAMPION MANAGEMENT PT', 'TSNZTGFDH2V9K7R4', 'OTHER'], withdrawal: 11.23, balance: 753.43 },
  { date: '14/01/2026', type: 'Advice Point-Of-Sale Transaction or Proceeds', desc: ['NETS QR PAYMENT 606000575357100', 'TO: BAN MIAN'],                          withdrawal: 5.50,   balance: 747.93 },
  { date: '14/01/2026', type: 'Debit Card Transaction',                    desc: ['KFC JP 603 SINGAPORE SGP       13JAN', '4284-2500-0190-7476'],                  withdrawal: 12.95,  balance: 734.98 },
  { date: '15/01/2026', type: 'Advice Funds Transfer',                     desc: ['TOP-UP TO PAYLAH! :', '93526427'],                                              withdrawal: 40.00,  balance: 694.98 },
  { date: '16/01/2026', type: 'Debit Card Transaction',                    desc: ['KOUFU PTE LTD SINGAPORE SGP    15JAN', '4284-2500-0190-7476'],                  withdrawal: 6.50,   balance: 688.48 },
  { date: '17/01/2026', type: 'Advice FAST Payment / Receipt',             desc: ['PAYNOW TRANSFER 6131659', 'TO: SHOPEEPAY PRIVATE LIMITED', 'MP3296037851160584606', 'OTHER'], withdrawal: 65.50, balance: 622.98 },
  { date: '18/01/2026', type: 'Debit Card Transaction',                    desc: ['BUS/MRT 802543292      SI SGP 16JAN', '4284-2500-0190-7476'],                   withdrawal: 2.66,   balance: 620.32 },
  { date: '19/01/2026', type: 'Debit Card Transaction',                    desc: ['SKECHERS - JURONG POIN SI SGP 17JAN', '4284-2500-0190-7476'],                  withdrawal: 89.90,  balance: 530.42 },
  { date: '20/01/2026', type: 'Advice Point-Of-Sale Transaction or Proceeds', desc: ['NETS QR PAYMENT 607000575357200', 'TO: XING JI CHICKEN RICE'],              withdrawal: 6.00,   balance: 524.42 },
  { date: '21/01/2026', type: 'Advice Funds Transfer',                     desc: ['TOP-UP TO PAYLAH! :', '93526427'],                                              withdrawal: 20.00,  balance: 504.42 },
  { date: '22/01/2026', type: 'Debit Card Transaction',                    desc: ['STARBUCKS@NTU NTH(NNS) SI SGP 20JAN', '4284-2500-0190-7476'],                  withdrawal: 7.30,   balance: 497.12 },
  { date: '23/01/2026', type: 'Advice FAST Payment / Receipt',             desc: ['PAYNOW TRANSFER 9200001', 'TO: MUSLIM FOOD', 'PAYNOW TRANSFER', 'OTHER'],       withdrawal: 8.50,   balance: 488.62 },
  { date: '24/01/2026', type: 'Debit Card Transaction',                    desc: ['PRIME SUPERMARKET      SI SGP 22JAN', '4284-2500-0190-7476'],                   withdrawal: 22.10,  balance: 466.52 },
  { date: '25/01/2026', type: 'Debit Card Transaction',                    desc: ['BUS/MRT 803026750      SI SGP 23JAN', '4284-2500-0190-7476'],                   withdrawal: 2.66,   balance: 463.86 },
  { date: '26/01/2026', type: 'Advice Point-Of-Sale Transaction or Proceeds', desc: ['NETS QR PAYMENT 608000575357300', 'TO: KOUFU PTE LTD'],                     withdrawal: 7.20,   balance: 456.66 },
  { date: '27/01/2026', type: 'Advice Funds Transfer',                     desc: ['TOP-UP TO PAYLAH! :', '93526427'],                                              withdrawal: 30.00,  balance: 426.66 },
  { date: '28/01/2026', type: 'Debit Card Transaction',                    desc: ['4FINGERS CRISPY CHICKE SI SGP 26JAN', '4284-2500-0190-7476'],                   withdrawal: 14.80,  balance: 411.86 },
  { date: '29/01/2026', type: 'Debit Card Transaction',                    desc: ['BUS/MRT 804068928      SI SGP 27JAN', '4284-2500-0190-7476'],                   withdrawal: 1.87,   balance: 409.99 },
  { date: '30/01/2026', type: 'Advice FAST Payment / Receipt',             desc: ['PAYNOW TRANSFER 9300002', 'TO: PRIME SUPERMARKET', 'PAYNOW TRANSFER', 'OTHER'], withdrawal: 31.50, balance: 378.49 },
  { date: '31/01/2026', type: 'Advice Point-Of-Sale Transaction or Proceeds', desc: ['NETS QR PAYMENT 609000575357400', 'TO: BAN MIAN'],                          withdrawal: 5.50,   balance: 372.99 },
];

// ── Generate PDF ──────────────────────────────────────────────────────────────
const doc  = new PDFDocument({ margin: 50, size: 'A4' });
const out  = path.join(__dirname, 'public', 'demo-statement.pdf');
doc.pipe(fs.createWriteStream(out));

const mono = 'Courier';
const sz   = 9;

// Header
doc.font('Helvetica-Bold').fontSize(16).text('DBS/POSB', 50, 50, { align: 'right' });
doc.font('Helvetica-Bold').fontSize(13).text('Consolidated Statement', { align: 'right' });
doc.moveDown(1);
doc.font('Helvetica').fontSize(10).text('DEMO USER', 50);
doc.text('123 SAMPLE ROAD #01-01');
doc.text('SINGAPORE 123456');
doc.moveDown(1);
doc.font('Helvetica-Bold').fontSize(12).text('Transaction Details as at 31 Jan 2026');
doc.moveDown(0.5);
doc.font('Helvetica-Bold').fontSize(9).text('My Account', { continued: true });
doc.text('                                                    Account No. 272-000000-1', { align: 'left' });
doc.moveDown(0.3);

// Column headers
doc.font('Helvetica-Bold').fontSize(sz)
   .text('Date', 50, doc.y, { continued: false, width: 70 });
const hy = doc.y - 11;
doc.text('Description',         130, hy, { width: 230 });
doc.text('Withdrawal (-)',      360, hy, { width: 80, align: 'right' });
doc.text('Balance',             450, hy, { width: 90, align: 'right' });
doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#aaaaaa').stroke();
doc.moveDown(0.3);

// Transactions
doc.font(mono).fontSize(sz);
let y = doc.y;

doc.font(mono).fontSize(sz).text('Balance Brought Forward', 130, y);
doc.text('SGD 1,000.00', 450, y, { width: 90, align: 'right' });
y += 14;

for (const tx of transactions) {
  // Date + type on same line (mimics DBS PDF column layout)
  const line1 = tx.date + tx.type;
  doc.font(mono).fontSize(sz).text(line1, 50, y);
  y += 12;

  for (const d of tx.desc) {
    doc.font(mono).fontSize(sz).text(d, 130, y);
    y += 12;
  }

  // Amount line — written as one string so pdf-parse extracts them space-separated
  const wStr = tx.withdrawal.toFixed(2);
  const bStr = tx.balance.toLocaleString('en-US', { minimumFractionDigits: 2 });
  doc.font(mono).fontSize(sz).text(`${wStr} ${bStr}  `, 360, y);
  y += 16;

  if (y > 750) { doc.addPage(); y = 50; }
}

doc.moveTo(50, y).lineTo(545, y).strokeColor('#aaaaaa').stroke();
y += 12;
doc.font(mono).fontSize(sz).text('Balance Carried Forward', 130, y);
doc.text('SGD ' + transactions[transactions.length - 1].balance.toFixed(2), 450, y, { width: 90, align: 'right' });

doc.end();
console.log('Generated:', out);
